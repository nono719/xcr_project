// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title FrontRunnableAuction - 抢先交易示例 (SWC-114)
/// 公开 mempool 中的 reveal 调用可被矿工/搜寻者抢先打包
contract FrontRunnableAuction {
    address public highestBidder;
    uint256 public highestBid;
    bytes32 public secretHash;

    constructor(bytes32 _secretHash) {
        secretHash = _secretHash;
    }

    function bid(string calldata secret) external payable {
        require(keccak256(bytes(secret)) == secretHash, "wrong secret");
        require(msg.value > highestBid, "low bid");
        if (highestBidder != address(0)) {
            payable(highestBidder).transfer(highestBid);
        }
        highestBidder = msg.sender;
        highestBid = msg.value;
    }
}
