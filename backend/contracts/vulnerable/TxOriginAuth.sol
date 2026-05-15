// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title TxOriginAuth - 使用 tx.origin 鉴权的钱包 (SWC-115)
contract TxOriginAuth {
    address public owner;

    constructor() { owner = msg.sender; }

    function transfer(address payable to, uint256 amount) external {
        // ❌ tx.origin 可被钓鱼合约绕过
        require(tx.origin == owner, "not owner");
        to.transfer(amount);
    }

    receive() external payable {}
}
