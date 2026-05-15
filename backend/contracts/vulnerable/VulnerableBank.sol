// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title VulnerableBank - 重入漏洞示例 (SWC-107)
/// 漏洞点: withdraw() 先把以太币发送出去，再更新 balances，可被攻击者递归提现
contract VulnerableBank {
    mapping(address => uint256) public balances;

    function deposit() external payable {
        balances[msg.sender] += msg.value;
    }

    function withdraw() external {
        uint256 amount = balances[msg.sender];
        require(amount > 0, "no balance");
        // ❌ 先转账后清零，给了重入机会
        (bool ok, ) = msg.sender.call{value: amount}("");
        require(ok, "send failed");
        balances[msg.sender] = 0;
    }

    receive() external payable {}
}
