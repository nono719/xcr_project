import { Router } from 'express';
import Joi from 'joi';
import { pool } from '../config/db';
import { ApiError, ok } from '../utils/response';
import { authRequired } from '../middlewares/auth';
import { evaluate } from '../services/evaluator';
import { logOperation } from '../utils/logger';

const router = Router();

router.post('/submit', authRequired, async (req, res, next) => {
  try {
    const schema = Joi.object({
      caseId: Joi.number().required(),
      mode: Joi.string().valid('attack', 'fix').default('attack'),
      code: Joi.string().required(),
    });
    const { error, value } = schema.validate(req.body);
    if (error) throw new ApiError(400, error.message);

    const [crows] = await pool.query<any[]>(
      'SELECT * FROM vulnerability_case WHERE caseId=? AND status=1', [value.caseId]);
    if (!crows.length) throw new ApiError(404, '案例不存在');
    const c = crows[0];

    const result = await evaluate({
      vulnType: c.vulnType,
      swcId: c.swcId,
      vulnerableCode: c.vulnerableCode,
      mode: value.mode,
      studentCode: value.code,
    });

    const [r] = await pool.query<any>(
      `INSERT INTO experiment_record(studentId,caseId,mode,code,score,result,detail)
       VALUES(?,?,?,?,?,?,?)`,
      [req.user!.userId, value.caseId, value.mode, value.code,
        result.score, result.status, JSON.stringify(result.detail)],
    );
    logOperation('evaluation.submit', req.user!.userId, {
      caseId: value.caseId, mode: value.mode, score: result.score, status: result.status,
    });
    return ok(res, {
      recordId: r.insertId,
      score: result.score,
      total: result.total,
      status: result.status,
      detail: result.detail,
      swcId: result.swcId,
      vulnType: c.vulnType,
      caseName: c.name,
    });
  } catch (e) { next(e); }
});

router.get('/records/me', authRequired, async (req, res, next) => {
  try {
    const [rows] = await pool.query<any[]>(
      `SELECT r.recordId,r.caseId,r.mode,r.score,r.result,r.submitTime,
              c.name AS caseName, c.vulnType
       FROM experiment_record r LEFT JOIN vulnerability_case c ON c.caseId=r.caseId
       WHERE r.studentId=? ORDER BY r.submitTime DESC LIMIT 200`,
      [req.user!.userId]);
    return ok(res, rows);
  } catch (e) { next(e); }
});

router.get('/report/:id', authRequired, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const [rows] = await pool.query<any[]>(
      `SELECT r.*, c.name AS caseName, c.vulnType, c.swcId
       FROM experiment_record r LEFT JOIN vulnerability_case c ON c.caseId=r.caseId
       WHERE r.recordId=?`, [id]);
    if (!rows.length) throw new ApiError(404, '报告不存在');
    const rec = rows[0];
    if (req.user!.role === 'student' && rec.studentId !== req.user!.userId) {
      throw new ApiError(403, '无权访问');
    }
    return ok(res, {
      recordId: rec.recordId,
      caseName: rec.caseName,
      vulnType: rec.vulnType,
      swcId: rec.swcId,
      mode: rec.mode,
      score: rec.score,
      total: 100,
      status: rec.result,
      submitTime: rec.submitTime,
      detail: typeof rec.detail === 'string' ? JSON.parse(rec.detail) : rec.detail,
      code: rec.code,
    });
  } catch (e) { next(e); }
});

export default router;
