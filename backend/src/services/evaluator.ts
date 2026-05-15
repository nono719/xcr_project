import { Web3 } from 'web3';
import { compileSolidity, CompileException } from './compiler';
import { createSandbox, destroySandbox } from './sandbox';

export interface EvalDetail {
  compile: { pass: boolean; message: string };
  deploy: { pass: boolean; message: string; contractAddress?: string };
  execute: { pass: boolean; message: string; txHash?: string };
  triggered: { pass: boolean; message: string };
  defended: { pass: boolean; message: string };
}

export interface EvalResult {
  score: number;
  total: number;
  status: 'success' | 'failed';
  detail: EvalDetail;
  swcId?: string;
}

export interface CaseSpec {
  vulnType: string;
  swcId?: string;
  vulnerableCode: string;
  mode: 'attack' | 'fix';
  studentCode: string;
}

const ZERO_DETAIL: EvalDetail = {
  compile: { pass: false, message: '未执行' },
  deploy: { pass: false, message: '未执行' },
  execute: { pass: false, message: '未执行' },
  triggered: { pass: false, message: '未执行' },
  defended: { pass: false, message: '未执行' },
};

const SCORE_WEIGHT = {
  compile: 10,
  deploy: 10,
  execute: 10,
  triggered: 70,
  defended: 70,
};

/** 跳过 interface / abstract（bytecode 空），选第一个真正可部署的合约 */
function pickDeployable(arts: Array<{ contractName: string; abi: any[]; bytecode: string }>) {
  const real = arts.find((a) => a.bytecode && a.bytecode.length > 4);
  return real ?? arts[arts.length - 1];
}

/* ============ vuln-type strategies ============ */

interface EvalCtx {
  w3: Web3;
  accounts: string[];
  vulnAbi: any[];
  vulnAddress: string;
  studAbi: any[];
  studAddress: string;
  detail: EvalDetail;
}

interface AttackOutcome { txHash?: string; message: string; triggered?: boolean; triggerMessage?: string }

type Strategy = {
  setupVictim?: (ctx: EvalCtx) => Promise<void>;
  // 学生合约构造参数 (默认: [vulnAddress] 单参数；否则空)
  studentCtorArgs?: (ctx: EvalCtx) => any[];
  // 跑攻击：调用学生合约的 attack()
  runAttack: (ctx: EvalCtx) => Promise<AttackOutcome>;
  // fix 模式：把学生合约当作"修复后的合约"，跑回归（原始攻击不应再生效）
  runRegression?: (ctx: EvalCtx) => Promise<{ defended: boolean; message: string }>;
};

const toEth = (w3: Web3, v: string) => w3.utils.toWei(v, 'ether');

/** 1. reentrancy: VulnerableBank vs Attacker */
const reentrancy: Strategy = {
  async setupVictim({ w3, accounts, vulnAbi, vulnAddress }) {
    const c = new w3.eth.Contract(vulnAbi, vulnAddress);
    await (c.methods as any).deposit().send({
      from: accounts[0],
      value: toEth(w3, '5'),
      gas: '500000',
    });
  },
  async runAttack({ w3, accounts, vulnAddress, studAbi, studAddress }) {
    const before = BigInt(await w3.eth.getBalance(vulnAddress));
    const stud = new w3.eth.Contract(studAbi, studAddress);
    if (!(stud.methods as any).attack) return { message: 'attack() 函数不存在' };
    const r = await (stud.methods as any).attack().send({
      from: accounts[1],
      value: toEth(w3, '1'),
      gas: '6000000',
    });
    const after = BigInt(await w3.eth.getBalance(vulnAddress));
    const triggered = after * 2n < before; // 被掏空一半以上
    return {
      txHash: r.transactionHash,
      message: '攻击交易已执行',
      triggered,
      triggerMessage: triggered
        ? `目标合约余额被耗尽：${before} -> ${after}`
        : `余额未显著下降：${before} -> ${after}`,
    };
  },
  async runRegression({ w3, accounts, vulnAbi, studAbi, studAddress }) {
    // 把学生合约视作修复版 Bank：先存款，再用一个简易攻击合约尝试重入
    const stud = new w3.eth.Contract(studAbi, studAddress);
    try {
      if ((stud.methods as any).deposit) {
        await (stud.methods as any).deposit().send({
          from: accounts[0], value: toEth(w3, '2'), gas: '500000',
        });
      }
      // 部署一个简单的 reentrant attacker against student
      const REENTRANT_SRC = `
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
interface I { function deposit() external payable; function withdraw() external; }
contract R { I public t; constructor(address _t){ t = I(_t); }
  function attack() external payable { t.deposit{value: msg.value}(); t.withdraw(); }
  receive() external payable { if (address(t).balance >= 1 ether) { try t.withdraw() {} catch {} } }
}`;
      const compiled = compileSolidity(REENTRANT_SRC, 'R.sol');
      const art = compiled[compiled.length - 1];
      const rc = new w3.eth.Contract(art.abi);
      const attackerInst = await rc.deploy({ data: art.bytecode, arguments: [studAddress] })
        .send({ from: accounts[1], gas: '4000000' });

      const balBefore = BigInt(await w3.eth.getBalance(studAddress));
      try {
        await (attackerInst.methods as any).attack().send({
          from: accounts[1], value: toEth(w3, '1'), gas: '6000000',
        });
      } catch {/* 期望回滚 */}
      const balAfter = BigInt(await w3.eth.getBalance(studAddress));
      // 修复有效：余额没有被耗尽（最多减少 1 ETH 的攻击者自身资金）
      const defended = balAfter * 2n >= balBefore;
      return {
        defended,
        message: defended
          ? `重入回归测试通过：余额从 ${balBefore} 到 ${balAfter}`
          : `修复无效：余额从 ${balBefore} 降到 ${balAfter}`,
      };
    } catch (e) {
      return { defended: false, message: `回归测试失败：${(e as Error).message}` };
    }
  },
};

