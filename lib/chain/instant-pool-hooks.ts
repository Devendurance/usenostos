"use client";

import { useAccount, useReadContract } from "wagmi";
import { deployedTestnet } from "@/lib/chain/deployed-addresses";
import { FRONTEND_POLICY } from "@/lib/chain/frontend-policy";
import { useBotNetwork } from "@/lib/chain/frontend-hooks";
import {
  useTicketedVault,
  type TicketRequestStatus,
} from "@/lib/chain/ticketed-vault-hooks";
import { nostosInstantPoolAbi } from "@/lib/contracts/nostos-instant-pool-abi";
import { nostosAsyncVaultP4Abi } from "@/lib/contracts/nostos-async-vault-p4-abi";
import { nostosRedemptionTicketAbi } from "@/lib/contracts/nostos-redemption-ticket-abi";

const ZERO = BigInt(0);
const POOL_ADDRESS = deployedTestnet.p5?.instantPool as `0x${string}` | undefined;

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
  faceValue: bigint;
  quote: PoolQuote | undefined;
  quoteError: string | undefined;
}

export function useInstantPool(soldTicketId?: bigint): {
  deployed: boolean;
  usable: boolean;
  poolAddress: `0x${string}` | undefined;
  vaultAddress: `0x${string}` | undefined;
  ticketAddress: `0x${string}` | undefined;
  liquidAssets: bigint | undefined;
  outstandingFaceValue: bigint | undefined;
  outstandingCostBasis: bigint | undefined;
  realizedSpread: bigint | undefined;
  utilizationBps: bigint | undefined;
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
  const usable = Boolean(isBotTestnet && address && POOL_ADDRESS);
  const chainId = FRONTEND_POLICY.requiredChainId;

  const liquidAssets = useReadContract({
    address: POOL_ADDRESS,
    abi: nostosInstantPoolAbi,
    functionName: "liquidAssets",
    chainId,
    query: { enabled: usable },
  });
  const outstandingFaceValue = useReadContract({
    address: POOL_ADDRESS,
    abi: nostosInstantPoolAbi,
    functionName: "outstandingFaceValue",
    chainId,
    query: { enabled: usable },
  });
  const outstandingCostBasis = useReadContract({
    address: POOL_ADDRESS,
    abi: nostosInstantPoolAbi,
    functionName: "outstandingCostBasis",
    chainId,
    query: { enabled: usable },
  });
  const realizedSpread = useReadContract({
    address: POOL_ADDRESS,
    abi: nostosInstantPoolAbi,
    functionName: "realizedSpread",
    chainId,
    query: { enabled: usable },
  });
  const utilizationBps = useReadContract({
    address: POOL_ADDRESS,
    abi: nostosInstantPoolAbi,
    functionName: "utilizationBps",
    chainId,
    query: { enabled: usable },
  });
  const pricing = useReadContract({
    address: POOL_ADDRESS,
    abi: nostosInstantPoolAbi,
    functionName: "getPricing",
    chainId,
    query: { enabled: usable },
  });

  // Reuse P4 ticketed hook for the connected user's owned tickets + request statuses.
  const ticketed = useTicketedVault(undefined);
  const pendingOwned = ticketed.ownedTickets.find((t) => t.status === 1);

  const quoteRead = useReadContract({
    address: POOL_ADDRESS,
    abi: nostosInstantPoolAbi,
    functionName: "quoteTicket",
    args: pendingOwned ? [pendingOwned.id] : undefined,
    chainId,
    query: { enabled: Boolean(usable && pendingOwned) },
  });

  const rawQuote = quoteRead.data as readonly unknown[] | undefined;
  const quote: PoolQuote | undefined = rawQuote
    ? {
        faceValue: rawQuote[0] as bigint,
        amountOut: rawQuote[1] as bigint,
        discountBps: rawQuote[2] as bigint,
        utilizationBps: rawQuote[3] as bigint,
        sizeRatioBps: rawQuote[4] as bigint,
        postTradeUtilizationBps: rawQuote[5] as bigint,
      }
    : undefined;

  const faceValueRead = useReadContract({
    address: ticketed.vaultAddress,
    abi: nostosAsyncVaultP4Abi,
    functionName: "sharesToAssets",
    args: pendingOwned ? [pendingOwned.shares] : undefined,
    chainId,
    query: { enabled: Boolean(usable && pendingOwned) },
  });

  // Post-sale truth: the pool owns the sold ticket and holds its position.
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
    abi: nostosInstantPoolAbi,
    functionName: "positions",
    args: soldTicketId !== undefined ? [soldTicketId] : undefined,
    chainId,
    query: { enabled: Boolean(usable && soldTicketId !== undefined) },
  });

  return {
    deployed,
    usable,
    poolAddress: POOL_ADDRESS,
    vaultAddress: ticketed.vaultAddress,
    ticketAddress: ticketed.ticketAddress,
    liquidAssets: liquidAssets.data as bigint | undefined,
    outstandingFaceValue: outstandingFaceValue.data as bigint | undefined,
    outstandingCostBasis: outstandingCostBasis.data as bigint | undefined,
    realizedSpread: realizedSpread.data as bigint | undefined,
    utilizationBps: utilizationBps.data as bigint | undefined,
    pricing: pricing.data as readonly unknown[] | undefined,
    eligibleTicket: pendingOwned
      ? {
          ticketId: pendingOwned.id,
          faceValue: (faceValueRead.data as bigint | undefined) ?? ZERO,
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
      liquidAssets.refetch();
      outstandingFaceValue.refetch();
      outstandingCostBasis.refetch();
      realizedSpread.refetch();
      utilizationBps.refetch();
      pricing.refetch();
      quoteRead.refetch();
      faceValueRead.refetch();
      soldOwnerRead.refetch();
      soldPositionRead.refetch();
      ticketed.refetchAll();
    },
  };
}
