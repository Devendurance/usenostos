// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface INostosRedemptionTicket {
    function vault() external view returns (address);

    function mint(address to, uint256 tokenId) external;

    function burn(uint256 tokenId) external;

    function isAuthorized(address spender, uint256 tokenId) external view returns (bool);
}
