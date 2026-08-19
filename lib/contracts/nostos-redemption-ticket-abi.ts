import { parseAbi } from "viem";

export const nostosRedemptionTicketAbi = parseAbi([
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function vault() view returns (address)",
  "function balanceOf(address owner) view returns (uint256)",
  "function ownerOf(uint256 tokenId) view returns (address)",
  "function getApproved(uint256 tokenId) view returns (address)",
  "function isApprovedForAll(address owner, address operator) view returns (bool)",
  "function isAuthorized(address spender, uint256 tokenId) view returns (bool)",
  "function approve(address to, uint256 tokenId)",
  "function setApprovalForAll(address operator, bool approved)",
  "function safeTransferFrom(address from, address to, uint256 tokenId)",
  "function supportsInterface(bytes4 interfaceId) view returns (bool)",
]);
