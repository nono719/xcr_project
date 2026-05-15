import { Router } from 'express';
import Joi from 'joi';
import { Web3 } from 'web3';
import { pool } from '../config/db';
import { ApiError, ok } from '../utils/response';
import { authRequired } from '../middlewares/auth';
import { compileSolidity, CompileException } from '../services/compiler';
import { createSandbox, destroySandbox, getSandbox, listSandboxes } from '../services/sandbox';

const router = Router();

router.get('/cases', authRequired, async (_req, res, next) => {
  try {
    const [rows] = await pool.query<any[]>(
      `SELECT caseId,name,vulnType,swcId,difficulty,description,attackGoal,scoreWeight
       FROM vulnerability_case WHERE status=1 ORDER BY difficulty ASC, caseId ASC`);
    return ok(res, rows);
  } catch (e) { next(e); }
});

router.get('/cases/:id', authRequired, async (req, res, next) => {
  try {
    const [rows] = await pool.query<any[]>(
      'SELECT * FROM vulnerability_case WHERE caseId=? AND status=1', [Number(req.params.id)]);
    if (!rows.length) throw new ApiError(404, '案例不存在');
    return ok(res, rows[0]);
  } catch (e) { next(e); }
});

router.post('/start', authRequired, async (req, res, next) => {
  try {
    const schema = Joi.object({ caseId: Joi.number().required() });
    const { error, value } = schema.validate(req.body);
    if (error) throw new ApiError(400, error.message);
    const [crows] = await pool.query<any[]>(
      'SELECT caseId,name FROM vulnerability_case WHERE caseId=?', [value.caseId]);
    if (!crows.length) throw new ApiError(404, '案例不存在');
    const sb = await createSandbox(req.user!.userId);
    return ok(res, {
      sandboxId: sb.id,
      rpcUrl: sb.rpcUrl,
      port: sb.port,
      accounts: sb.accounts.map((a) => ({ address: a.address, privateKey: a.privateKey })),
    });
  } catch (e) { next(e); }
});

router.post('/stop', authRequired, async (req, res, next) => {
  try {
    const schema = Joi.object({ sandboxId: Joi.string().required() });
    const { error, value } = schema.validate(req.body);
    if (error) throw new ApiError(400, error.message);
    const okStop = destroySandbox(value.sandboxId);
    return ok(res, { stopped: okStop });
  } catch (e) { next(e); }
});

router.get('/sandboxes', authRequired, (req, res) => {
  const list = listSandboxes(req.user!.userId).map((s) => ({
    id: s.id, port: s.port, rpcUrl: s.rpcUrl, createdAt: s.createdAt, lastActiveAt: s.lastActiveAt,
  }));
  return ok(res, list);
});

router.post('/compile', authRequired, async (req, res, next) => {
  try {
    const schema = Joi.object({
      source: Joi.string().required(),
      filename: Joi.string().default('Contract.sol'),
    });
    const { error, value } = schema.validate(req.body);
    if (error) throw new ApiError(400, error.message);
    try {
      const out = compileSolidity(value.source, value.filename);
      return ok(res, out);
    } catch (e) {
      if (e instanceof CompileException) {
        return res.status(400).json({ code: 400, message: '编译失败', data: { errors: e.errors } });
      }
      throw e;
    }
  } catch (e) { next(e); }
});

router.post('/deploy', authRequired, async (req, res, next) => {
  try {
    const schema = Joi.object({
      sandboxId: Joi.string().required(),
      abi: Joi.array().required(),
      bytecode: Joi.string().required(),
      args: Joi.array().default([]),
      fromIndex: Joi.number().min(0).max(9).default(0),
    });
    const { error, value } = schema.validate(req.body);
    if (error) throw new ApiError(400, error.message);
    const sb = getSandbox(value.sandboxId);
    if (!sb) throw new ApiError(404, '沙箱不存在或已回收');
    const w3 = new Web3(sb.rpcUrl);
    const acc = sb.accounts[value.fromIndex];
    const contract = new w3.eth.Contract(value.abi);
    const inst = await contract.deploy({ data: value.bytecode, arguments: value.args })
      .send({ from: acc.address, gas: '6000000' });
    return ok(res, { contractAddress: inst.options.address });
  } catch (e) { next(e); }
});

router.post('/call', authRequired, async (req, res, next) => {
  try {
    const schema = Joi.object({
      sandboxId: Joi.string().required(),
      contractAddress: Joi.string().required(),
      abi: Joi.array().required(),
      method: Joi.string().required(),
      args: Joi.array().default([]),
      fromIndex: Joi.number().min(0).max(9).default(0),
      value: Joi.string().default('0'),
      send: Joi.boolean().default(true),
    });
    const { error, value } = schema.validate(req.body);
    if (error) throw new ApiError(400, error.message);
    const sb = getSandbox(value.sandboxId);
    if (!sb) throw new ApiError(404, '沙箱不存在或已回收');
    const w3 = new Web3(sb.rpcUrl);
    const c = new w3.eth.Contract(value.abi, value.contractAddress);
    const fn = (c.methods as any)[value.method](...value.args);
    if (value.send) {
      const acc = sb.accounts[value.fromIndex];
      const receipt = await fn.send({
        from: acc.address,
        gas: '6000000',
        value: value.value,
      });
      return ok(res, {
        txHash: receipt.transactionHash,
        gasUsed: String(receipt.gasUsed),
        status: receipt.status?.toString(),
      });
    }
    const result = await fn.call();
    return ok(res, { result: JSON.parse(JSON.stringify(result, (_, v) => (typeof v === 'bigint' ? v.toString() : v))) });
  } catch (e) { next(e); }
});

export default router;
