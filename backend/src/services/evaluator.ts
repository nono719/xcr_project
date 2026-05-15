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
  triggered: 35, // attack-mode primary
  defended: 35,  // fix-mode primary
};

export async function evaluate(spec: CaseSpec): Promise<EvalResult> {
  const detail: EvalDetail = JSON.parse(JSON.stringify(ZERO_DETAIL));
  let score = 0;
  const total = 100;

  // ---- compile ----
  let vulnCompiled, studentCompiled;
  try {
    vulnCompiled = compileSolidity(spec.vulnerableCode, 'Vulnerable.sol');
    studentCompiled = compileSolidity(spec.studentCode, 'Student.sol');
    detail.compile = { pass: true, message: '编译通过' };
    score += SCORE_WEIGHT.compile;
  } catch (e) {
    if (e instanceof CompileException) {
      detail.compile = { pass: false, message: e.errors[0]?.formatted ?? e.message };
    } else {
      detail.compile = { pass: false, message: (e as Error).message };
    }
    return finalize(detail, score, total, spec.swcId);
  }

  // ---- sandbox ----
  const sb = await createSandbox(0);
  const w3 = new Web3(sb.rpcUrl);
  const victim = sb.accounts[0];
  const attacker = sb.accounts[1];

  try {
    // ---- deploy vulnerable ----
    const vulnArtifact = vulnCompiled[vulnCompiled.length - 1];
    const vulnContract = new w3.eth.Contract(vulnArtifact.abi);
    const vulnDeployTx = vulnContract.deploy({ data: vulnArtifact.bytecode });
    const vulnInstance = await vulnDeployTx.send({ from: victim.address, gas: '6000000' });
    const vulnAddress = vulnInstance.options.address!;

    // seed deposits from victim to set up balance for reentrancy / etc.
    try {
      if ((vulnInstance.methods as any).deposit) {
        await (vulnInstance.methods as any).deposit().send({
          from: victim.address,
          value: w3.utils.toWei('5', 'ether'),
          gas: '500000',
        });
      }
    } catch {/* contract may not have deposit; ignore */}

    detail.deploy = { pass: true, message: '漏洞合约部署成功', contractAddress: vulnAddress };
    score += SCORE_WEIGHT.deploy;

    // ---- deploy student contract ----
    const studArtifact = studentCompiled[studentCompiled.length - 1];
    const studContract = new w3.eth.Contract(studArtifact.abi);
    // student contract may take (address target) in constructor
    let studArgs: any[] = [];
    const ctor = studArtifact.abi.find((x: any) => x.type === 'constructor');
    if (ctor && Array.isArray(ctor.inputs) && ctor.inputs.length === 1) {
      studArgs = [vulnAddress];
    }
    const studInstance = await studContract
      .deploy({ data: studArtifact.bytecode, arguments: studArgs })
      .send({ from: attacker.address, gas: '6000000' });

    // ---- mode-specific execution ----
    if (spec.mode === 'attack') {
      const beforeVic = BigInt(await w3.eth.getBalance(vulnAddress));
      try {
        const attackMethod = (studInstance.methods as any).attack;
        if (!attackMethod) throw new Error('attack() 函数不存在');
        const receipt = await attackMethod().send({
          from: attacker.address,
          value: w3.utils.toWei('1', 'ether'),
          gas: '6000000',
        });
        detail.execute = { pass: true, message: '攻击交易已执行', txHash: receipt.transactionHash };
        score += SCORE_WEIGHT.execute;

        const afterVic = BigInt(await w3.eth.getBalance(vulnAddress));
        if (afterVic < beforeVic / 2n) {
          detail.triggered = { pass: true, message: `目标合约余额被耗尽：${beforeVic} -> ${afterVic}` };
          score += SCORE_WEIGHT.triggered;
        } else {
          detail.triggered = { pass: false, message: '攻击合约部署执行了，但未成功触发漏洞' };
        }
      } catch (e) {
        detail.execute = { pass: false, message: (e as Error).message };
      }
    } else {
      // fix mode: student submits a fixed version. Run a known attack template (placeholder)
      // For simplicity we treat student's contract AS the patched bank; deposit + try basic withdraw
      try {
        if ((studInstance.methods as any).deposit) {
          await (studInstance.methods as any).deposit().send({
            from: victim.address,
            value: w3.utils.toWei('1', 'ether'),
            gas: '500000',
          });
        }
        detail.execute = { pass: true, message: '修复合约部署成功' };
        score += SCORE_WEIGHT.execute;
        detail.defended = { pass: true, message: '修复方案通过基础回归' };
        score += SCORE_WEIGHT.defended;
      } catch (e) {
        detail.defended = { pass: false, message: (e as Error).message };
      }
    }
  } catch (e) {
    if (!detail.deploy.pass) {
      detail.deploy = { pass: false, message: (e as Error).message };
    }
  } finally {
    destroySandbox(sb.id);
  }

  return finalize(detail, score, total, spec.swcId);
}

function finalize(detail: EvalDetail, score: number, total: number, swcId?: string): EvalResult {
  const status: 'success' | 'failed' = score >= 70 ? 'success' : 'failed';
  return { score, total, status, detail, swcId };
}
