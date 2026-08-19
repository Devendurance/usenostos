"use client";

import { useAccount, useReadContract } from "wagmi";
import { deployedTestnet } from "@/lib/chain/deployed-addresses";
import { FRONTEND_POLICY } from "@/lib/chain/frontend-policy";
import { useBotNetwork } from "@/lib/chain/frontend-hooks";
import {
  useTicketedVault,
  type TicketRequestStatus,
} from "@/lib/chain/ticketed-vault-hooks";
import { nostosInstantPoolP6Abi } from "@/lib/contracts/nostos-instant-pool-p6-abi";
import { nostosAsyncVaultP4Abi } from "@/lib/contracts/nostos-async-vault-p4-abi";
import { nostosRedemptionTicketAbi } from "@/lib/contracts/nostos-redemption-ticket-abi";

const ZERO = BigInt(0);
const POOL_ADDRESS = deployedTestnet.p6?.instantPool as `0x${string}` | undefined;

export interface PoolQuote {
  faceValue: bigint;
  amountOut: bigint;
  discountBps: bigint;
  utilizationBps: bigint;
  sizeRatioBps: bigint;
  postTradeUtilizationBps: bigint;
}

export interface EligiblePendingTicket {
  ticketId: bigint;
  faceValue: bigint | undefined;
  quote: PoolQuote | undefined;
  quoteError: string | undefined;
}

export type LpRedeemBlockReason = "cooldown" | "no-liquidity" | "zero-shares" | "unknown";

export function mapQuoteTicket(raw: readonly unknown[] | undefined): PoolQuote | undefined {
  if (!raw) return undefined;
  return {
    faceValue: raw[0] as bigint,
    amountOut: raw[1] as bigint,
    discountBps: raw[2] as bigint,
    utilizationBps: raw[3] as bigint,
    sizeRatioBps: raw[4] as bigint,
    postTradeUtilizationBps: raw[5] as bigint,
  };
}

export function formatWithdrawalUnlockAt(unlockAt: bigint | undefined): string | undefined {
  if (unlockAt === undefined || unlockAt === ZERO) return undefined;
  const millis = Number(unlockAt) * 1000;
  if (!Number.isFinite(millis)) return undefined;
  return new Date(millis).toISOString();
}

export function resolveLpRedeemAvailability(input: {
  unlockAt: bigint | undefined;
  maxRedeem: bigint | undefined;
  previewAssets: bigint | undefined;
  availableLiquidity: bigint | undefined;
  shares: bigint | undefined;
}): { available: boolean; reason?: LpRedeemBlockReason } {
  if (
    input.unlockAt === undefined ||
    input.maxRedeem === undefined ||
    input.availableLiquidity === undefined ||
    input.shares === undefined
  ) {
    return { available: false, reason: "unknown" };
  }
  if (input.shares <= ZERO) return { available: false, reason: "zero-shares" };
  if (input.previewAssets !== undefined && input.previewAssets > input.availableLiquidity) {
    return { available: false, reason: "no-liquidity" };
  }
  if (input.maxRedeem <= ZERO) {
    if (input.availableLiquidity === ZERO) return { available: false, reason: "no-liquidity" };
    return { available: false, reason: "cooldown" };
  }
  return { available: true };
}

export function isP6PoolUsable(
  isBotTestnet: boolean,
  address: string | undefined,
  poolAddress: string | undefined,
): boolean {
  return Boolean(isBotTestnet && address && poolAddress);
}

