# 上线前 Checklist

合约上主网前的一份「最低安全标准」清单。**全部打勾再部署**。

## 编译与版本

- [ ] 使用最新稳定版 Solidity（≥ 0.8.20）
- [ ] `pragma solidity ^0.8.x` 而非 `>=` 范围（避免被高版本编译时引入未测过的行为）
- [ ] 编译警告全部清零
- [ ] 没有 `console.log` / debug 调用残留

## 函数可见性与访问控制

- [ ] 每个函数都显式标注可见性（不依赖默认）
- [ ] 关键状态修改函数都有 onlyOwner / onlyRole 修饰器
- [ ] **没有任何鉴权用 tx.origin**
- [ ] owner 转移走两步流程（Ownable2Step）
- [ ] 管理员函数最终交给多签 + 时间锁

## 重入与状态

- [ ] 所有外部调用之前已完成本合约状态更新（Checks-Effects-Interactions）
- [ ] 含 ETH 转账或外部 call 的函数加 `nonReentrant`
- [ ] 不依赖 `address(this).balance` 做不变量校验
- [ ] 跨合约 mutual 调用经过审查

## 算术

- [ ] 无 `unchecked` 块（除非数学已证明安全）
- [ ] 除法注意精度（先乘后除）
- [ ] 任何加法/乘法操作可以承受边界值（type(uint256).max）

## 外部调用

- [ ] 所有 low-level `call` 检查返回值
- [ ] 外部代币转账用 SafeERC20 而非裸 transfer
- [ ] delegatecall 的目标合约**严格白名单**
- [ ] 不允许任意 (target, selector) 组合调用

## 输入校验

- [ ] 地址参数 require 不为 zero address
- [ ] 数量/金额参数有上下限
- [ ] 数组参数有长度上限（防 gas DoS）
- [ ] 字符串/bytes 编码前的长度检查

## ETH 处理

- [ ] 接收 ETH 的函数标 payable
- [ ] 没有意外的 ETH 入口（receive/fallback 都明确意图）
- [ ] withdrawal 用 pull pattern 而非 push
- [ ] 用 call 而非 transfer/send

## 事件

- [ ] 所有状态变化都 emit 事件
- [ ] indexed 关键字段（地址、ID）方便链下索引
- [ ] event 名字描述具体动作（Withdrawn, Minted, Liquidated）

## 升级与治理

- [ ] 升级用透明代理 / UUPS（不是手动写）
- [ ] 升级 admin 是 timelock + 多签
- [ ] storage layout 文档化（每个 slot 的语义）
- [ ] 紧急 pause 机制存在且与升级路径独立

## 测试覆盖

- [ ] 单元测试覆盖率 ≥ 90%
- [ ] 每个 require / revert 路径都有专门测试
- [ ] 关键不变量用 Echidna fuzz 跑过 10 万次
- [ ] 多函数组合 attack scenario 都跑过

## 工具扫描

- [ ] Slither 输出 high/medium 都已 review
- [ ] Mythril 跑过核心函数
- [ ] 至少一家独立审计公司出过报告
- [ ] 公开 bug bounty (Immunefi)

## 部署

- [ ] 部署脚本 review 过（避免 owner 设错地址）
- [ ] 部署后立刻 verify 源码到 Etherscan
- [ ] 部署后立刻把 owner 转给 multisig
- [ ] 部署后保留 30 分钟观察期再启用主要功能

## 上线后

- [ ] 监控告警（TVL 异常下降、巨额转账、function 调用激增）
- [ ] 应急响应流程（谁能 pause、按什么顺序）
- [ ] 资金保险（Nexus Mutual / InsurAce）
- [ ] 用户教育（README 写清楚不变量与风险）

## 红线 (必须满足)

如果以下任一项不通过，**不能上线**：

| 红线 | 说明 |
|---|---|
| 资金可被任意提走 | 没鉴权或鉴权可绕过 |
| owner 单一 EOA | 私钥泄露 = 项目结束 |
| 无紧急暂停 | 漏洞曝光后无法止损 |
| 升级权限无 timelock | 攻击者可秒级升级到恶意逻辑 |
| 关键函数无事件 | 无法链下监控 |

## 推荐工作流

```
开发  → 单元测试覆盖到 90%
   ↓
PR    → Slither + Solhint CI 检查
   ↓
合并  → Mythril 跑核心 (CI 跑长任务)
   ↓
分支稳定 → Echidna 过夜模糊
   ↓
内部 review → 团队 walkthrough
   ↓
外部审计 → 修复 + 复测
   ↓
小额测试网 → 至少 1 周
   ↓
主网 + 多签 + timelock + bug bounty
   ↓
渐进上调 TVL 上限 (1M → 10M → 100M)
   ↓
监控 + 持续审计
```

## 一句话总结

**永远假设你自己写的代码有漏洞**。审计、测试、保险、监控、紧急响应——每一层都是给未来的自己留一条后路。

经过这门课后，你已经具备了基础的合约安全意识——但安全是个持续修炼的领域，建议关注 [rekt.news](https://rekt.news)、Trail of Bits Blog、OpenZeppelin Forum，跟踪每一次新的真实事件。
