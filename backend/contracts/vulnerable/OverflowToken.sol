// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title OverflowToken - 整数溢出示例 (SWC-101)
/// 注意: Solidity ^0.8 默认开启 SafeMath 校验，这里使用 unchecked 故意绕过，模拟旧版漏洞
contract OverflowToken {
    mapping(address => uint256) public balanceOf;
    uint256 public totalSupply;

    function mint(uint256 amount) external {
        unchecked {
            balanceOf[msg.sender] += amount;
            totalSupply += amount;
        }
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        unchecked {
            balanceOf[msg.sender] -= amount;
            balanceOf[to] += amount;
        }
        return true;
    }

    function batchTransfer(address[] calldata recipients, uint256 amount) external returns (bool) {
        uint256 cnt = recipients.length;
        unchecked {
            uint256 total = amount * cnt; // ❌ 乘法溢出 → total 可能变成 0
            require(balanceOf[msg.sender] >= total, "insufficient");
            balanceOf[msg.sender] -= total;
            for (uint256 i = 0; i < cnt; i++) {
                balanceOf[recipients[i]] += amount;
            }
        }
        return true;
    }
}
