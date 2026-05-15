// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title DoSWithRevert - 拒绝服务漏洞 (SWC-113)
/// 把 ETH 通过 transfer 退回前一个出价者，若对方是恶意合约则会 revert，造成永远无法再下一个更高价
contract DoSWithRevert {
    address public king;
    uint256 public balance;

    function become() external payable {
        require(msg.value > balance, "low value");
        payable(king).transfer(balance); // ❌ 对恶意合约会 revert
        king = msg.sender;
        balance = msg.value;
    }
}