/** 2. overflow: OverflowToken batchTransfer */
const overflow: Strategy = {
  studentCtorArgs: ({ vulnAddress }) => [vulnAddress],
  async setupVictim({ w3, accounts, vulnAbi, vulnAddress, studAddress }) {
    // 给学生合约挖一些代币作为初始余额
    const c = new w3.eth.Contract(vulnAbi, vulnAddress);
    if ((c.methods as any).mint) {
      // 直接给学生合约挖
      const tx = (c.methods as any).mint('100');
      // 这里 mint 是给 msg.sender，但学生合约 attack 时再自己 mint
    }
  },
  async runAttack({ w3, accounts, vulnAbi, vulnAddress, studAbi, studAddress }) {
    const stud = new w3.eth.Contract(studAbi, studAddress);
    const vuln = new w3.eth.Contract(vulnAbi, vulnAddress);
    if (!(stud.methods as any).attack) return { message: 'attack() 函数不存在' };
    const r = await (stud.methods as any).attack().send({
      from: accounts[1], gas: '4000000',
    });
    // 检测：合约的 totalSupply 与所有已知地址 balanceOf 之和是否出现明显异常
    try {
      const total = BigInt(await (vuln.methods as any).totalSupply().call());
      let sum = 0n;
      for (const a of accounts.slice(0, 6)) {
        try { sum += BigInt(await (vuln.methods as any).balanceOf(a).call()); } catch {}
      }
      // 加上学生合约自己
      try { sum += BigInt(await (vuln.methods as any).balanceOf(studAddress).call()); } catch {}
      // 触发条件：余额总和远大于 totalSupply（典型 overflow 后果）
      const triggered = sum > total + 10n ** 30n;
      return {
        txHash: r.transactionHash,
        message: '攻击交易已执行',
        triggered,
        triggerMessage: triggered
          ? `检测到溢出：sum(balanceOf)=${sum} >> totalSupply=${total}`
          : `未检测到 token 余额异常：sum=${sum}, totalSupply=${total}`,
      };
    } catch (e) {
      return {
        txHash: r.transactionHash, message: '攻击交易已执行',
        triggered: false, triggerMessage: `校验失败：${(e as Error).message}`,
      };
    }
  },
};

/** 3. frontrunning: 密封拍卖 */
const SECRET = 'topsecret';
const frontrunning: Strategy = {
  studentCtorArgs: ({ vulnAddress }) => [vulnAddress],
  async setupVictim({ w3, accounts, vulnAbi, vulnAddress }) {
    // 让 accounts[2] 先出价 0.5 ETH（作为初始高出价者）
    const c = new w3.eth.Contract(vulnAbi, vulnAddress);
    try {
      await (c.methods as any).bid(SECRET).send({
        from: accounts[2], value: toEth(w3, '0.5'), gas: '500000',
      });
    } catch {/* ignore if signature mismatch */}
  },
  async runAttack({ w3, accounts, vulnAbi, vulnAddress, studAbi, studAddress }) {
    const stud = new w3.eth.Contract(studAbi, studAddress);
    const vuln = new w3.eth.Contract(vulnAbi, vulnAddress);
    if (!(stud.methods as any).attack) return { message: 'attack() 函数不存在' };
    const r = await (stud.methods as any).attack().send({
      from: accounts[1], value: toEth(w3, '1'), gas: '4000000',
    });
    try {
      const highest = (await (vuln.methods as any).highestBidder().call()) as string;
      const triggered = highest.toLowerCase() === studAddress.toLowerCase();
      return {
        txHash: r.transactionHash,
        message: '攻击交易已执行',
        triggered,
        triggerMessage: triggered
          ? `学生合约成功成为最高出价者：${highest}`
          : `最高出价者仍为 ${highest}`,
      };
    } catch (e) {
      return {
        txHash: r.transactionHash, message: '攻击交易已执行',
        triggered: false, triggerMessage: `读取 highestBidder 失败：${(e as Error).message}`,
      };
    }
  },
};

