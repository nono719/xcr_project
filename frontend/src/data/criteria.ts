/**
 * 各漏洞类型的评分规则（与后端 evaluator.ts 的 STRATEGIES 一一对应）
 * 学生提交前可看到完整通过条件，避免"不知怎么算赢"。
 */

export interface CriterionItem {
  name: string;
  weight: number;
  desc: string;
}

export interface CriteriaSpec {
  /** 漏洞背景概述 */
  intro: string;
  /** 合约接口要求 */
  iface: string[];
  /** 链上判定流程 */
  steps: string[];
  /** 评分项 */
  rubric: CriterionItem[];
}

const COMMON_RUBRIC: CriterionItem[] = [
  { name: '编译', weight: 10, desc: '提交的 Solidity 代码能被 solc 0.8.20 (evmVersion=paris) 成功编译' },
  { name: '部署', weight: 10, desc: '漏洞合约能在沙箱链成功部署，返回合约地址' },
  { name: '攻击交易', weight: 10, desc: '你的合约的 attack() 函数能被链上调用且不 revert' },
];

export const CRITERIA: Record<string, CriteriaSpec> = {
  reentrancy: {
    intro:
      'VulnerableBank 先把 ETH 转出去再清零余额，留下重入窗口。攻击者用 fallback 函数递归调用 withdraw(),  在余额被清零前反复提现。',
    iface: [
      'constructor(address bank) —— 接收受害合约地址',
      'function attack() external payable —— 入口：先 deposit，再 withdraw',
      'receive() external payable —— 当收到 ETH 时再次调用 withdraw（触发重入）',
    ],
    steps: [
      '系统先用 accounts[0] 向 VulnerableBank.deposit() 充值 5 ETH',
      '部署你的合约（构造参数: bank 地址）',
      '用 accounts[1] 调用 attack() 并附带 1 ETH',
      '读取 balance(VulnerableBank) 前后对比',
    ],
    rubric: [
      ...COMMON_RUBRIC,
      {
        name: '漏洞触发',
        weight: 70,
        desc: '调用 attack() 后，VulnerableBank 合约余额降到原值的 1/2 以下（即从 5 ETH 减半以上）',
      },
    ],
  },

  overflow: {
    intro:
      'OverflowToken.batchTransfer 在 unchecked 块中计算 total = amount * cnt，乘法溢出回绕到 0，绕过 balanceOf[sender] >= total 校验，造成多地址收到超大金额而 sender 几乎不花。',
    iface: [
      'constructor(address token) —— 接收 OverflowToken 地址',
      'function attack() external —— 至少调用 mint() + batchTransfer()',
    ],
    steps: [
      '部署 OverflowToken 与你的合约',
      '调用你的 attack()',
      '读取所有可见账户 (accounts[0..5] + 你的合约地址) 的 balanceOf 求和',
      '与 totalSupply 对比',
    ],
    rubric: [
      ...COMMON_RUBRIC,
      {
        name: '漏洞触发',
        weight: 70,
        desc: 'sum(balanceOf 各地址) 比 totalSupply 多出 1e30 以上（典型的乘法溢出后果）',
      },
    ],
  },

  frontrunning: {
    intro:
      'FrontRunnableAuction 的 bid(secret) 把 secret 暴露在 mempool，搜寻者可用更高 gas 价和更高金额抢先打包，篡夺 highestBidder。',
    iface: [
      'constructor(address auction) —— 接收拍卖合约地址（secret 已知为 "topsecret"）',
      'function attack() external payable —— 用更高金额调用 auction.bid("topsecret")',
    ],
    steps: [
      '部署拍卖合约（hash 为 keccak256("topsecret")）',
      '让 accounts[2] 先以 0.5 ETH 出价',
      '部署你的合约',
      '用 accounts[1] 调用你的 attack() 并附带 1 ETH',
      '读取 auction.highestBidder()',
    ],
    rubric: [
      ...COMMON_RUBRIC,
      {
        name: '漏洞触发',
        weight: 70,
        desc: '攻击后 auction.highestBidder() 必须等于你的合约地址 —— 说明你成功抢跑了原出价者',
      },
    ],
  },

  dos: {
    intro:
      'DoSWithRevert.become() 在内部用 transfer 把 ETH 退回前一任 king。若 king 是恶意合约且 receive 主动 revert，那么后续任何人都无法再 become()，合约被永久卡死。',
    iface: [
      'constructor(address target) —— 接收目标合约地址',
      'function attack() external payable —— 用足够金额调用 target.become()',
      'receive() external payable { revert(...); } —— 关键：拒绝收 ETH',
    ],
    steps: [
      '部署 DoSWithRevert',
      '让 accounts[2] 以 0.1 ETH 先成为 king',
      '部署你的合约',
      '用 accounts[1] 调 attack() 附带 0.5 ETH（成为新 king）',
      '让 accounts[3] 尝试用 1 ETH 再 become() —— 期望 revert',
    ],
    rubric: [
      ...COMMON_RUBRIC,
      {
        name: '漏洞触发',
        weight: 70,
        desc: 'accounts[3] 调用 become() 必须失败（因为受害合约要先 transfer 给你，而你的 receive revert）',
      },
    ],
  },

  txorigin: {
    intro:
      'TxOriginAuth.transfer 用 tx.origin 鉴权。即使在嵌套调用里 (msg.sender 是合约)，tx.origin 仍是最初的 EOA。钓鱼合约把 owner 骗到调用任意函数，就能借 owner 的身份转走 victim 资产。',
    iface: [
      'constructor(address wallet, address payable attacker) —— wallet 与最终收款人',
      'function attack() external —— 调用 wallet.transfer(attacker, 1 ether)',
    ],
    steps: [
      '部署 TxOriginAuth（owner = accounts[0]）',
      '向 wallet 充 1 ETH',
      '部署你的钓鱼合约',
      '模拟 owner (accounts[0]) 被诱导调用你的 attack()',
      '读取 wallet 余额前后对比',
    ],
    rubric: [
      ...COMMON_RUBRIC,
      {
        name: '漏洞触发',
        weight: 70,
        desc: 'wallet 余额下降一半以上（资产成功被转出）',
      },
    ],
  },
};

export function getCriteria(vulnType: string): CriteriaSpec | undefined {
  return CRITERIA[vulnType];
}
