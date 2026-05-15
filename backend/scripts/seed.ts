import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import 'dotenv/config';
import { pool } from '../src/config/db';
import { env } from '../src/config/env';

const C = (p: string) => fs.readFileSync(path.resolve(__dirname, '..', 'contracts', p), 'utf-8');

const CASES = [
  {
    name: '重入攻击 - 简单银行',
    vulnType: 'reentrancy',
    swcId: 'SWC-107',
    difficulty: 1,
    description: '攻击者通过 fallback 函数递归调用 withdraw，绕过余额更新检查，掏空合约。',
    attackGoal: '编写 ReentrancyAttacker 合约，使 VulnerableBank 的余额接近 0。',
    vulnerableCode: C('vulnerable/VulnerableBank.sol'),
    attackTemplate: C('attack/ReentrancyAttacker.sol'),
    referenceFix: C('fix/SafeBank.sol'),
    scoreWeight: 100,
  },
  {
    name: '整数溢出 - batchTransfer',
    vulnType: 'overflow',
    swcId: 'SWC-101',
    difficulty: 2,
    description: '在 batchTransfer 中乘法计算总额时溢出，导致用户花费极少代币却向多地址打款超大金额。',
    attackGoal: '调用 batchTransfer 触发乘法溢出，使 balanceOf[sender] >= total 检查被绕过。',
    vulnerableCode: C('vulnerable/OverflowToken.sol'),
    attackTemplate: C('attack/OverflowAttacker.sol'),
    referenceFix: '',
    scoreWeight: 100,
  },
  {
    name: '抢先交易 - 密封拍卖',
    vulnType: 'frontrunning',
    swcId: 'SWC-114',
    difficulty: 2,
    description: '调用 bid 的 secret 在 mempool 公开后，可被搜寻者用更高 gas 价抢先打包。',
    attackGoal: '编写抢跑合约，用更高的 bid 金额抢在他人之前出价并成为 highestBidder。',
    vulnerableCode: C('vulnerable/FrontRunnableAuction.sol'),
    attackTemplate: C('attack/FrontRunner.sol'),
    referenceFix: '',
    scoreWeight: 100,
  },
  {
    name: '拒绝服务 - king-of-the-hill',
    vulnType: 'dos',
    swcId: 'SWC-113',
    difficulty: 2,
    description: '受害合约在内部使用 transfer 直接向上一任 king 返还以太币，恶意合约可永久回滚后续交易。',
    attackGoal: '部署恶意合约成为 king，使后续 become 调用全部 revert。',
    vulnerableCode: C('vulnerable/DoSWithRevert.sol'),
    attackTemplate: C('attack/DoSGriefer.sol'),
    referenceFix: '',
    scoreWeight: 100,
  },
  {
    name: 'tx.origin 鉴权钓鱼',
    vulnType: 'txorigin',
    swcId: 'SWC-115',
    difficulty: 1,
    description: 'tx.origin 在嵌套合约调用中仍是原始调用者，攻击者可借助钓鱼合约转走资产。',
    attackGoal: '构造钓鱼合约诱使 owner 调用，借 tx.origin 绕过鉴权调用 wallet.transfer。',
    vulnerableCode: C('vulnerable/TxOriginAuth.sol'),
    attackTemplate: C('attack/TxOriginPhish.sol'),
    referenceFix: '',
    scoreWeight: 100,
  },
];

async function main() {
  const conn = await pool.getConnection();
  try {
    const [users] = await conn.query<any[]>("SELECT COUNT(*) AS n FROM user");
    if (users[0].n === 0) {
      const seed = [
        { username: 'admin',     password: 'Admin@123',     role: 'admin',   email: 'admin@xcr.local' },
        { username: 'teacher01', password: 'Teacher@123',   role: 'teacher', email: 'teacher01@xcr.local' },
        { username: 'student01', password: 'Student@123',   role: 'student', email: 'student01@xcr.local' },
        { username: 'student02', password: 'Student@123',   role: 'student', email: 'student02@xcr.local' },
      ];
      for (const u of seed) {
        const salt = await bcrypt.genSalt(env.bcrypt.saltRounds);
        const hash = await bcrypt.hash(u.password, salt);
        await conn.query(
          'INSERT INTO user(username,password,salt,role,email) VALUES(?,?,?,?,?)',
          [u.username, hash, salt, u.role, u.email]);
      }
      console.log('seeded users:', seed.map((u) => u.username).join(', '));
    } else {
      console.log('users already exist, skip user seed');
    }

    const [[teacher]] = await conn.query<any[]>("SELECT userId FROM user WHERE username='teacher01'");
    const teacherId = teacher?.userId ?? 1;

    const [coursesExist] = await conn.query<any[]>('SELECT COUNT(*) AS n FROM course');
    if (coursesExist[0].n === 0) {
      const [r1] = await conn.query<any>(
        `INSERT INTO course(title,description,teacherId,severity,difficulty,orderNo,status)
         VALUES(?,?,?,?,?,?,1)`,
        ['智能合约安全入门', '从 Solidity 语法到典型漏洞原理与防御实践', teacherId, 'high', 'beginner', 1]);
      const courseId = r1.insertId;
      const modules = [
        ['Solidity 基础语法', '合约结构 / 数据类型 / 函数可见性 ...', 'text', 1],
        ['EVM 与 Gas 模型', '执行模型、calldata、storage 与 Gas 计算', 'text', 2],
        ['重入攻击原理与防御', '调用栈 / 跨函数重入 / Checks-Effects-Interactions', 'text', 3],
        ['整数溢出与 SafeMath', 'Solidity 0.8 内置溢出检查与 unchecked', 'text', 4],
        ['抢先交易与提交揭示', 'commit-reveal 模式与 MEV 缓解', 'text', 5],
      ];
      for (const [title, content, type, orderNo] of modules) {
        await conn.query(
          'INSERT INTO course_module(courseId,title,content,type,orderNo) VALUES(?,?,?,?,?)',
          [courseId, title, content, type, orderNo]);
      }
      console.log('seeded course #1 with 5 modules');
    }

    // upsert by name —— 允许重复运行 seed 来刷新案例代码/描述
    for (const c of CASES) {
      const [exists] = await conn.query<any[]>(
        'SELECT caseId FROM vulnerability_case WHERE name=? LIMIT 1', [c.name]);
      if (exists.length) {
        await conn.query(
          `UPDATE vulnerability_case SET
            vulnType=?,swcId=?,difficulty=?,description=?,attackGoal=?,
            vulnerableCode=?,attackTemplate=?,referenceFix=?,scoreWeight=?,status=1
           WHERE caseId=?`,
          [c.vulnType, c.swcId, c.difficulty, c.description, c.attackGoal,
            c.vulnerableCode, c.attackTemplate, c.referenceFix, c.scoreWeight,
            exists[0].caseId]);
      } else {
        await conn.query(
          `INSERT INTO vulnerability_case
           (name,vulnType,swcId,difficulty,description,attackGoal,vulnerableCode,attackTemplate,referenceFix,scoreWeight,status)
           VALUES (?,?,?,?,?,?,?,?,?,?,1)`,
          [c.name, c.vulnType, c.swcId, c.difficulty, c.description, c.attackGoal,
            c.vulnerableCode, c.attackTemplate, c.referenceFix, c.scoreWeight]);
      }
    }
    console.log('upserted vulnerability cases:', CASES.length);
  } finally {
    conn.release();
    await pool.end();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
