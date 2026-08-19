"use client";

import { useAccount, useReadContract, useReadContracts } from "wagmi";
import { erc20Abi } from "viem";
import { BOT_TESTNET_SETTLEMENT_TOKEN } from "@/lib/chain/settlement-token";
import { deployedTestnet } from "@/lib/chain/deployed-addresses";
import { FRONTEND_POLICY } from "@/lib/chain/frontend-policy";
import { useBotNetwork } from "@/lib/chain/frontend-hooks";
import { nostosAsyncVaultP4Abi } from "@/lib/contracts/nostos-async-vault-p4-abi";
import { nostosRedemptionTicketAbi } from "@/lib/contracts/nostos-redemption-ticket-abi";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const ZERO = BigInt(0);
const P4_VAULT_ADDRESS = deployedTestnet.p4?.asyncVault as
  | `0x${string}`
  | undefined;
const P4_TICKET_ADDRESS = deployedTestnet.p4?.redemptionTicket as
  | `0x${string}`
  | undefined;

export type TicketRequestStatus = 0 | 1 | 2 | 3;

export interface TicketedRequest {
  id: bigint;
  controller: `0x${string}`;
  originalOwner: `0x${string}`;
  ticketOwner: `0x${string}`;
  shares: bigint;
  assetsClaimable: bigint;
  status: TicketRequestStatus;
}

export interface TicketedVaultState {
  vaultAddress: `0x${string}` | undefined;
  ticketAddress: `0x${string}` | undefined;
  deployed: boolean;
  usable: boolean;
  usdtDecimals: number;
  shareDecimals: number | undefined;
  totalAssets: bigint | undefined;
  reserved: bigint | undefined;
  shareBalance: bigint | undefined;
  usdtBalance: bigint | undefined;
  nextRequestId: bigint | undefined;
  activeRequestId: bigint | undefined;
  activeRequest: TicketedRequest | null;
  ownedTickets: TicketedRequest[];
  selectedRequest: TicketedRequest | null;
  selectedTicketOwner: `0x${string}` | undefined;
  selectedTicketApproved: `0x${string}` | undefined;
  selectedOperatorApproved: boolean;
  canClaim: boolean;
  refetchAll: () => void;
}

export function isAuthorizedForTicket(
  spender: string | undefined,
  owner: string | undefined,
  approved: string | undefined,
  operatorApproved: boolean,
): boolean {
  if (!spender || !owner) return false;
  const normalizedSpender = spender.toLowerCase();
  return (
    normalizedSpender === owner.toLowerCase() ||
    normalizedSpender === approved?.toLowerCase() ||
    operatorApproved
  );
}

export function isP4VaultUsable(
  isBotTestnet: boolean,
  address: string | undefined,
  vaultAddress: string | undefined,
  ticketAddress: string | undefined,
): boolean {
  return Boolean(isBotTestnet && address && vaultAddress && ticketAddress);
}

function asRequest(
  data: readonly unknown[] | undefined,
  ticketOwner: `0x${string}` | undefined,
): TicketedRequest | null {
  if (!data || !ticketOwner) return null;
  return {
    id: data[0] as bigint,
    controller: data[1] as `0x${string}`,
    originalOwner: data[2] as `0x${string}`,
    ticketOwner,
    shares: data[3] as bigint,
    assetsClaimable: data[4] as bigint,
    status: data[8] as TicketRequestStatus,
  };
}

export function resolveTicketOwner(
  ticketId: bigint | undefined,
  ownerReads:
    | readonly { status: string; result?: unknown }[]
    | undefined,
): `0x${string}` | undefined {
  if (ticketId === undefined || ticketId <= ZERO) return undefined;
  const read = ownerReads?.[Number(ticketId) - 1];
  return read?.status === "success" && typeof read.result === "string"
    ? (read.result as `0x${string}`)
    : undefined;
}

