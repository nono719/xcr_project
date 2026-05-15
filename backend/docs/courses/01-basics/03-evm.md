# EVM 与 Gas 机制

理解 EVM（以太坊虚拟机）的运行模型，是看懂漏洞利用的前提。

## EVM 执行模型

EVM 是一个**栈式虚拟机**，每条交易触发一段确定性计算。三类存储区域要分清：

| 区域 | 持久性 | Gas 成本 | 用途 |
|---|---|---|---|
| **storage** | 永久存链 | 极贵 (20000 gas/slot 写入) | 状态变量 |
| **memory** | 调用期间临时 | 中等 | 函数局部变量 |
| **calldata** | 调用入口的输入 | 最便宜，只读 | 函数参数 |
| **stack** | 1024 深度 | 几乎免费 | 中间值 |

存储槽 slot：每个 storage 变量按 32 字节槽顺序排布，紧凑型变量会被打包。这点在「**存储冲突**」「**代理合约**」漏洞里很关键。

## Gas 三大原则

1. **每条指令都消耗 gas**——例如 `SSTORE` 写一个新值 20000 gas，覆盖已有非零值 5000 gas
2. **调用者预付 gas**——`gasLimit × gasPrice` 在 tx 一开始就锁定
3. **未用完的 gas 返还**，但**回滚也消耗 gas**（即使最终交易失败）

漏洞与 gas 的关系：

- 内部 `transfer` 默认仅转发 **2300 gas**，对方做不了什么——曾被认为是"重入安全锁"，但 Istanbul 升级后这一假设失效，于是 Checks-Effects-Interactions 才成为标准
- 攻击者可故意构造让 victim 的 fallback **耗光所有 gas 然后回滚**，造成拒绝服务
- 部分批量函数（如 `batchTransfer`）若把整笔 gas 消耗放在循环里，会随输入规模放大

## 三种发送 ETH 的方式

```solidity
// 1. transfer: 失败抛异常, 转发 2300 gas
payable(to).transfer(amount);

// 2. send: 失败返回 false, 转发 2300 gas
bool ok = payable(to).send(amount);

// 3. call: 失败返回 false, 转发剩余全部 gas (最灵活, 也最容易出问题)
(bool ok, ) = to.call{value: amount}("");
require(ok, "send failed");
```

`call` 是目前推荐方式（伊斯坦堡升级后 gas 成本不稳定，transfer 可能不够），但配合 Checks-Effects-Interactions 才安全——这一点会在「重入攻击」模块详细讲。

## 状态可变性与 EVM 操作码

| 操作码 | 行为 |
|---|---|
| `CALL` | 普通调用，附带 ETH |
| `STATICCALL` | view/pure 函数调用，禁止改状态 |
| `DELEGATECALL` | **在调用者的上下文执行被调用者的代码**——代理合约核心，也是 Parity 多签 1.5 亿美元被烧的根因 |
| `SELFDESTRUCT` | 销毁合约并把余额转给指定地址（已被 EIP-6780 限制） |

## 交易生命周期

```
用户签名交易
  ↓
进入 mempool (公开广播!)        ◄── 抢先交易/MEV 在这里发生
  ↓
矿工/搜寻者排序、打包
  ↓
EVM 顺序执行交易
  ↓
区块产出, 状态根更新
```

**记住：mempool 是公开的**。任何依赖"对方先不知道我的输入"的合约设计，都可能被搜寻者抢跑——「抢先交易」模块会展示如何利用。

## 编译输出

```
solc 源码 → ABI (函数接口描述) + Bytecode (字节码) + Metadata
```

前端通过 ABI 知道如何编码函数调用；EVM 执行 bytecode。本平台的「编译合约」按钮会调用 solc 0.8.20，并指定 `evmVersion=paris` 以兼容 Ganache GUI（不支持 Shanghai 的 PUSH0 操作码）。