/** 4. dos: king-of-the-hill */
const dos: Strategy = {
  studentCtorArgs: ({ vulnAddress }) => [vulnAddress],
  async setupVictim({ w3, accounts, vulnAbi, vulnAddress }) {
    const c = new w3.eth.Contract(vulnAbi, vulnAddress);
    try {
      await (c.methods as any).become().send({
        from: accounts[2], value: toEth(w3, '0.1'), gas: '500000',
      });
    } catch {/* ignore */}
  },
  async runAttack({ w3, accounts, vulnAbi, vulnAddress, studAbi, studAddress }) {
    const stud = new w3.eth.Contract(studAbi, studAddress);
    const vuln = new w3.eth.Contract(vulnAbi, vulnAddress);
    if (!(stud.methods as any).attack) return { message: 'attack() 函数不存在' };
    const r = await (stud.methods as any).attack().send({
      from: accounts[1], value: toEth(w3, '0.5'), gas: '4000000',
    });
    // 触发条件：后续 become() 都失败
    let blocked = false;
    try {
      await (vuln.methods as any).become().send({
        from: accounts[3], value: toEth(w3, '1'), gas: '300000',
      });
    } catch {
      blocked = true;
    }
    return {
      txHash: r.transactionHash,
      message: '攻击交易已执行',
      triggered: blocked,
      triggerMessage: blocked
        ? '后续 become() 调用全部被回滚，DoS 已激活'
        : '其他账户仍可成功 become()，未触发 DoS',
    };
  },
};

/** 5. txorigin: 钓鱼合约 */
const txorigin: Strategy = {
  studentCtorArgs: ({ vulnAddress, accounts }) => [vulnAddress, accounts[1]],
  async setupVictim({ w3, accounts, vulnAbi, vulnAddress }) {
    // owner = accounts[0]，向 victim 充 1 ETH
    await w3.eth.sendTransaction({
      from: accounts[0],
      to: vulnAddress,
      value: toEth(w3, '1'),
      gas: '100000',
    });
  },
  async runAttack({ w3, accounts, vulnAbi, vulnAddress, studAbi, studAddress }) {
    const stud = new w3.eth.Contract(studAbi, studAddress);
    if (!(stud.methods as any).attack) return { message: 'attack() 函数不存在' };
    // 模拟 owner (accounts[0]) 被诱导调用钓鱼合约
    const beforeVic = BigInt(await w3.eth.getBalance(vulnAddress));
    const r = await (stud.methods as any).attack().send({
      from: accounts[0], gas: '4000000',
    });
    const afterVic = BigInt(await w3.eth.getBalance(vulnAddress));
    const triggered = afterVic * 2n < beforeVic;
    return {
      txHash: r.transactionHash,
      message: '攻击交易已执行 (owner 被诱导)',
      triggered,
      triggerMessage: triggered
        ? `victim 余额下降：${beforeVic} -> ${afterVic}`
        : `victim 余额未显著下降：${beforeVic} -> ${afterVic}`,
    };
  },
};

const STRATEGIES: Record<string, Strategy> = {
  reentrancy, overflow, frontrunning, dos, txorigin,
};

/* ============ main entry ============ */

