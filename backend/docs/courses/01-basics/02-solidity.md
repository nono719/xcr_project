# Solidity 语法基础

Solidity 是面向以太坊 EVM 的合约语言，语法接近 JavaScript / C++，但有几条独有约束。

## 文件结构

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract HelloBank {
    mapping(address => uint256) public balances;

    event Deposited(address indexed user, uint256 amount);

    function deposit() external payable {
        balances[msg.sender] += msg.value;
        emit Deposited(msg.sender, msg.value);
    }
}
```

- `pragma`：声明 Solidity 编译器版本
- `contract`：合约的基本单位，可继承
- `mapping`：键值对存储（无法遍历）
- `event`：在链上事件日志中写入一条记录

## 数据类型

| 类别 | 示例 |
|---|---|
| 值类型 | `uint256` `int256` `bool` `address` `bytes32` |
| 引用类型 | `string` `bytes` `array` `mapping` `struct` |
| 函数类型 | `function() external returns (uint)` |

> Solidity 0.8+ 默认对整数算术做溢出检查；如果你确实要绕过，必须包在 `unchecked { ... }` 里——这正是「整数溢出」漏洞的常见入口。

## 函数可见性

```solidity
function a() public { ... }     // 内外都能调用
function b() external { ... }   // 只能从合约外部调用 (msg.sender 必为外部)
function c() internal { ... }   // 当前合约 + 继承合约内部
function d() private { ... }    // 只有当前合约
```

**默认 public 是危险的**：审计中经常看到「忘记加 private」让任意人都能改关键状态。

## 状态可变性修饰

```solidity
function read() external view returns (uint256) { ... }   // 读但不写
function pure_calc() external pure returns (uint256) { ... } // 不读也不写
function pay() external payable { ... }                   // 接收 ETH
```

不加 `payable` 的函数收到 ETH 会回滚。

## msg / tx / block 全局变量

```solidity
msg.sender   // 当前调用者（合约或 EOA）
msg.value    // 调用附带的 wei
msg.data     // 完整 calldata

tx.origin    // 整笔交易最初的 EOA  ⚠️ 鉴权用它非常危险
tx.gasprice  // 交易 gas 价格

block.timestamp  // 区块时间 ⚠️ 矿工可微调
block.number     // 区块号
```

记住这条红线：**任何鉴权检查都应用 `msg.sender`，绝不要用 `tx.origin`**。

## 函数修饰器（modifier）

```solidity
modifier onlyOwner() {
    require(msg.sender == owner, "not owner");
    _;
}

function withdraw() external onlyOwner {
    payable(owner).transfer(address(this).balance);
}
```

修饰器把鉴权 / 重入锁 / 暂停开关等关注点分离。多个修饰器叠加时，**执行顺序按声明顺序从左到右**。

## 错误处理

```solidity
require(condition, "msg");   // 输入校验，回滚并返还 gas
assert(condition);           // 不变量校验，应永远为真（消耗所有 gas）
revert("reason");            // 主动回滚
revert MyError(x, y);        // 自定义错误（更省 gas）
```

## 下一步

把这些语法点放到脑里，看下一节课「EVM 与 Gas 机制」时会明白：**为什么 Solidity 强调可见性、为什么 Gas 限制催生了一些漏洞**。
