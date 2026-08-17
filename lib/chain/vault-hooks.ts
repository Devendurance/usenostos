"use client";

import {
  useAccount,
  useReadContract,
  useWriteContract,
} from "wagmi";
import { erc20Abi } from "viem";
import { nostosAsyncVaultAbi } from "@/lib/contracts/nostos-async-vault-abi";
import { BOT_TESTNET_SETTLEMENT_TOKEN } from "@/lib/chain/settlement-token";
import { deployedTestnet } from "@/lib/chain/deployed-addresses";
import { FRONTEND_POLICY } from "@/lib/chain/frontend-policy";
import { useBotNetwork } from "@/lib/chain/frontend-hooks";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const ZERO = BigInt(0);

const VAULT_ADDRESS =
  (deployedTestnet.asyncVault as `0x${string}` | undefined) ?? undefined;

export type RequestStatusValue = 0 | 1 | 2 | 3;

export interface DemoVaultState {
  vaultAddress: `0x${string}` | undefined;
  deployed: boolean;
  usable: boolean;
  usdtDecimals: number;
  shareDecimals: number | undefined;
  totalAssets: bigint | undefined;
  reserved: bigint | undefined;
  shareBalance: bigint | undefined;
  usdtBalance: bigint | undefined;
  activeRequestId: bigint | undefined;
  request: {
    id: bigint;
    controller: `0x${string}`;
    owner: `0x${string}`;
    shares: bigint;
    assetsClaimable: bigint;
    status: RequestStatusValue;
  } | null;
  refetchAll: () => void;
}

export function useDemoVault(): DemoVaultState {
  const { address } = useAccount();
  const { isBotTestnet } = useBotNetwork();
  const usable =
    isBotTestnet && Boolean(address) && VAULT_ADDRESS !== undefined;

  const chainId = FRONTEND_POLICY.requiredChainId;

  const shareBalance = useReadContract({
    address: VAULT_ADDRESS,
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
    address: VAULT_ADDRESS,
    abi: nostosAsyncVaultAbi,
    functionName: "totalAssets",
    chainId,
    query: { enabled: usable },
  });
  const reserved = useReadContract({
    address: VAULT_ADDRESS,
    abi: nostosAsyncVaultAbi,
    functionName: "reservedClaimableAssets",
    chainId,
    query: { enabled: usable },
  });
  const shareDecimals = useReadContract({
    address: VAULT_ADDRESS,
    abi: nostosAsyncVaultAbi,
    functionName: "decimals",
    chainId,
    query: { enabled: usable },
  });
  const activeRequestId = useReadContract({
    address: VAULT_ADDRESS,
    abi: nostosAsyncVaultAbi,
    functionName: "activeRequestId",
    args: address ? [address] : [ZERO_ADDRESS],
    chainId,
    query: { enabled: usable },
  });

  const activeRequestBig = activeRequestId.data as bigint | undefined;
  const hasActive =
    usable && activeRequestBig !== undefined && activeRequestBig > ZERO;

  const request = useReadContract({
    address: VAULT_ADDRESS,
    abi: nostosAsyncVaultAbi,
    functionName: "requests",
    args: hasActive && address ? [activeRequestBig!, address] : undefined,
    chainId,
    query: { enabled: hasActive },
  });

  return {
    vaultAddress: VAULT_ADDRESS,
    deployed: VAULT_ADDRESS !== undefined,
    usable,
    usdtDecimals: BOT_TESTNET_SETTLEMENT_TOKEN.decimals ?? 6,
    shareDecimals: shareDecimals.data as number | undefined,
    totalAssets: totalAssets.data as bigint | undefined,
    reserved: reserved.data as bigint | undefined,
    shareBalance: shareBalance.data as bigint | undefined,
    usdtBalance: usdtBalance.data as bigint | undefined,
    activeRequestId: activeRequestBig,
    request:
      request.data && activeRequestBig
        ? {
            id: request.data[0] as bigint,
            controller: request.data[1] as `0x${string}`,
            owner: request.data[2] as `0x${string}`,
            shares: request.data[3] as bigint,
            assetsClaimable: request.data[4] as bigint,
            status: request.data[8] as RequestStatusValue,
          }
        : null,
    refetchAll: () => {
      shareBalance.refetch();
      usdtBalance.refetch();
      totalAssets.refetch();
      reserved.refetch();
      activeRequestId.refetch();
      request.refetch();
    },
  };
}

export function useVaultWrite() {
  return useWriteContract();
}