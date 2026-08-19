import { parseAbi } from "viem";

export const nostosInstantPoolAbi = parseAbi([
  "function asset() view returns (address)",
  "function vault() view returns (address)",
  "function ticket() view returns (address)",
  "function liquidAssets() view returns (uint256)",
  "function outstandingFaceValue() view returns (uint256)",
  "function outstandingCostBasis() view returns (uint256)",
  "function realizedSpread() view returns (uint256)",
  "function utilizationBps() view returns (uint256)",
  "function positionCount() view returns (uint256)",
  "function getPricing() view returns (uint256 baseDiscountBps, uint256 utilizationSlopeBps, uint256 sizeSlopeBps, uint256 minDiscountBps, uint256 maxDiscountBps, uint256 maxUtilizationBps)",
  "function quoteTicket(uint256 ticketId) view returns (uint256 faceValue, uint256 amountOut, uint256 discountBps, uint256 utilizationBps, uint256 sizeRatioBps, uint256 postTradeUtilizationBps)",
  "function positions(uint256 ticketId) view returns (uint256 ticketId, uint256 requestId, address seller, uint256 faceValue, uint256 costBasis, uint256 discountBps, uint64 acquiredAt, uint64 settledAt, uint8 status)",
  "function sellTicket(uint256 ticketId, uint256 minAmountOut) returns (uint256)",
  "function harvest(uint256 ticketId) returns (uint256)",
  "function fund(uint256 amount)",
  "function withdrawLiquidity(uint256 amount)",
  "function setPricing(uint256 baseDiscountBps, uint256 utilizationSlopeBps, uint256 sizeSlopeBps, uint256 minDiscountBps, uint256 maxDiscountBps, uint256 maxUtilizationBps)",
]);