export function useTicketedVault(
  selectedTicketId: bigint | undefined,
): TicketedVaultState {
  const { address } = useAccount();
  const { isBotTestnet } = useBotNetwork();
  const deployed = Boolean(P4_VAULT_ADDRESS && P4_TICKET_ADDRESS);
  const usable = isP4VaultUsable(
    isBotTestnet,
    address,
    P4_VAULT_ADDRESS,
    P4_TICKET_ADDRESS,
  );
  const chainId = FRONTEND_POLICY.requiredChainId;

  const shareBalance = useReadContract({
    address: P4_VAULT_ADDRESS,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : [ZERO_ADDRESS],
    chainId,
    query: { enabled: usable },
  });
  const usdtBalance = useReadContract({
    address: BOT_TESTNET_SETTLEMENT_TOKEN.address ?? undefined,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : [ZERO_ADDRESS],
    chainId,
    query: { enabled: usable },
  });
  const totalAssets = useReadContract({
    address: P4_VAULT_ADDRESS,
    abi: nostosAsyncVaultP4Abi,
    functionName: "totalAssets",
    chainId,
    query: { enabled: usable },
  });
  const reserved = useReadContract({
    address: P4_VAULT_ADDRESS,
    abi: nostosAsyncVaultP4Abi,
    functionName: "reservedClaimableAssets",
    chainId,
    query: { enabled: usable },
  });
  const shareDecimals = useReadContract({
    address: P4_VAULT_ADDRESS,
    abi: nostosAsyncVaultP4Abi,
    functionName: "decimals",
    chainId,
    query: { enabled: usable },
  });
  const nextRequestId = useReadContract({
    address: P4_VAULT_ADDRESS,
    abi: nostosAsyncVaultP4Abi,
    functionName: "nextRequestId",
    chainId,
    query: { enabled: usable },
  });
  const activeRequestId = useReadContract({
    address: P4_VAULT_ADDRESS,
    abi: nostosAsyncVaultP4Abi,
    functionName: "activeRequestId",
    args: address ? [address] : [ZERO_ADDRESS],
    chainId,
    query: { enabled: usable },
  });

  const activeId = activeRequestId.data as bigint | undefined;
  const activeController = address as `0x${string}` | undefined;
  const activeRequestRead = useReadContract({
    address: P4_VAULT_ADDRESS,
    abi: nostosAsyncVaultP4Abi,
    functionName: "requests",
    args:
      usable && activeId && activeId > ZERO && activeController
        ? [activeId, activeController]
        : undefined,
    chainId,
    query: {
      enabled: Boolean(usable && activeId && activeId > ZERO && activeController),
    },
  });
  const requestCount =
    nextRequestId.data && (nextRequestId.data as bigint) > ZERO
      ? Number((nextRequestId.data as bigint) - BigInt(1))
      : 0;
  const ticketIds = Array.from({ length: requestCount }, (_, index) =>
    BigInt(index + 1),
  );
  const ownerReads = useReadContracts({
    contracts: ticketIds.map((id) => ({
      address: P4_TICKET_ADDRESS,
      abi: nostosRedemptionTicketAbi,
      functionName: "ownerOf",
      args: [id],
      chainId,
    })),
    allowFailure: true,
    query: { enabled: usable && ticketIds.length > 0 },
  });
  const activeTicketOwner = resolveTicketOwner(activeId, ownerReads.data);
  const activeRequest = asRequest(
    activeRequestRead.data as readonly unknown[] | undefined,
    activeTicketOwner,
  );
  const ownedTicketIds = ticketIds.filter((_, index) => {
    const result = ownerReads.data?.[index];
    return (
      result?.status === "success" &&
      typeof result.result === "string" &&
      Boolean(address) &&
      result.result.toLowerCase() === address?.toLowerCase()
    );
  });
  const ownedControllerReads = useReadContracts({
    contracts: ownedTicketIds.map((id) => ({
      address: P4_VAULT_ADDRESS,
      abi: nostosAsyncVaultP4Abi,
      functionName: "requestController",
      args: [id],
      chainId,
    })),
    allowFailure: true,
    query: { enabled: usable && ownedTicketIds.length > 0 },
  });
  const ownedRequestInputs = ownedTicketIds.flatMap((id, index) => {
    const controller = ownedControllerReads.data?.[index];
    return controller?.status === "success" && typeof controller.result === "string"
      ? [{ id, controller: controller.result as `0x${string}` }]
      : [];
  });
  const ownedRequestReads = useReadContracts({
    contracts: ownedRequestInputs.map(({ id, controller }) => ({
      address: P4_VAULT_ADDRESS,
      abi: nostosAsyncVaultP4Abi,
      functionName: "requests" as const,
      args: [id, controller] as const,
      chainId,
    })),
    allowFailure: true,
    query: { enabled: usable && ownedTicketIds.length > 0 },
  });
  const ownedTickets = ownedRequestInputs.flatMap(({ id }, index) => {
    const request = ownedRequestReads.data?.[index];
    if (
      request?.status !== "success" ||
      !Array.isArray(request.result)
    ) {
      return [];
    }
    const result = asRequest(request.result, address as `0x${string}`);
    return result ? [{ ...result, id }] : [];
  });

  const effectiveSelectedTicketId =
    selectedTicketId ??
    (activeId !== undefined && activeId > ZERO ? activeId : ownedTicketIds[0]);

  const selectedOwnerRead = useReadContract({
    address: P4_TICKET_ADDRESS,
    abi: nostosRedemptionTicketAbi,
    functionName: "ownerOf",
    args: effectiveSelectedTicketId !== undefined ? [effectiveSelectedTicketId] : undefined,
    chainId,
    query: { enabled: usable && effectiveSelectedTicketId !== undefined },
  });
  const selectedOwner = selectedOwnerRead.data as `0x${string}` | undefined;
  const selectedApprovedRead = useReadContract({
    address: P4_TICKET_ADDRESS,
    abi: nostosRedemptionTicketAbi,
    functionName: "getApproved",
    args: effectiveSelectedTicketId !== undefined ? [effectiveSelectedTicketId] : undefined,
    chainId,
    query: { enabled: Boolean(usable && effectiveSelectedTicketId !== undefined && selectedOwner) },
  });
  const selectedOperatorRead = useReadContract({
    address: P4_TICKET_ADDRESS,
    abi: nostosRedemptionTicketAbi,
    functionName: "isApprovedForAll",
    args: selectedOwner && address ? [selectedOwner, address] : undefined,
    chainId,
    query: { enabled: Boolean(usable && selectedOwner && address) },
  });
  const selectedControllerRead = useReadContract({
    address: P4_VAULT_ADDRESS,
    abi: nostosAsyncVaultP4Abi,
    functionName: "requestController",
    args: effectiveSelectedTicketId !== undefined ? [effectiveSelectedTicketId] : undefined,
    chainId,
    query: { enabled: Boolean(usable && effectiveSelectedTicketId !== undefined && selectedOwner) },
  });
  const selectedController = selectedControllerRead.data as
    | `0x${string}`
    | undefined;
  const selectedRequestRead = useReadContract({
    address: P4_VAULT_ADDRESS,
    abi: nostosAsyncVaultP4Abi,
    functionName: "requests",
    args:
      effectiveSelectedTicketId !== undefined && selectedController
        ? [effectiveSelectedTicketId, selectedController]
        : undefined,
    chainId,
    query: { enabled: Boolean(usable && effectiveSelectedTicketId !== undefined && selectedController) },
  });
  const selectedRequest = asRequest(
    selectedRequestRead.data as readonly unknown[] | undefined,
    selectedOwner,
  );
  const selectedApproved = selectedApprovedRead.data as `0x${string}` | undefined;
  const selectedOperatorApproved = Boolean(selectedOperatorRead.data);
  const canClaim = isAuthorizedForTicket(
    address,
    selectedOwner,
    selectedApproved,
    selectedOperatorApproved,
  );

  return {
    vaultAddress: P4_VAULT_ADDRESS,
    ticketAddress: P4_TICKET_ADDRESS,
    deployed,
    usable,
    usdtDecimals: BOT_TESTNET_SETTLEMENT_TOKEN.decimals ?? 6,
    shareDecimals: shareDecimals.data as number | undefined,
    totalAssets: totalAssets.data as bigint | undefined,
    reserved: reserved.data as bigint | undefined,
    shareBalance: shareBalance.data as bigint | undefined,
    usdtBalance: usdtBalance.data as bigint | undefined,
    nextRequestId: nextRequestId.data as bigint | undefined,
    activeRequestId: activeId,
    activeRequest,
    ownedTickets,
    selectedRequest,
    selectedTicketOwner: selectedOwner,
    selectedTicketApproved: selectedApproved,
    selectedOperatorApproved,
    canClaim,
    refetchAll: () => {
      shareBalance.refetch();
      usdtBalance.refetch();
      totalAssets.refetch();
      reserved.refetch();
      shareDecimals.refetch();
      nextRequestId.refetch();
      activeRequestId.refetch();
      activeRequestRead.refetch();
      ownerReads.refetch();
      ownedControllerReads.refetch();
      ownedRequestReads.refetch();
      selectedOwnerRead.refetch();
      selectedApprovedRead.refetch();
      selectedOperatorRead.refetch();
      selectedControllerRead.refetch();
      selectedRequestRead.refetch();
    },
  };
}
