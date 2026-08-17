"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import type { Connector } from "wagmi";

// The wallet's actual chain id is read directly from the connected
// EIP-1193 provider, NOT from wagmi's configured chain state. This keeps
// unsupported external chains (Celo, Ethereum, Base, 677, ...) detectable
// even though only BOT Testnet (968) exists in wagmi config.chains.
export function parseChainId(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return Number.isSafeInteger(value) ? value : null;
  if (typeof value === "string") {
    const text = value.startsWith("0x") || value.startsWith("0X") ? value : `0x${value}`;
    const n = Number.parseInt(text, 16);
    return Number.isSafeInteger(n) ? n : null;
  }
  return null;
}

interface Eip1193Like {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: string, cb: (value: unknown) => void) => void;
  removeListener?: (event: string, cb: (value: unknown) => void) => void;
  off?: (event: string, cb: (value: unknown) => void) => void;
}

interface ChainStore {
  get: () => number | null;
  set: (value: number | null) => void;
  subscribe: (cb: () => void) => () => void;
}

function createChainStore(): ChainStore {
  let value: number | null = null;
  const listeners = new Set<() => void>();
  return {
    get: () => value,
    set: (next) => {
      value = next;
      for (const cb of [...listeners]) cb();
    },
    subscribe: (cb) => {
      listeners.add(cb);
      return () => {
        listeners.delete(cb);
      };
    },
  };
}

export function useActualWalletChain(
  connector: Connector | undefined,
  connected: boolean,
): number | null {
  // Stable store instance created once; its value is updated from the
  // provider subscription and read via useSyncExternalStore.
  const [store] = useState(createChainStore);

  const subscribe = useCallback((cb: () => void) => store.subscribe(cb), [store]);
  const getSnapshot = useCallback(() => store.get(), [store]);
  const actualChainId = useSyncExternalStore(subscribe, getSnapshot, () => null);

  useEffect(() => {
    if (!connected || !connector) {
      store.set(null);
      return;
    }

    let provider: Eip1193Like | null = null;
    let disposed = false;

    const handleChainChanged = (value: unknown) => {
      const id = parseChainId(value);
      if (id !== null) store.set(id);
    };

    (async () => {
      try {
        provider = (await connector.getProvider()) as Eip1193Like | null;
      } catch {
        provider = null;
      }
      if (disposed || !provider) return;
      provider.on?.("chainChanged", handleChainChanged);
      try {
        const initial = await provider.request({ method: "eth_chainId" });
        if (!disposed && initial !== null && initial !== undefined) {
          handleChainChanged(initial);
        }
      } catch {
        // Provider may not expose a direct request; the chain stays null until
        // a chainChanged event arrives. Never assume 968 during this window.
      }
    })();

    return () => {
      disposed = true;
      if (provider) {
        provider.removeListener?.("chainChanged", handleChainChanged);
        provider.off?.("chainChanged", handleChainChanged);
      }
    };
  }, [connector, connected, store]);

  return actualChainId;
}