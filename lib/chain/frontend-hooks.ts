"use client";

import { useAccount, useBalance, useReadContract } from "wagmi";
import { erc20Abi } from "viem";
import { FRONTEND_POLICY } from "@/lib/chain/frontend-policy";
import { BOT_TESTNET_SETTLEMENT_TOKEN } from "@/lib/chain/settlement-token";
import {
  deriveEnabledReadState,
  type ReadPhase,
} from "@/lib/chain/read-state";
import { useActualWalletChain } from "@/lib/chain/use-actual-wallet-chain";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

export interface ChainRead<T> {
  phase: ReadPhase;
  isFetching: boolean;
  refetch: () => void;
  data: T | null;
}

export function useWalletConnection() {
  const { status, address, isConnected, connector } = useAccount();
  return { status, address, isConnected, connector };
}

export function useBotNetwork() {
  const { connector, status } = useAccount();
  // The product gate uses the ACTUAL wallet chain id read from the connected
  // provider (including chains outside wagmi config.chains), never wagmi's
  // configured chain state alone.
  const actualChainId = useActualWalletChain(connector, status === "connected");
  return {
    chainId: actualChainId,
    requiredChainId: FRONTEND_POLICY.requiredChainId,
    isBotTestnet: actualChainId === FRONTEND_POLICY.requiredChainId,
    actualChainId,
  };
}

export function useNativeBalance(): ChainRead<bigint> {
  const { address } = useAccount();
  const { isBotTestnet } = useBotNetwork();
  const enabled = Boolean(address) && isBotTestnet;
  const query = useBalance({
    address,
    chainId: FRONTEND_POLICY.requiredChainId,
    query: {
      enabled,
      select: (data) => data.value,
    },
  });
  return {
    phase: deriveEnabledReadState(enabled, query),
    isFetching: query.isFetching,
    refetch: () => void query.refetch(),
    // Never expose a cached value while the wallet is not usable on 968.
    data: enabled ? (query.data ?? null) : null,
  };
}

export function useSettlementTokenBalance(): ChainRead<bigint> {
  const { address } = useAccount();
  const { isBotTestnet } = useBotNetwork();
  const enabled =
    Boolean(address) &&
    isBotTestnet &&
    BOT_TESTNET_SETTLEMENT_TOKEN.address !== null;
  const query = useReadContract({
    address: BOT_TESTNET_SETTLEMENT_TOKEN.address ?? undefined,
    abi: erc20Abi,
    functionName: "balanceOf",
    // Placeholder only; the query is disabled (enabled=false) unless a real
    // address is connected on BOT Testnet, so it never fetches for the
    // placeholder.
    args: [address ?? ZERO_ADDRESS],
    chainId: FRONTEND_POLICY.requiredChainId,
    query: { enabled, select: (data) => data as bigint },
  });
  return {
    phase: deriveEnabledReadState(enabled, query),
    isFetching: query.isFetching,
    refetch: () => void query.refetch(),
    data: enabled ? (query.data ?? null) : null,
  };
}