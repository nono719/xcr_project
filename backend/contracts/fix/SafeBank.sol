// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title SafeBank - 重入漏洞的修复示例 (Checks-Effects-Interactions + 互斥锁)
contract SafeBank {
    mapping(address => uint256) public balances;
    bool private locked;

    modifier nonReentrant() {
        require(!locked, "reentrant");
        locked = true;
        _;
        locked = false;
    }

    function deposit() external payable {
        balances[msg.sender] += msg.value;
    }

    function withdraw() external nonReentrant {
        uint256 amount = balances[msg.sender];
        require(amount > 0, "no balance");
        // ✅ 先清零，再转账
        balances[msg.sender] = 0;
        (bool ok, ) = msg.sender.call{value: amount}("");
        require(ok, "send failed");
    }
}
