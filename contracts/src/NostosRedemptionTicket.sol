// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {INostosRedemptionTicket} from "./interfaces/INostosRedemptionTicket.sol";

/// @notice Transferable claim ticket for a Nostos asynchronous redemption.
/// The bound vault is the only account that can create or destroy tickets.
contract NostosRedemptionTicket is ERC721, INostosRedemptionTicket {
    error OnlyVault();

    address public immutable vault;

    constructor(address vault_) ERC721("Nostos Redemption Claim Ticket", "NOSTOS-CLAIM") {
        require(vault_ != address(0), "NostosRedemptionTicket: zero vault");
        vault = vault_;
    }

    function mint(address to, uint256 tokenId) external override {
        if (msg.sender != vault) revert OnlyVault();
        _safeMint(to, tokenId);
    }

    function burn(uint256 tokenId) external override {
        if (msg.sender != vault) revert OnlyVault();
        _burn(tokenId);
    }

    function isAuthorized(address spender, uint256 tokenId) external view override returns (bool) {
        address owner = ownerOf(tokenId);
        return spender != address(0)
            && (spender == owner || getApproved(tokenId) == spender || isApprovedForAll(owner, spender));
    }
}