export async function evaluate(spec: CaseSpec): Promise<EvalResult> {
  const detail: EvalDetail = JSON.parse(JSON.stringify(ZERO_DETAIL));
  let score = 0;
  const total = 100;

  // 1) compile
  let vulnCompiled, studentCompiled;
  try {
    vulnCompiled = compileSolidity(spec.vulnerableCode, 'Vulnerable.sol');
    studentCompiled = compileSolidity(spec.studentCode, 'Student.sol');
    detail.compile = { pass: true, message: '编译通过' };
    score += SCORE_WEIGHT.compile;
  } catch (e) {
    detail.compile = {
      pass: false,
      message: e instanceof CompileException
        ? (e.errors[0]?.formatted ?? e.message)
        : (e as Error).message,
    };
    return finalize(detail, score, total, spec.swcId);
  }

  // 2) sandbox
  const sb = await createSandbox(0);
  const w3 = new Web3(sb.rpcUrl);
  const accounts = sb.accounts.map((a) => a.address);
  if (accounts.length < 3) {
    throw new Error('需要至少 3 个 Ganache 账户');
  }

  const strategy = STRATEGIES[spec.vulnType] ?? reentrancy;

  try {
    // 3) deploy vulnerable
    const vulnArt = pickDeployable(vulnCompiled);
    const vulnCtor = vulnArt.abi.find((x: any) => x.type === 'constructor');
    let vulnArgs: any[] = [];
    if (vulnCtor && Array.isArray(vulnCtor.inputs)) {
      // 已知漏洞合约构造参数：frontrunning 需要 secretHash
      if (spec.vulnType === 'frontrunning' && vulnCtor.inputs.length === 1) {
        vulnArgs = [w3.utils.keccak256(w3.utils.utf8ToHex(SECRET))];
      }
    }
    const vulnInstance = await new w3.eth.Contract(vulnArt.abi)
      .deploy({ data: vulnArt.bytecode, arguments: vulnArgs })
      .send({ from: accounts[0], gas: '6000000' });
    const vulnAddress = vulnInstance.options.address!;
    detail.deploy = { pass: true, message: '漏洞合约部署成功', contractAddress: vulnAddress };
    score += SCORE_WEIGHT.deploy;

    // 4) deploy student
    const studArt = pickDeployable(studentCompiled);
    const ctxStub: EvalCtx = {
      w3, accounts,
      vulnAbi: vulnArt.abi, vulnAddress,
      studAbi: studArt.abi, studAddress: '0x0',
      detail,
    };
    const studCtor = studArt.abi.find((x: any) => x.type === 'constructor');
    let studArgs: any[] = [];
    if (studCtor && Array.isArray(studCtor.inputs) && studCtor.inputs.length > 0) {
      const supplied = strategy.studentCtorArgs?.(ctxStub) ?? [vulnAddress];
      studArgs = supplied.slice(0, studCtor.inputs.length);
    }
    const studInstance = await new w3.eth.Contract(studArt.abi)
      .deploy({ data: studArt.bytecode, arguments: studArgs })
      .send({ from: accounts[1], gas: '6000000' });
    const studAddress = studInstance.options.address!;

    const ctx: EvalCtx = { ...ctxStub, studAddress };

    // 5) mode dispatch
    if (spec.mode === 'attack') {
      // setup
      try { await strategy.setupVictim?.(ctx); } catch (e) {
        // setup 失败不致命，但记录
        detail.execute = { pass: false, message: `setup 失败：${(e as Error).message}` };
        return finalize(detail, score, total, spec.swcId);
      }
      // attack
      try {
        const out = await strategy.runAttack(ctx);
        if (out.txHash) {
          detail.execute = { pass: true, message: out.message, txHash: out.txHash };
          score += SCORE_WEIGHT.execute;
          detail.triggered = {
            pass: !!out.triggered,
            message: out.triggerMessage ?? (out.triggered ? '漏洞已触发' : '未触发漏洞'),
          };
          if (out.triggered) score += SCORE_WEIGHT.triggered;
        } else {
          detail.execute = { pass: false, message: out.message };
        }
      } catch (e) {
        detail.execute = { pass: false, message: (e as Error).message };
      }
    } else {
      // fix 模式
      detail.execute = { pass: true, message: '修复合约部署成功' };
      score += SCORE_WEIGHT.execute;
      if (strategy.runRegression) {
        try {
          const reg = await strategy.runRegression(ctx);
          detail.defended = { pass: reg.defended, message: reg.message };
          if (reg.defended) score += SCORE_WEIGHT.defended;
        } catch (e) {
          detail.defended = { pass: false, message: (e as Error).message };
        }
      } else {
        detail.defended = { pass: true, message: '修复方案部署成功（该案例未配置回归测试）' };
        score += SCORE_WEIGHT.defended;
      }
    }
  } catch (e) {
    if (!detail.deploy.pass) {
      detail.deploy = { pass: false, message: (e as Error).message };
    } else {
      detail.execute = { pass: false, message: (e as Error).message };
    }
  } finally {
    await destroySandbox(sb.id);
  }

  return finalize(detail, score, total, spec.swcId);
}

function finalize(detail: EvalDetail, score: number, total: number, swcId?: string): EvalResult {
  const status: 'success' | 'failed' = score >= 70 ? 'success' : 'failed';
  return { score, total, status, detail, swcId };
}
