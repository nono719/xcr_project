# 经典攻击案例

## 1. The DAO (2016) —— 重入攻击

**损失**：约 360 万 ETH（当时 ~$60M）
**根因**：splitDAO 函数先转账后扣余额

```solidity
function splitDAO(...) {
    uint256 reward = ...;
    msg.sender.call.value(reward)();   // ❌ 先转账
    balances[msg.sender] -= reward;     // ❌ 后扣
}
```

攻击者在 fallback 里反复 splitDAO，把 1/3 的 DAO 资金抽走。
**后续影响**：以太坊社区为此硬分叉成 ETH 和 ETC。

> 历史地位：智能合约安全的"原点事件"。促成 Checks-Effects-Interactions 模式与 ReentrancyGuard 的诞生。

## 2. Parity Multisig (2017) —— 委托调用 + 未初始化

**损失**：约 51.4 万 ETH 永久冻结（~$150M）

Parity 多签钱包用一份共享 library 合约（Wallet Library）持有所有逻辑，每个用户钱包通过 delegatecall 调用 library。问题是这份 library 的 `initWallet()` **没标 internal**，任何人都可以直接调用并把自己设为 owner，然后调 `kill()` 把 library 自杀。

```solidity
function initWallet(address[] _owners) {  // ❌ 缺少访问控制
    m_numOwners = _owners.length + 1;
    m_owners[1] = uint(msg.sender);
    ...
}

function kill(address _to) onlyowner {
    suicide(_to);
}
```

一旦 library 被 selfdestruct，所有依赖它的钱包都立即失能——里面的资金永久锁死。

**教训**：library 必须把所有"应该是构造函数"的逻辑放进 internal/private，或者根本不要让 library 持有状态。

## 3. Poly Network (2021) —— 权限校验漏洞

**损失**：约 $610M（创纪录，但攻击者后续归还）

跨链桥 Poly Network 的 EthCrossChainManager 合约用 `keeper` 角色控制资产释放。攻击者发现可以构造一笔特殊调用，**让合约把自己设为 keeper**：

```solidity
function verifyHeaderAndExecuteTx(bytes memory rawHeader, ...) {
    ...
    // 内部调用允许目标合约是 EthCrossChainData
    _executeCrossChainTx(toContract, method, args);
}
```

通过精心构造 `method` 字符串，攻击者诱导合约调用了 `EthCrossChainData.putCurEpochConPubKeyBytes()`，重置 keeper 集合，然后随意提取所有资产。

**教训**：跨合约调用要在内部白名单中校验**调用目标 + 方法**，不能允许任意 (contract, selector) 组合。

## 4. Ronin Bridge (2022) —— 私钥泄露

**损失**：约 $620M

Axie Infinity 的 Ronin 侧链用 9 个验证节点中的 5 个签名即可放行提现。攻击者通过社工钓鱼攻击拿到了 Sky Mavis 控制的 4 把验证私钥，又利用一个被遗忘的"开放的 RPC 节点"获得了第 5 把私钥。

```
9 个验证人  →  5/9 多签放行
攻击者: 4 (社工) + 1 (开放 RPC) = 5
```

**教训**：

- 多签门槛 5/9 远远不够（应至少 8/12，且签名方相互独立）
- "临时开放"的访问权限必须有自动过期机制
- 验证人节点的运维隔离至关重要

## 5. Wormhole (2022) —— 签名校验绕过

**损失**：120,000 wETH（~$325M）

Wormhole 的 verify_signatures 函数没正确校验签名者集合，攻击者用一个伪造的 "guardian set" 蒙混过去：

```solidity
function verify_signatures(bytes memory data, ...) {
    Structs.GuardianSet memory gs = ...;
    require(verifyVAA(gs, data), "...");
    // ❌ 没有校验 gs.index 是否是 currentGuardianSetIndex
}
```

攻击者伪造一份 guardian set，让合约相信"已签名"，然后铸造了 12 万 wETH。

**教训**：跨链桥的 guardian / validator 集合必须用最新的 epoch index 校验，且不能由调用方提供。

## 共通规律

5 个事件的根因可归纳为：

| 类别 | 案例 |
|---|---|
| 调用顺序错（先转后扣） | The DAO |
| 权限缺失（默认可见性） | Parity |
| 跨合约信任过宽 | Poly Network |
| 链下私钥管理崩盘 | Ronin |
| 签名/签名集校验不严 | Wormhole |

每一类都对应一条编码原则。下一门课程「五大漏洞深度剖析」会带你**亲手在沙箱中复现**前 3 类，并写防御版。
