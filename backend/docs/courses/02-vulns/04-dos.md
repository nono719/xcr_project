# 拒绝服务 (DoS) 攻击

**SWC-113** · 难度 ⭐⭐ · 平台案例 4

## 什么是合约 DoS

智能合约 DoS 不是流量攻击——它是让某个**关键函数永久失败**，导致合约功能瘫痪。资金可能没被偷，但也再也动不了。

## 模式一：依赖外部调用成功

```solidity
contract DoSWithRevert {
    address public king;
    uint256 public balance;

    function become() external payable {
        require(msg.value > balance, "low value");
        payable(king).transfer(balance);   // ❌ 必须 transfer 成功才能往下走
        king = msg.sender;
        balance = msg.value;
    }
}
```

任何前任 king 只要让自己的 receive revert，后续就没人能再 become。

## 攻击合约

```solidity
contract DoSGriefer {
    IDoS public target;
    constructor(address _t) { target = IDoS(_t); }

    function attack() external payable {
        target.become{value: msg.value}();   // 1) 成为 king
    }

    receive() external payable {              // 2) 拒绝再收 ETH
        revert("DoS: cannot accept ETH");
    }
}
```

合约一旦成为 king，再也没人能取代它——`become()` 会卡在 `payable(king).transfer(balance)` 一直 revert。

## 模式二：循环遍历不可控数组

```solidity
address[] public investors;

function payout() external onlyOwner {
    for (uint256 i = 0; i < investors.length; i++) {
        payable(investors[i]).transfer(balances[investors[i]]);
    }
}
```

攻击者用很多廉价地址 register，让 `investors.length` 大到 gas limit 装不下整个循环——`payout` 永远跑不完。

**防御**：用 pull-payment 模式，每人主动 withdraw 自己的份额，而非合约主动 push。

## 模式三：依赖某地址余额或 nonce

```solidity
function distribute() external {
    require(address(this).balance >= 100 ether);
    ...
}
```

如果合约设计依赖 `address(this).balance` 是整数，攻击者用 selfdestruct 强制塞钱进来（forced ETH transfer）就能破坏不变量。

**防御**：合约内部追踪 deposited 余额，不依赖 `address(this).balance`。

## 模式四：依赖时间或区块号

```solidity
require(block.timestamp >= unlockTime);
```

若 unlockTime 设错（如设到很远的将来），又没紧急退出机制，则合约功能被冻结。

## 防御原则

1. **Pull over push**：让用户主动来取，而非合约主动转账
2. **绝不依赖外部调用成功**：失败时也要能继续执行
3. **数组循环要有边界**：可被外界增长的数组绝不能整循环
4. **不变量靠内部计数**：不要相信 `balance`/`block.number` 等可被外部影响的量
5. **预留紧急退出**：高权限的 admin 函数能在异常时关闭非关键功能

## SafeBank 风格修复

```solidity
contract NoDoSKing {
    address public king;
    uint256 public balance;
    mapping(address => uint256) public pendingRefunds;

    function become() external payable {
        require(msg.value > balance, "low value");

        // ✅ 不再主动 push，把退款挂到 mapping
        pendingRefunds[king] += balance;

        king = msg.sender;
        balance = msg.value;
    }

    function withdrawRefund() external {
        uint256 amount = pendingRefunds[msg.sender];
        require(amount > 0, "nothing");
        pendingRefunds[msg.sender] = 0;
        (bool ok, ) = msg.sender.call{value: amount}("");
        require(ok, "send failed");
    }
}
```

即使前任 king 是恶意合约，他也只能让**自己**的退款卡住，不能阻塞其他人 become。

## 实战

进入 **拒绝服务 - king-of-the-hill** 实验，提交 `DoSGriefer.sol`，会看到：

```
后续 become() 调用全部被回滚，DoS 已激活
```

然后试试在 fix 模式提交一个 pull-payment 版本，看是否能挡住 griefer 的攻击。
