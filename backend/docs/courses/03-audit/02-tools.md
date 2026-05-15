# 工具链：Slither / Mythril / Echidna

三个最常用的开源审计工具，三种不同的检测策略。

## Slither —— 静态分析

由 Trail of Bits 开发，是审计师的"第一道扫描"。

### 安装与运行

```bash
pip install slither-analyzer

# 直接扫整个目录
slither .

# 只看高危
slither . --filter-paths "node_modules"

# 输出 markdown 报告
slither . --json slither.json
```

### 典型输出

```
Reentrancy in VulnerableBank.withdraw() (Bank.sol#10-15):
    External calls:
    - (ok, ) = msg.sender.call{value: amount}() (Bank.sol#13)
    State variables written after the call(s):
    - balances[msg.sender] = 0 (Bank.sol#14)
```

Slither 会把"先 call 后写状态"这种 pattern 直接标出来。

### 检测器分类

Slither 内置 100+ 检测器，按严重度：

| 等级 | 例子 |
|---|---|
| High | reentrancy-eth · uninitialized-state · arbitrary-send |
| Medium | tx-origin · timestamp · weak-prng |
| Low | unused-state · pragma · solc-version |
| Info | naming-convention · spdx |

### 优势 / 局限

- ✅ 几秒钟扫完整个项目
- ✅ 覆盖大部分已知 SWC pattern
- ❌ 业务逻辑漏洞看不到
- ❌ 误报率较高，需要人工筛

## Mythril —— 符号执行

ConsenSys 开发，用符号变量穷举执行路径。

### 安装与运行

```bash
pip install mythril
myth analyze MyContract.sol
```

或在 Docker 里跑：

```bash
docker run --rm -v $(pwd):/src mythril/myth analyze /src/MyContract.sol
```

### 工作原理

Mythril 把所有变量视为符号（symbolic），在 EVM 字节码上做路径探索。每条路径用 Z3 SMT 求解器判断"是否可达"。

```solidity
function withdraw(uint256 amount) external {
    require(amount < balance);
    payable(msg.sender).transfer(amount);
    balance -= amount;
}
```

Mythril 会发现：
- `amount = 0` 路径达可
- `amount = balance - 1` 路径达可
- `amount = balance` 路径不达 (require 失败)
- 在 `transfer` 处可能重入

### 优势 / 局限

- ✅ 能找出 Slither 看不到的深路径问题
- ✅ 给出具体的攻击 calldata
- ❌ 慢，可能跑几小时
- ❌ 状态爆炸（路径数量指数增长），复杂合约跑不完

## Echidna —— 模糊测试

也是 Trail of Bits 出品，基于属性的模糊测试器。

### 安装与运行

```bash
docker pull trailofbits/echidna
docker run --rm -v $(pwd):/src trailofbits/echidna /src/MyContract.sol
```

### 写"属性"

把不变量写成测试函数，前缀 `echidna_`：

```solidity
contract TestVault {
    Vault vault;
    constructor() { vault = new Vault(); }

    // 属性: 合约里的 ETH 余额永远等于内部账本之和
    function echidna_balance_consistent() public view returns (bool) {
        uint256 sum = 0;
        for (uint i = 0; i < users.length; i++) {
            sum += vault.balanceOf(users[i]);
        }
        return address(vault).balance >= sum;
    }
}
```

Echidna 会生成成千上万随机调用序列，**试图找出让属性返回 false 的反例**。

### 优势 / 局限

- ✅ 业务逻辑不变量的最强工具
- ✅ 找出多函数组合漏洞
- ❌ 需要人写属性 (写错就白测)
- ❌ 慢，建议过夜跑

## 三个工具的协作流程

```
开发期        → Slither (秒级反馈, 抓低垂果实)
PR 提交时    → Slither + Solhint 进 CI
合并前        → Mythril 跑核心函数
上线前        → Echidna 跑核心不变量过夜
上线后        → 定期回归扫描
```

## 商业工具

| 工具 | 厂商 | 特点 |
|---|---|---|
| **Certora** | Certora | 形式化验证, DeFi 协议常用 |
| **MythX** | ConsenSys | Mythril 的 SaaS 版本 |
| **Scribble** | ConsenSys | 用注解写不变量 |

商业工具的核心价值是**专家人工 + 工具结合的服务**，单纯按 license 价格买没什么意义。

## 上手建议

建议你课后：

1. 把平台上 5 个漏洞合约下载到本地
2. 装 Slither，跑一遍看输出
3. 对照「漏洞触发」一栏的链上事实，判断 Slither 哪些 finding 是真问题

这一步走完，你就理解了"工具检测出的"和"实际能被攻击的"的差距——这也是审计师的核心价值。