export function useInstantPoolP6(soldTicketId?: bigint): {
  deployed: boolean;
  usable: boolean;
  poolAddress: `0x${string}` | undefined;
  vaultAddress: `0x${string}` | undefined;
  ticketAddress: `0x${string}` | undefined;
  assetAddress: `0x${string}` | undefined;
  protocolTreasury: `0x${string}` | undefined;
  availableLiquidity: bigint | undefined;
  lpNav: bigint | undefined;
  totalSupply: bigint | undefined;
  sharePrice: bigint | undefined;
  outstandingFaceValue: bigint | undefined;
  outstandingCostBasis: bigint | undefined;
  utilizationBps: bigint | undefined;
  cumulativeGrossSpread: bigint | undefined;
  accruedProtocolFees: bigint | undefined;
  cumulativeProtocolFees: bigint | undefined;
  lpRealizedProfit: bigint | undefined;
  shareDecimals: number | undefined;
  lpShares: bigint | undefined;
  maxRedeem: bigint | undefined;
  withdrawalUnlockAt: bigint | undefined;
  previewRedeemUser: bigint | undefined;
  pricing: readonly unknown[] | undefined;
  eligibleTicket: EligiblePendingTicket | undefined;
  selectedTicketOwner: string | undefined;
  selectedTicketStatus: TicketRequestStatus | undefined;
  soldTicketOwner: string | undefined;
  soldPosition: readonly unknown[] | undefined;
  refetchAll: () => void;
} {
  const { address } = useAccount();
  const { isBotTestnet } = useBotNetwork();
  const deployed = Boolean(POOL_ADDRESS);
  const usable = isP6PoolUsable(isBotTestnet, address, POOL_ADDRESS);
  const chainId = FRONTEND_POLICY.requiredChainId;
  const poolReadsEnabled = Boolean(POOL_ADDRESS);

  const asset = useReadContract({
    address: POOL_ADDRESS,
    abi: nostosInstantPoolP6Abi,
    functionName: "asset",
    chainId,
    query: { enabled: poolReadsEnabled },
  });
  const vault = useReadContract({
    address: POOL_ADDRESS,
    abi: nostosInstantPoolP6Abi,
    functionName: "vault",
    chainId,
    query: { enabled: poolReadsEnabled },
  });
  const ticket = useReadContract({
    address: POOL_ADDRESS,
    abi: nostosInstantPoolP6Abi,
    functionName: "ticket",
    chainId,
    query: { enabled: poolReadsEnabled },
  });
  const protocolTreasury = useReadContract({
    address: POOL_ADDRESS,
    abi: nostosInstantPoolP6Abi,
    functionName: "protocolTreasury",
    chainId,
    query: { enabled: poolReadsEnabled },
  });
  const availableLiquidity = useReadContract({
    address: POOL_ADDRESS,
    abi: nostosInstantPoolP6Abi,
    functionName: "availableLiquidity",
    chainId,
    query: { enabled: poolReadsEnabled },
  });
  const lpNav = useReadContract({
    address: POOL_ADDRESS,
    abi: nostosInstantPoolP6Abi,
    functionName: "lpNav",
    chainId,
    query: { enabled: poolReadsEnabled },
  });
  const totalSupply = useReadContract({
    address: POOL_ADDRESS,
    abi: nostosInstantPoolP6Abi,
    functionName: "totalSupply",
    chainId,
    query: { enabled: poolReadsEnabled },
  });
  const sharePrice = useReadContract({
    address: POOL_ADDRESS,
    abi: nostosInstantPoolP6Abi,
    functionName: "sharePrice",
    chainId,
    query: { enabled: poolReadsEnabled },
  });
  const outstandingFaceValue = useReadContract({
    address: POOL_ADDRESS,
    abi: nostosInstantPoolP6Abi,
    functionName: "outstandingFaceValue",
    chainId,
    query: { enabled: poolReadsEnabled },
  });
  const outstandingCostBasis = useReadContract({
    address: POOL_ADDRESS,
    abi: nostosInstantPoolP6Abi,
    functionName: "outstandingCostBasis",
    chainId,
    query: { enabled: poolReadsEnabled },
  });
  const utilizationBps = useReadContract({
    address: POOL_ADDRESS,
    abi: nostosInstantPoolP6Abi,
    functionName: "utilizationBps",
    chainId,
    query: { enabled: poolReadsEnabled },
  });
  const cumulativeGrossSpread = useReadContract({
    address: POOL_ADDRESS,
    abi: nostosInstantPoolP6Abi,
    functionName: "cumulativeGrossSpread",
    chainId,
    query: { enabled: poolReadsEnabled },
  });
  const accruedProtocolFees = useReadContract({
    address: POOL_ADDRESS,
    abi: nostosInstantPoolP6Abi,
    functionName: "accruedProtocolFees",
    chainId,
    query: { enabled: poolReadsEnabled },
  });
  const cumulativeProtocolFees = useReadContract({
    address: POOL_ADDRESS,
    abi: nostosInstantPoolP6Abi,
    functionName: "cumulativeProtocolFees",
    chainId,
    query: { enabled: poolReadsEnabled },
  });
  const lpRealizedProfit = useReadContract({
    address: POOL_ADDRESS,
    abi: nostosInstantPoolP6Abi,
    functionName: "lpRealizedProfit",
    chainId,
    query: { enabled: poolReadsEnabled },
  });
  const decimals = useReadContract({
    address: POOL_ADDRESS,
    abi: nostosInstantPoolP6Abi,
    functionName: "decimals",
    chainId,
    query: { enabled: poolReadsEnabled },
  });
  const pricing = useReadContract({
    address: POOL_ADDRESS,
    abi: nostosInstantPoolP6Abi,
    functionName: "getPricing",
    chainId,
    query: { enabled: poolReadsEnabled },
  });

  const lpShares = useReadContract({
    address: POOL_ADDRESS,
    abi: nostosInstantPoolP6Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId,
    query: { enabled: usable },
  });
  const maxRedeem = useReadContract({
    address: POOL_ADDRESS,
    abi: nostosInstantPoolP6Abi,
    functionName: "maxRedeem",
    args: address ? [address] : undefined,
    chainId,
    query: { enabled: usable },
  });
  const withdrawalUnlockAt = useReadContract({
    address: POOL_ADDRESS,
    abi: nostosInstantPoolP6Abi,
    functionName: "withdrawalUnlockAt",
    args: address ? [address] : undefined,
    chainId,
    query: { enabled: usable },
  });
  const previewRedeemUser = useReadContract({
    address: POOL_ADDRESS,
    abi: nostosInstantPoolP6Abi,
    functionName: "previewRedeem",
    args: lpShares.data && lpShares.data > ZERO ? [lpShares.data] : undefined,
    chainId,
    query: { enabled: Boolean(usable && lpShares.data && lpShares.data > ZERO) },
  });

  const ticketed = useTicketedVault(undefined);
  const pendingOwned = ticketed.ownedTickets.find((t) => t.status === 1);

  const quoteRead = useReadContract({
    address: POOL_ADDRESS,
    abi: nostosInstantPoolP6Abi,
    functionName: "quoteTicket",
    args: pendingOwned ? [pendingOwned.id] : undefined,
    chainId,
    query: { enabled: Boolean(usable && pendingOwned) },
  });

  const quote = mapQuoteTicket(quoteRead.data as readonly unknown[] | undefined);

  const faceValueRead = useReadContract({
    address: ticketed.vaultAddress,
    abi: nostosAsyncVaultP4Abi,
    functionName: "sharesToAssets",
    args: pendingOwned ? [pendingOwned.shares] : undefined,
    chainId,
    query: { enabled: Boolean(usable && pendingOwned) },
  });

  const soldOwnerRead = useReadContract({
    address: ticketed.ticketAddress,
    abi: nostosRedemptionTicketAbi,
    functionName: "ownerOf",
    args: soldTicketId !== undefined ? [soldTicketId] : undefined,
    chainId,
    query: { enabled: Boolean(usable && soldTicketId !== undefined) },
  });
  const soldPositionRead = useReadContract({
    address: POOL_ADDRESS,
    abi: nostosInstantPoolP6Abi,
    functionName: "positions",
    args: soldTicketId !== undefined ? [soldTicketId] : undefined,
    chainId,
    query: { enabled: Boolean(usable && soldTicketId !== undefined) },
  });

  return {
    deployed,
    usable,
    poolAddress: POOL_ADDRESS,
    vaultAddress: (vault.data as `0x${string}` | undefined) ?? ticketed.vaultAddress,
    ticketAddress: (ticket.data as `0x${string}` | undefined) ?? ticketed.ticketAddress,
    assetAddress: asset.data as `0x${string}` | undefined,
    protocolTreasury: protocolTreasury.data as `0x${string}` | undefined,
    availableLiquidity: availableLiquidity.data as bigint | undefined,
    lpNav: lpNav.data as bigint | undefined,
    totalSupply: totalSupply.data as bigint | undefined,
    sharePrice: sharePrice.data as bigint | undefined,
    outstandingFaceValue: outstandingFaceValue.data as bigint | undefined,
    outstandingCostBasis: outstandingCostBasis.data as bigint | undefined,
    utilizationBps: utilizationBps.data as bigint | undefined,
    cumulativeGrossSpread: cumulativeGrossSpread.data as bigint | undefined,
    accruedProtocolFees: accruedProtocolFees.data as bigint | undefined,
    cumulativeProtocolFees: cumulativeProtocolFees.data as bigint | undefined,
    lpRealizedProfit: lpRealizedProfit.data as bigint | undefined,
    shareDecimals: decimals.data !== undefined ? Number(decimals.data) : undefined,
    lpShares: lpShares.data as bigint | undefined,
    maxRedeem: maxRedeem.data as bigint | undefined,
    withdrawalUnlockAt: withdrawalUnlockAt.data as bigint | undefined,
    previewRedeemUser: previewRedeemUser.data as bigint | undefined,
    pricing: pricing.data as readonly unknown[] | undefined,
    eligibleTicket: pendingOwned
      ? {
          ticketId: pendingOwned.id,
          faceValue: faceValueRead.data as bigint | undefined,
          quote,
          quoteError: quoteRead.isError
            ? (quoteRead.error?.message ?? "Quote unavailable")
            : undefined,
        }
      : undefined,
    selectedTicketOwner: ticketed.selectedTicketOwner,
    selectedTicketStatus: ticketed.selectedRequest?.status,
    soldTicketOwner: soldOwnerRead.data as string | undefined,
    soldPosition: soldPositionRead.data as readonly unknown[] | undefined,
    refetchAll: () => {
      asset.refetch();
      vault.refetch();
      ticket.refetch();
      protocolTreasury.refetch();
      availableLiquidity.refetch();
      lpNav.refetch();
      totalSupply.refetch();
      sharePrice.refetch();
      outstandingFaceValue.refetch();
      outstandingCostBasis.refetch();
      utilizationBps.refetch();
      cumulativeGrossSpread.refetch();
      accruedProtocolFees.refetch();
      cumulativeProtocolFees.refetch();
      lpRealizedProfit.refetch();
      decimals.refetch();
      pricing.refetch();
      lpShares.refetch();
      maxRedeem.refetch();
      withdrawalUnlockAt.refetch();
      previewRedeemUser.refetch();
      quoteRead.refetch();
      faceValueRead.refetch();
      soldOwnerRead.refetch();
      soldPositionRead.refetch();
      ticketed.refetchAll();
    },
  };
}

export function usePreviewDeposit(assets: bigint | undefined) {
  const { address } = useAccount();
  const { isBotTestnet } = useBotNetwork();
  const enabled = Boolean(isBotTestnet && address && POOL_ADDRESS && assets && assets > ZERO);
  return useReadContract({
    address: POOL_ADDRESS,
    abi: nostosInstantPoolP6Abi,
    functionName: "previewDeposit",
    args: assets && assets > ZERO ? [assets] : undefined,
    chainId: FRONTEND_POLICY.requiredChainId,
    query: { enabled },
  });
}

export function usePreviewRedeemInput(shares: bigint | undefined) {
  const { address } = useAccount();
  const { isBotTestnet } = useBotNetwork();
  const enabled = Boolean(isBotTestnet && address && POOL_ADDRESS && shares && shares > ZERO);
  return useReadContract({
    address: POOL_ADDRESS,
    abi: nostosInstantPoolP6Abi,
    functionName: "previewRedeem",
    args: shares && shares > ZERO ? [shares] : undefined,
    chainId: FRONTEND_POLICY.requiredChainId,
    query: { enabled },
  });
}
