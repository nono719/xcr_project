# 安全编码原则

## 1. Checks - Effects - Interactions

这是 Solidity 合约编码**最重要的一条**。任何涉及外部调用的函数，按这个顺序写：

```solidity
function withdraw() external {
    // Checks ─── 先校验所有前置条件
    uint256 amount = balances[msg.sender];
    require(amount > 0, "no balance");

    // Effects ── 再更新本合约的状态
    balances[msg.sender] = 0;

    // Interactions ─── 最后做外部调用
    (bool ok, ) = msg.sender.call{value: amount}("");
    require(ok, "send failed");
}
```

**为什么**：外部调用可能触发对方合约的代码，对方代码可能反过来再调用你（重入）。如果你先转账后清零，攻击者就能在 fallback 里**反复调用 withdraw** 把余额耗尽。

## 2. 永远 require 输入

```solidity
function transfer(address to, uint256 amount) external {
    require(to != address(0), "zero address");
    require(amount > 0, "zero amount");
    require(balanceOf[msg.sender] >= amount, "insufficient");
    ...
}
```

零地址转账、零金额、超额——这些边界用 require 卡住，免得后续状态变成"奇怪"。

## 3. 最小权限原则

```solidity
modifier onlyOwner() { require(msg.sender == owner, "not owner"); _; }

// ❌ 把整个升级权给单一 EOA
function upgrade(address impl) external onlyOwner { ... }

// ✅ 用多签 / 时间锁 / 治理投票
function upgrade(address impl) external onlyMultisig timelock(2 days) { ... }
```

把高危函数的执行门槛拉高：多签 + 时间锁。

## 4. 不要用 tx.origin 鉴权

```solidity
// ❌ 钓鱼合约可绕过
require(tx.origin == owner, "not owner");

// ✅ 直接看 msg.sender
require(msg.sender == owner, "not owner");
```

tx.origin 是**整条调用链最初的 EOA**，在嵌套调用里依然指向 owner——攻击者只需骗 owner 调用一个钓鱼合约，钓鱼合约里再调你的函数即可绕过。

## 5. 算术显式可见

Solidity 0.8+ 已默认溢出 revert，但 `unchecked` 块绕过这道保险：

```solidity
function transfer(address to, uint256 amount) external {
    unchecked {           // ❌ 危险：除非你确实证明永不溢出
        balances[msg.sender] -= amount;
        balances[to] += amount;
    }
}
```

只有在**数学上可证明不会溢出**且 gas 成本敏感时才用 unchecked。

## 6. 返回值必须 check

```solidity
// ❌ 忽略 call 返回值
to.call{value: 1 ether}("");

// ✅ 检查 ok
(bool ok, ) = to.call{value: 1 ether}("");
require(ok, "send failed");
```

低层 `call` 永远不抛异常，只返回 bool。忘记检查就是一个静默失败的入口。

## 7. 用 OpenZeppelin 的成熟组件

```solidity
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract MyToken is ERC20, Ownable, ReentrancyGuard {
    function mint(address to, uint256 amount) external onlyOwner nonReentrant {
        _mint(to, amount);
    }
}
```

OpenZeppelin 库经过广泛审计：ERC20、Ownable、ReentrancyGuard、SafeERC20、Pausable……能用现成的就别自己写。

## 8. 事件留痕

```solidity
event Withdrawn(address indexed user, uint256 amount);

function withdraw() external {
    ...
    emit Withdrawn(msg.sender, amount);
}
```

事件不是装饰品——出现安全事件时，**链上事件日志是唯一可靠的取证依据**。

## 9. 升级要慎重

```solidity
// 透明代理 + 时间锁 + 多签
TimelockController timelock;     // 2-day delay
TransparentUpgradeableProxy proxy(impl, address(timelock), data);
```

如果合约需要升级，使用成熟代理模式（Transparent / UUPS / Beacon），并把代理 admin 交给时间锁。**永远不要让单一 EOA 拥有立即升级权限**。

## 10. 写完就跑工具

```bash
# 静态分析
slither .

# 符号执行
mythril analyze MyContract.sol

# 模糊测试
echidna-test MyContract.sol --config echidna.yaml
```

这些会在「审计与防御实战」课程详细讲。开发期间养成"写完即跑工具"的习惯。

## 下一节

「经典攻击案例」会用真实事件演示这些原则**被违反时会发生什么**——The DAO、Parity、Poly Network。
