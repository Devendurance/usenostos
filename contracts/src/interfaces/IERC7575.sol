// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice ERC-7575 minimal interface: the share token address.
interface IERC7575 {
    function share() external view returns (address);
}