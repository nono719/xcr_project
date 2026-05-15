# 安全设计模式

把前面学到的原则归纳成可重用的设计模式，写新合约时直接套用。

## 1. Checks-Effects-Interactions

最重要的模式，已在「重入攻击」详细讲。任何外部调用前必须完成状态更新。

```solidity
function action() external {
    // Checks
    require(condition);
    // Effects
    state = newValue;
    // Interactions
    externalContract.call(...);
}
```

## 2. Pull Over Push

**让用户主动取**，而非合约主动发。

```solidity
// ❌ Push 模式
function airdrop(address[] memory users) external {
    for (uint i = 0; i < users.length; i++) {
        payable(users[i]).transfer(amount);   // 任一失败全部回滚
    }
}

// ✅ Pull 模式
mapping(address => uint256) public claimable;
function setAirdrop(address[] memory users) external {
    for (uint i = 0; i < users.length; i++) {
        claimable[users[i]] += amount;
    }
}
function claim() external {
    uint256 amount = claimable[msg.sender];
    claimable[msg.sender] = 0;
    payable(msg.sender).transfer(amount);
}
```

避免「一个坏地址卡死所有人」。

## 3. ReentrancyGuard

OpenZeppelin 的标准实现，给所有调用外部合约的函数加 `nonReentrant`：

```solidity
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract MyVault is ReentrancyGuard {
    function withdraw() external nonReentrant {
        // 即使在这里被重入也会 revert
    }
}
```

## 4. Circuit Breaker (Pausable)

紧急情况能关掉关键函数：

```solidity
import "@openzeppelin/contracts/security/Pausable.sol";

contract MyToken is Pausable {
    function transfer(address to, uint256 amt) public whenNotPaused {
        ...
    }

    function emergencyPause() external onlyOwner {
        _pause();   // 只关 transfer, 不影响 withdraw 等
    }
}
```

注意区分**全局暂停**和**单功能暂停**——别一刀切把所有功能都关掉，那样用户的资金也取不出。

## 5. Withdraw Pattern

提现总是单独的函数，并且：

- 单次提现额度有上限
- 大额提现走时间锁
- 失败时余额自动归还到 pendingRefunds

## 6. Rate Limiting

```solidity
mapping(address => uint256) public lastAction;
uint256 public constant COOLDOWN = 1 hours;

modifier cooldown() {
    require(block.timestamp >= lastAction[msg.sender] + COOLDOWN, "wait");
    lastAction[msg.sender] = block.timestamp;
    _;
}

function claim() external cooldown { ... }
```

防止机器人在一个区块里重复触发关键操作。

## 7. Multi-Signature for Privileged Actions

```solidity
// 高危函数只能通过多签合约调用
modifier onlyMultisig() {
    require(msg.sender == MULTISIG_ADDRESS, "not multisig");
    _;
}

function upgrade(address newImpl) external onlyMultisig {
    ...
}
```

配合 Gnosis Safe / Safe{Wallet}，需要 N/M 签名才能执行。

## 8. Timelock

高危操作不立即生效，先 schedule 再 execute：

```solidity
import "@openzeppelin/contracts/governance/TimelockController.sol";

// 用户提出 → schedule → 等 2 天 → execute
timelock.schedule(target, value, data, predecessor, salt, delay);
... 2 days later ...
timelock.execute(target, value, data, predecessor, salt);
```

即使 admin 私钥被偷，攻击者也得等 2 天，社区有窗口紧急取消。

## 9. Two-Step Ownership Transfer

```solidity
// ❌ 一步走，错地址直接锁死合约
function transferOwnership(address newOwner) external onlyOwner {
    owner = newOwner;
}

// ✅ 两步：先 propose, 再 accept
address public pendingOwner;
function transferOwnership(address newOwner) external onlyOwner {
    pendingOwner = newOwner;
}
function acceptOwnership() external {
    require(msg.sender == pendingOwner);
    owner = pendingOwner;
    pendingOwner = address(0);
}
```

OpenZeppelin 的 `Ownable2Step` 就是这个模式。

## 10. Proxy Patterns (Upgradeable Contracts)

需要升级时不要从头自己写，用：

- **Transparent Proxy** (OZ TransparentUpgradeableProxy)
- **UUPS** (Upgradeable via implementation)
- **Beacon Proxy** (多合约共享同一逻辑)

注意 **storage layout 兼容性**：升级新版本不能改变旧版本 storage 槽的语义。

```
struct Storage {
    uint256 totalSupply;     // slot 0
    mapping(address => uint256) balanceOf;  // slot 1
    // ⚠️ 新增字段只能 append, 不能在中间插入
    uint256 newField;        // slot 2 (新加的)
}
```

## 11. Oracle Pattern

价格、随机数等外部数据用经过认证的 oracle：

```solidity
import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";

AggregatorV3Interface internal priceFeed = AggregatorV3Interface(0x...);

function getPrice() public view returns (int) {
    (, int price, , uint timestamp, ) = priceFeed.latestRoundData();
    require(block.timestamp - timestamp < 1 hours, "stale");
    return price;
}
```

注意：

- 时间新鲜度检查
- 备用 oracle 兜底
- 价格异动熔断

## 12. Singleton State

```solidity
// ❌ 复杂逻辑分散在多个合约，状态不一致风险
contract A { uint256 public x; }
contract B { uint256 public x; }   // 重复存储 → 状态不同步

// ✅ 共享同一状态存储
contract Storage {
    uint256 public x;
}
contract A {
    Storage public s;
    function read() external view returns (uint256) { return s.x(); }
}
```

DeFi 协议常用 Diamond 模式把所有 facets 共享一份 storage。

## 这些模式 ≠ 万灵药

模式是脚手架，但**业务逻辑安全永远需要自己想清楚**。最危险的漏洞往往出现在"我以为某个不变量永远成立"的盲点处——所以审计的终极武器是**反复挑战自己的假设**。

下一节「上线前 checklist」会把这些模式落到一份可执行的清单上。
