# 审计的思路与流程

智能合约审计不是"读一遍代码找 bug"——它是一套**系统性的攻击者思维**练习。

## 标准审计流程

```
1. 项目背景与威胁模型
   ↓
2. 静态分析 (工具)
   ↓
3. 人工代码审查
   ↓
4. 动态测试 (模糊 + 单元)
   ↓
5. 形式化验证 (可选, 高价值合约)
   ↓
6. 报告 + 回归测试
```

每一步都有失败模式，不能跳过。

## 一、项目背景

开始前要回答的几个问题：

| 问题 | 为什么重要 |
|---|---|
| 合约持有多少资金？峰值如何？ | 决定攻击者预期收益 |
| 治理结构？谁能改参数？ | 升级 / 多签 / 时间锁 |
| 外部依赖？预言机、桥、其他协议？ | 第三方信任假设 |
| 用户操作流程？ | 找出"用户可能犯什么错" |
| 历史漏洞？类似项目踩过哪些坑？ | 借鉴模式 |

写一份**威胁模型**（threat model）：列出所有 actor、他们的目标、攻击向量。

## 二、静态分析

让工具帮你扫一遍**已知模式**：

```bash
slither .                       # 最快速、覆盖最广
mythril analyze MyContract.sol  # 符号执行, 深入但慢
solhint                         # 风格 + 已知 bug
```

这些工具会标出：

- public/external 应该限制访问？
- 整数算术风险？
- 未检查 call 返回值？
- 已知漏洞 pattern（如 transfer 后还修改状态）？

工具的**误报率不低**，但人工审查从工具的 warning list 出发能省大量时间。

## 三、人工审查

工具发现不了**业务逻辑漏洞**。这部分要逐个函数读：

**Function-by-function checklist**：

- [ ] 鉴权：谁能调用？msg.sender 还是 tx.origin？
- [ ] 参数：所有 require 是否完整？边界值会如何？
- [ ] 状态更新：是否在外部调用前完成？(Checks-Effects-Interactions)
- [ ] 算术：会不会溢出？除法精度？
- [ ] 外部调用：返回值有 check 吗？转账可能 revert 吗？
- [ ] 事件：关键改动都 emit 了吗？

**System-level**：

- [ ] 多个函数组合时不变量还成立吗？（比如 totalSupply == sum(balances)）
- [ ] 跨合约信任：调用者能否伪造身份？
- [ ] 升级路径：旧 storage 与新逻辑兼容吗？

## 四、动态测试

```bash
# 单元测试
forge test                       # Foundry
npx hardhat test                 # Hardhat

# 模糊测试
echidna-test MyContract.sol
```

**关键不变量** (invariants) 写成属性测试，让模糊器在随机调用序列里反复尝试破坏：

```solidity
// invariant: totalSupply 始终等于所有 balance 之和
function echidna_supply_consistent() public view returns (bool) {
    uint256 sum = 0;
    for (uint i = 0; i < users.length; i++) {
        sum += balanceOf[users[i]];
    }
    return sum == totalSupply;
}
```

跑 10 万次都不出错才算 reasonable confidence。

## 五、形式化验证 (高价值合约)

对核心算法用 Certora、KEVM 等工具做**数学证明**：

```
// 性质: 提现金额不超过当前余额
∀ caller, amount:
  pre: balances[caller] >= amount
  post: balances[caller] == old(balances[caller]) - amount
```

工具会尝试穷举所有可能的输入组合证明性质成立，或给出反例。

不是所有项目都值得做形式化验证——成本高、需要专家、覆盖范围有限。但 DeFi 核心算法、跨链桥、可升级代理等地方值。

## 六、报告

一份审计报告至少包含：

- **执行摘要**：找了多少 critical / high / medium / low 问题
- **每个发现**：位置、危害、复现步骤、修复建议
- **威胁模型**：你假设了什么、没覆盖什么
- **复测结果**：项目方修复后回归测试是否通过

按 OWASP 或 ConsenSys 标准格式输出。

## 审计 ≠ 没有漏洞

**审计只能降低漏洞概率，不能消除**。即使顶级审计机构的客户也会被攻击：

- 经审计的协议被攻击：Wormhole、Nomad、Curve、Euler
- 原因：**业务逻辑组合**漏洞，每个组件单独看都没问题

防御策略要多层：

1. 多家审计公司独立审
2. 漏洞赏金计划 (Immunefi)
3. 上线后渐进升级 (慢慢加 TVL 上限)
4. 自动化监控 + 紧急熔断
5. 充足保险

## 下一节

「工具链：Slither / Mythril / Echidna」会带你实际跑这些工具，从输出中识别真问题与误报。
