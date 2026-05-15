# 抢先交易与 MEV

**SWC-114** · 难度 ⭐⭐ · 平台案例 3

## Mempool 是公开的

用户签好的交易并不直接进入区块——它先被广播到**全网公开的内存池 (mempool)**，等矿工/搜寻者打包。任何人都能监听这些 pending 交易：

```
用户 → 钱包签名 → mempool (公开!) → 矿工打包 → 入链
```

**搜寻者**（searcher）的工作就是从 mempool 里挑选可获利的交易序列，用更高 gas 价让矿工先打包自己的交易。

## 抢先交易 (Front-running)

经典场景：

1. 用户 A 发现某 DEX 上 ETH/USDC 价差套利机会，发交易买入 1000 ETH
2. 该交易在 mempool 中可见
3. 搜寻者 B 复制 A 的交易，用 10× gas price 抢先发出
4. B 的交易先成交，吃掉低价；A 的交易随后成交但价格已涨
5. B 立即反向卖出，套走 A 本该挣的利润

## 三明治攻击 (Sandwich)

更狠的玩法：搜寻者在用户买单**前**和**后**各塞一笔交易：

```
B 买入 (低价) → A 买入 (推高价格) → B 卖出 (高价)
       前置         受害              后置
```

搜寻者无需自有资金，可用闪贷在一笔交易里完成。

## FrontRunnableAuction 示例

平台案例 3 中的密封拍卖：

```solidity
contract FrontRunnableAuction {
    address public highestBidder;
    uint256 public highestBid;
    bytes32 public secretHash;

    function bid(string calldata secret) external payable {
        require(keccak256(bytes(secret)) == secretHash, "wrong secret");
        require(msg.value > highestBid, "low bid");

        if (highestBidder != address(0)) {
            payable(highestBidder).transfer(highestBid);
        }
        highestBidder = msg.sender;
        highestBid = msg.value;
    }
}
```

虽然名字叫"密封"，但 secret **以明文出现在 calldata** ——一旦真用户在 mempool 里调用 bid("topsecret")，搜寻者复制 secret 并用更高 gas + 更高出价抢先打包即可。

攻击合约（已在平台模板中）：

```solidity
contract FrontRunner {
    IAuction public auction;
    string public secret = "topsecret";   // 从 mempool 偷来的

    function attack() external payable {
        auction.bid{value: msg.value}(secret);   // 抢先打包
    }
}
```

## 防御一：提交-揭示模式 (Commit-Reveal)

```solidity
mapping(address => bytes32) public commits;

// 第一步：链上提交承诺（哈希）
function commit(bytes32 hash) external {
    commits[msg.sender] = hash;
}

// 第二步：揭示原始值
function reveal(uint256 bid, bytes32 salt) external payable {
    require(commits[msg.sender] == keccak256(abi.encode(bid, salt, msg.sender)));
    require(msg.value == bid, "value mismatch");
    ...
}
```

两阶段后，攻击者在 commit 阶段不知道你的出价，无法抢跑；reveal 阶段虽然能看到价但已无意义。

## 防御二：批量结算 (Batching)

```solidity
// 一个时段内所有 bid 都汇集，到结算窗口才一次性公布最高出价
mapping(uint256 => Bid[]) public bidsByEpoch;
function settle(uint256 epoch) external { ... }
```

很多 DEX 用频繁批量拍卖 (Frequent Batch Auction) 抹平时序优势。

## 防御三：私有 mempool

Flashbots、MEV-Share 等服务允许交易通过私有通道直接发给搜寻者/矿工，绕过公开 mempool。用户付一定隐私费换取免被抢跑。

## 防御四：链下匹配

订单簿 DEX（如 dYdX v3）的撮合在链下完成，链上只 settle 结果。攻击者拿不到未撮合的订单，自然无法抢跑。

## MEV 的灰色地带

并非所有 MEV 都是恶意：

| 类型 | 性质 |
|---|---|
| 三明治用户 | 恶意 |
| 套利同一资产跨 DEX 价差 | 中性 (有助于价格收敛) |
| 清算濒临违约的借贷头寸 | 正面 (维护协议偿付能力) |

社区在持续研究如何把 MEV "民主化"或"分配回用户"。

## 实战

进入 **抢先交易 - 密封拍卖** 实验，提交 `FrontRunner.sol`，能看到：

```
学生合约成功成为最高出价者：0x840558088A1f8975839523E92c4d7EFA447DBED7
```

理解为什么 secret 一旦放进 calldata 就毫无机密性可言。
