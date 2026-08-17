# P1 Live Wallet + Chain Data Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the existing Nostos UI shell into a real wallet-aware BOT Testnet (968) app: injected-wallet connection, wrong-network gating, live tBOT and Testnet USDT reads, truthful read/error states, and zero fabricated financial data.

**Architecture:** Add a client-side Wagmi layer (single config scoped to `botTestnet` 968, injected/EIP-1193 connectors only), a small provider boundary in the root layout, a centralized frontend environment policy (testnet-only, writes disabled), and thin hooks over Wagmi. Rework the existing `wallet-preview-dialog` (same props/visual shell) into a real connect dialog. No protocol writes, no Mainnet activation, no store libraries.

**Tech Stack:** Next.js 16.3.1 App Router, React 19, TypeScript, Wagmi (new), `@tanstack/react-query` (new), Viem 2.55 (existing), Tailwind, existing UI system.

## Global Constraints

- Do NOT redesign UI; do NOT start P2.
- Active chain is BOT Testnet 968 only. BOT Mainnet 677 stays configured in `lib/chain/bot-mainnet.ts` but must never activate in the frontend.
- No WalletConnect, no account abstraction, no Zustand/Redux, no RWA/Registry/vaults/ERC-7540/queue/InstantPool, no approvals/deposits/redemptions, no faucet automation, no fake history/financial values.
- Injected/EIP-1193 connectors only; no project IDs; no private keys in frontend; no duplicated `defineChain`.
- Failed reads never become zero; zero is shown only after a successful chain read returns zero.
- RPC read failures must not disconnect the wallet. No broad transaction retry middleware.
- Preserve existing layouts, typography, responsive behavior, routes, and P0/P0.5 diagnostics.
- Never import server-only wallet/private-key modules (`builder-wallet.ts`, `write-proof*.ts`, `testnet-write.ts`) from `app/` or `components/`.
- Stage/commit only P1-owned paths; preserve unrelated worktree changes.

## Locked values

- Frontend staging chain id: 968 (`botTestnet`).
- Testnet USDT: `0x75edC9335175Fc0552D51D48439F229c10420fe3` (from `BOT_TESTNET_SETTLEMENT_TOKEN`, 6 decimals) - never repeated in components.

---

### Task 1: Install Wagmi And React Query

**Files:**
- Modify: `package.json`, `package-lock.json`

**Interfaces:**
- Produces: `wagmi` and `@tanstack/react-query` runtime dependencies compatible with React 19 + Viem 2.55.

- [ ] **Step 1: Install**

Run:

```bash
npm install wagmi @tanstack/react-query
```

Expected: install succeeds; `wagmi` and `@tanstack/react-query` appear under `dependencies`. Do not upgrade Viem or React.

- [ ] **Step 2: Verify peer compatibility**

Run: `npm ls wagmi @tanstack/react-query viem react`. Expected: no peer warnings; `viem` and `react` versions unchanged.

### Task 2: Frontend Environment Policy And Read-State Helpers

**Files:**
- Create: `lib/chain/frontend-policy.ts`
- Create: `lib/chain/read-state.ts`
- Create: `tests/unit/frontend-policy.test.ts`

**Interfaces:**
- Produces: `FRONTEND_POLICY`, `FrontendPolicy`, `resolveFrontendEnvironment(raw)`, `isFrontendUsableChain(chainId)`, `ReadPhase`, `deriveReadState(info)`, `formatTokenAmount(units, decimals)`.
- Consumes: `BOT_TESTNET_CHAIN_ID` from `./bot-testnet`, `BOT_CHAIN_ID` from `./bot-mainnet`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import {
  FRONTEND_POLICY,
  isFrontendUsableChain,
  resolveFrontendEnvironment,
} from "@/lib/chain/frontend-policy";
import { deriveReadState } from "@/lib/chain/read-state";

describe("frontend environment policy", () => {
  it("requires BOT Testnet chain 968", () => {
    expect(FRONTEND_POLICY.environment).toBe("testnet");
    expect(FRONTEND_POLICY.requiredChainId).toBe(968);
    expect(FRONTEND_POLICY.writesEnabled).toBe(false);
  });

  it("rejects 677 for active P1 use", () => {
    expect(isFrontendUsableChain(677)).toBe(false);
    expect(isFrontendUsableChain(1)).toBe(false);
    expect(isFrontendUsableChain(968)).toBe(true);
  });

  it("never enables mainnet from any env value, including an explicit mainnet value", () => {
    expect(resolveFrontendEnvironment(undefined).environment).toBe("testnet");
    expect(resolveFrontendEnvironment("").environment).toBe("testnet");
    expect(resolveFrontendEnvironment("garbage").environment).toBe("testnet");
    expect(resolveFrontendEnvironment("mainnet").environment).toBe("testnet");
    expect(resolveFrontendEnvironment("testnet").environment).toBe("testnet");
  });
});

describe("read-state derivation", () => {
  it("never turns a failed read into a ready zero", () => {
    expect(deriveReadState({ isError: true, isFetched: true })).toBe("unavailable");
  });

  it("shows loading while pending and not yet fetched", () => {
    expect(deriveReadState({ isPending: true, isFetched: false })).toBe("loading");
  });

  it("is idle when not enabled", () => {
    expect(deriveReadState({ isPending: false, isFetched: false })).toBe("idle");
  });

  it("is ready after a successful fetch (including a real zero result)", () => {
    expect(deriveReadState({ isPending: false, isFetched: true, isError: false })).toBe("ready");
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/unit/frontend-policy.test.ts`. Expected: FAIL (modules missing).

- [ ] **Step 3: Implement `lib/chain/frontend-policy.ts`**

```ts
import { BOT_CHAIN_ID } from "./bot-mainnet";
import { BOT_TESTNET_CHAIN_ID } from "./bot-testnet";

export interface FrontendPolicy {
  environment: "testnet";
  requiredChainId: number;
  writesEnabled: false;
}

// P1 is explicitly testnet-only. Mainnet (677) is known internally but can
// never activate in the frontend; promoting to Mainnet is a future, single,
// centralized change.
export const FRONTEND_POLICY: FrontendPolicy = {
  environment: "testnet",
  requiredChainId: BOT_TESTNET_CHAIN_ID,
  writesEnabled: false,
};

export function isFrontendUsableChain(chainId: number | bigint | undefined): boolean {
  if (chainId === undefined) return false;
  return Number(chainId) === FRONTEND_POLICY.requiredChainId;
}

// Fail closed: only "testnet" is ever accepted in P1. Missing, invalid, or an
// explicit "mainnet" value all resolve to testnet, so Mainnet can never be
// enabled by misconfiguration.
export function resolveFrontendEnvironment(
  raw: string | undefined,
): FrontendPolicy {
  const value = raw?.trim().toLowerCase();
  return value === "testnet"
    ? FRONTEND_POLICY
    : { ...FRONTEND_POLICY };
}

export const MAINNET_CHAIN_ID = BOT_CHAIN_ID;
```

- [ ] **Step 4: Implement `lib/chain/read-state.ts`**

```ts
import { formatUnits } from "viem";

export type ReadPhase = "idle" | "loading" | "ready" | "unavailable";

export interface ReadStateInput {
  isPending?: boolean;
  isFetched?: boolean;
  isError?: boolean;
}

// A failed read is "unavailable", never "ready". Zero is only a valid ready
// value when the chain actually returned it.
export function deriveReadState(info: ReadStateInput): ReadPhase {
  if (info.isError) return "unavailable";
  if (!info.isFetched) return info.isPending ? "loading" : "idle";
  return "ready";
}

export function formatTokenAmount(
  units: bigint | undefined,
  decimals: number,
): string | null {
  if (units === undefined) return null;
  return formatUnits(units, decimals);
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run tests/unit/frontend-policy.test.ts`. Expected: PASS.

- [ ] **Step 6: Verify types and lint**

Run: `npx tsc --noEmit` and `npm run lint`. Expected: both exit 0.

- [ ] **Step 7: Commit**

```bash
git add lib/chain/frontend-policy.ts lib/chain/read-state.ts tests/unit/frontend-policy.test.ts
git commit -m "feat(chain): add frontend environment policy and read-state helpers"
```

### Task 3: Wagmi Config And Provider Boundary

**Files:**
- Create: `lib/chain/wagmi-config.ts` (client-only module)
- Create: `components/providers/web3-provider.tsx`
- Modify: `app/layout.tsx`

**Interfaces:**
- Consumes: `botTestnet` from `./bot-testnet`, `BOT_TESTNET_RPC_URL`.
- Produces: `wagmiConfig` (chains: [botTestnet], injected connectors only), `Web3Providers` client boundary, wired into the root layout without making the whole layout client-side.

- [ ] **Step 1: Create `lib/chain/wagmi-config.ts`**

```ts
import { createConfig, http } from "wagmi";
import { injected } from "wagmi/connectors";
import { botTestnet, BOT_TESTNET_RPC_URL } from "@/lib/chain/bot-testnet";

export const wagmiConfig = createConfig({
  chains: [botTestnet],
  connectors: [injected()],
  transports: {
    [botTestnet.id]: http(BOT_TESTNET_RPC_URL),
  },
  ssr: true,
});
```

- [ ] **Step 2: Create `components/providers/web3-provider.tsx`**

```tsx
"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { WagmiProvider } from "wagmi";
import { wagmiConfig } from "@/lib/chain/wagmi-config";

export function Web3Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 15_000, refetchInterval: 30_000 },
        },
      }),
  );

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}
```

- [ ] **Step 3: Wire into `app/layout.tsx`**

Add the provider around `{children}` inside `<body>`, keeping the layout a server component:

```tsx
import { Web3Providers } from "@/components/providers/web3-provider";
// ...
<body>{<Web3Providers>{children}</Web3Providers>}</body>
```

- [ ] **Step 4: Verify types, lint, and build**

Run: `npx tsc --noEmit`, `npm run lint`. Then `npm run build`. Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add lib/chain/wagmi-config.ts components/providers/web3-provider.tsx app/layout.tsx
git commit -m "feat(web3): add wagmi config and provider boundary"
```

### Task 4: Wallet And Chain-Data Hooks

**Files:**
- Create: `lib/chain/frontend-hooks.ts` (client-only hooks)

**Interfaces:**
- Consumes: Wagmi `useAccount`, `useChainId`, `useBalance`, `useReadContract`, `erc20Abi` (viem), `FRONTEND_POLICY`, `isFrontendUsableChain`, `deriveReadState`, `BOT_TESTNET_SETTLEMENT_TOKEN`.
- Produces: `useWalletConnection`, `useBotNetwork`, `useNativeBalance`, `useSettlementTokenBalance`, and a shared `UseChainRead` result type.

- [ ] **Step 1: Create `lib/chain/frontend-hooks.ts`**

```ts
"use client";

import { useAccount, useBalance, useChainId, useReadContract } from "wagmi";
import { erc20Abi } from "viem";
import {
  FRONTEND_POLICY,
  isFrontendUsableChain,
} from "@/lib/chain/frontend-policy";
import { BOT_TESTNET_SETTLEMENT_TOKEN } from "@/lib/chain/settlement-token";
import { deriveReadState, type ReadPhase } from "@/lib/chain/read-state";

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
  const chainId = useChainId();
  return {
    chainId,
    requiredChainId: FRONTEND_POLICY.requiredChainId,
    isBotTestnet: isFrontendUsableChain(chainId),
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
    phase: deriveReadState(query),
    isFetching: query.isFetching,
    refetch: () => void query.refetch(),
    data: query.data ?? null,
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
    address: enabled
      ? BOT_TESTNET_SETTLEMENT_TOKEN.address
      : undefined,
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
    phase: deriveReadState(query),
    isFetching: query.isFetching,
    refetch: () => void query.refetch(),
    data: query.data ?? null,
  };
}
```

Add the shared placeholder constant at the top of the module:

```ts
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
```

Note: `args` and `address` are `undefined`/placeholder when not enabled, so Wagmi skips the read; `deriveReadState` yields `idle`.

- [ ] **Step 2: Verify types and lint**

Run: `npx tsc --noEmit` and `npm run lint`. Expected: both exit 0.

- [ ] **Step 3: Commit**

```bash
git add lib/chain/frontend-hooks.ts
git commit -m "feat(web3): add wallet and chain-data hooks"
```

### Task 5: Rework The Wallet Dialog Into A Real Connect UI

**Files:**
- Modify: `components/shell/wallet-preview-dialog.tsx`

**Interfaces:**
- Consumes: Wagmi `useConnect`, `useDisconnect`, `useSwitchChain`, `useAccount`, plus the hooks from `frontend-hooks.ts`, `botTestnet`, `BOT_TESTNET_SETTLEMENT_TOKEN`, `FRONTEND_POLICY`, `formatTokenAmount`.
- Produces: a real injected-wallet connect dialog preserving the existing trigger props (`label`, `triggerVariant`, `className`) and visual shell.

- [ ] **Step 1: Replace `components/shell/wallet-preview-dialog.tsx`**

```tsx
"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useEffect, useState } from "react";
import {
  WalletCards,
  X,
  RefreshCw,
  PlugZap,
  ShieldAlert,
  LogOut,
  CheckCircle2,
} from "lucide-react";
import { useAccount, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import { Button, type NostosButtonProps } from "@/components/ui/button";
import { botTestnet } from "@/lib/chain/bot-testnet";
import { FRONTEND_POLICY } from "@/lib/chain/frontend-policy";
import {
  useBotNetwork,
  useNativeBalance,
  useSettlementTokenBalance,
  useWalletConnection,
} from "@/lib/chain/frontend-hooks";
import { formatTokenAmount } from "@/lib/chain/read-state";
import { BOT_TESTNET_SETTLEMENT_TOKEN } from "@/lib/chain/settlement-token";

type ButtonVariant = NonNullable<NostosButtonProps["variant"]>;

const STALE_MESSAGE = "Network data is temporarily delayed.";

function shorten(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function BalanceRow({
  label,
  value,
  phase,
  onRetry,
}: {
  label: string;
  value: string | null;
  phase: "idle" | "loading" | "ready" | "unavailable";
  onRetry: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm font-semibold">{label}</span>
      {phase === "ready" ? (
        <span data-testid={`balance-${label.toLowerCase()}`}>{value}</span>
      ) : phase === "loading" ? (
        <span className="text-muted-foreground">Loading…</span>
      ) : phase === "unavailable" ? (
        <span className="flex items-center gap-2 text-muted-foreground">
          {STALE_MESSAGE}
          <button type="button" onClick={onRetry} aria-label={`Retry ${label}`} className="inline-flex min-h-8 min-w-8 items-center justify-center rounded-control border border-[var(--line)] hover:border-[var(--ink)]">
            <RefreshCw size={14} aria-hidden="true" />
          </button>
        </span>
      ) : (
        <span className="text-muted-foreground">—</span>
      )}
    </div>
  );
}

export function WalletPreviewDialog({
  className = "",
  label = "Connect wallet",
  triggerVariant = "default",
}: {
  className?: string;
  label?: string;
  triggerVariant?: ButtonVariant;
}) {
  const [mounted, setMounted] = useState(false);
  const [switchError, setSwitchError] = useState<string | null>(null);
  const { status, address } = useWalletConnection();
  const { isBotTestnet, chainId } = useBotNetwork();
  const { connectors, connectAsync, isPending: connectPending, error: connectError } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChainAsync, isPending: switchPending } = useSwitchChain();
  const native = useNativeBalance();
  const usdt = useSettlementTokenBalance();

  useEffect(() => {
    setMounted(true);
  }, []);

  // Show only connectors Wagmi actually discovers (provider present).
  const availableConnectors = connectors.filter((c) => c.ready !== false);

  const isConnected = mounted && status === "connected" && address !== undefined;

  const triggerLabel =
    isConnected && address ? shorten(address) : label;

  async function handleSwitch() {
    setSwitchError(null);
    try {
      await switchChainAsync({ chainId: botTestnet.id });
    } catch {
      setSwitchError("Switch declined. Still connected, but BOT Testnet is required.");
    }
  }

  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>
        <Button className={className} variant={triggerVariant} data-testid="wallet-trigger">
          {triggerLabel}
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-[rgba(16,16,16,.55)] backdrop-blur-[2px]" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[min(calc(100%-32px),440px)] -translate-x-1/2 -translate-y-1/2 rounded-card border border-[var(--ink)] bg-white p-6 shadow-[8px_8px_0_var(--ink)] focus:outline-none">
          <div className="flex items-start justify-between gap-4">
            <div>
              <Dialog.Title className="display text-2xl font-bold tracking-[-.03em]">
                {isConnected ? "Wallet connected" : "Connect wallet"}
              </Dialog.Title>
              <Dialog.Description className="mt-3 text-sm leading-6 text-muted-foreground">
                Nostos staging runs on BOT Testnet. Balances shown are live chain data.
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-control border border-transparent hover:border-[var(--ink)]" aria-label="Close wallet dialog">
                <X size={18} aria-hidden="true" />
              </button>
            </Dialog.Close>
          </div>

          <div className="mt-6 flex flex-col gap-3">
            {!isConnected ? (
              availableConnectors.length === 0 ? (
                <p className="rounded-control border border-[var(--line)] bg-[#fbfaf8] p-4 text-sm leading-6 text-muted-foreground">
                  No injected wallet detected. Install an EVM wallet extension (for example MetaMask), add BOT Testnet, and refresh.
                </p>
              ) : (
                <>
                  <p className="eyebrow text-muted-foreground">Detected wallets</p>
                  {availableConnectors.map((connector) => (
                    <button
                      key={connector.uid}
                      type="button"
                      disabled={connectPending}
                      onClick={async () => {
                        try {
                          await connectAsync({ connector });
                        } catch {
                          /* wagmi exposes the error below */
                        }
                      }}
                      className="flex min-h-12 w-full items-center justify-between rounded-control border border-[var(--line)] bg-[#fbfaf8] px-4 text-left text-sm font-semibold hover:border-[var(--ink)] disabled:opacity-50"
                    >
                      <span className="flex items-center gap-3">
                        <WalletCards size={18} aria-hidden="true" />
                        {connector.name}
                      </span>
                      {connectPending ? "Waiting for approval…" : <PlugZap size={16} aria-hidden="true" />}
                    </button>
                  ))}
                </>
              )
            ) : !isBotTestnet ? (
              <>
                <div className="flex items-center gap-3 rounded-control border border-[var(--ink)] bg-[#fbfaf8] p-4">
                  <ShieldAlert size={18} aria-hidden="true" />
                  <div>
                    <p className="text-sm font-bold">BOT TESTNET REQUIRED</p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      You are on chain {chainId ?? "unknown"}. Nostos staging only works on BOT Testnet (968).
                    </p>
                  </div>
                </div>
                <Button
                  variant="default"
                  disabled={switchPending}
                  onClick={handleSwitch}
                >
                  {switchPending ? "Switching…" : "Switch network"}
                </Button>
                {switchError && (
                  <p className="text-xs leading-5 text-muted-foreground">{switchError}</p>
                )}
                <button type="button" onClick={() => disconnect()} className="inline-flex min-h-11 items-center justify-center gap-2 text-sm font-semibold text-muted-foreground hover:text-[var(--ink)]">
                  <LogOut size={16} aria-hidden="true" /> Disconnect
                </button>
              </>
            ) : (
              <>
                <div className="flex items-center gap-3 rounded-control border border-[var(--line)] bg-[#fbfaf8] p-4">
                  <CheckCircle2 size={18} aria-hidden="true" />
                  <div className="min-w-0">
                    <p className="truncate font-mono text-sm font-semibold" data-testid="connected-address">{address}</p>
                    <p className="mt-1 text-xs text-muted-foreground">BOT TESTNET (968) · connected</p>
                  </div>
                </div>
                <div className="flex flex-col gap-2 rounded-control border border-[var(--line)] p-4">
                  <BalanceRow
                    label="tBOT"
                    value={
                      native.phase === "ready"
                        ? `${formatTokenAmount(native.data ?? undefined, 18)} tBOT`
                        : null
                    }
                    phase={native.phase}
                    onRetry={native.refetch}
                  />
                  <BalanceRow
                    label="USDT"
                    value={
                      usdt.phase === "ready"
                        ? `${formatTokenAmount(usdt.data ?? undefined, BOT_TESTNET_SETTLEMENT_TOKEN.decimals ?? 6)} USDT`
                        : null
                    }
                    phase={usdt.phase}
                    onRetry={usdt.refetch}
                  />
                </div>
                <button type="button" onClick={() => disconnect()} className="inline-flex min-h-11 items-center justify-center gap-2 text-sm font-semibold text-muted-foreground hover:text-[var(--ink)]">
                  <LogOut size={16} aria-hidden="true" /> Disconnect
                </button>
              </>
            )}

            {!isConnected && connectError && (
              <p className="rounded-control border border-[var(--line)] p-3 text-xs leading-5 text-muted-foreground">
                Connection declined or failed. You can try again.
              </p>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
```

- [ ] **Step 2: Verify types, lint, and build**

Run: `npx tsc --noEmit`, `npm run lint`, `npm run build`. Expected: all pass. Fix any icon-name or import issues.

- [ ] **Step 3: Commit**

```bash
git add components/shell/wallet-preview-dialog.tsx
git commit -m "feat(wallet): wire real injected-wallet connection into the shell"
```

### Task 6: Update E2E And Add Client-Import Safety Tests

**Files:**
- Modify: `tests/e2e/nostos.spec.ts` (wallet dialog test)
- Modify: `tests/unit/env-safety.test.ts` (client-import + env scan)

**Interfaces:**
- Produces: an e2e test asserting the truthful disconnected/no-provider state (headless Chromium has no injected provider), and unit tests asserting client code never imports server-only modules or references secret env names.

- [ ] **Step 1: Replace the stale wallet-preview e2e test**

Replace the `wallet preview traps focus...` test with:

```ts
test("wallet dialog shows a truthful no-provider state without fabricated data", async ({ page }) => {
  await page.goto("/explore");
  await page.getByRole("button", { name: /connect wallet/i }).first().press("Enter");
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("dialog")).toContainText(/no injected wallet detected/i);
  await expect(page.getByRole("dialog")).not.toContainText(/0x[a-fA-F0-9]{40}/);
  await expect(page.getByRole("dialog")).not.toContainText(/\d+ tBOT|\d+ USDT/);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();
});
```

Note: in headless Chromium there is no `window.ethereum`, so the injected connector list is empty and this state is deterministic.

- [ ] **Step 2: Extend `tests/unit/env-safety.test.ts`**

Add a test asserting client directories never import server-only chain modules:

```ts
it("keeps server-only chain modules out of client code", () => {
  const forbidden = [
    "builder-wallet",
    "write-proof",
    "write-proof-testnet",
    "testnet-write",
    "guards",
  ];
  const clientDirs = ["app", "components"];
  const offenders: string[] = [];
  for (const dir of clientDirs) {
    for (const file of walk(join(process.cwd(), dir))) {
      const content = readFileSync(file, "utf8");
      for (const mod of forbidden) {
        if (new RegExp(`from ["']@/lib/chain/${mod}["']`).test(content)) {
          offenders.push(`${file} -> ${mod}`);
        }
      }
    }
  }
  expect(offenders).toEqual([]);
});
```

Also add `NEXT_PUBLIC_NOSTOS_ENV` handling note to `.env.example` (Task 7) and keep the existing secret-name scan unchanged (it already covers `BOT_TESTNET_PRIVATE_KEY`).

- [ ] **Step 3: Run the full unit suite**

Run: `npm test`. Expected: all pass.

- [ ] **Step 4: Commit**

```bash
git add tests/e2e/nostos.spec.ts tests/unit/env-safety.test.ts
git commit -m "test: update wallet e2e and add client-import safety checks"
```

### Task 7: Env Example And Docs

**Files:**
- Modify: `.env.example`
- Modify: `docs/nostos-environments.md`

**Interfaces:**
- Produces: a documented optional frontend env value and a note that P1 is testnet-only.

- [ ] **Step 1: Extend `.env.example`**

Append:

```env
# Frontend environment (optional). Only "testnet" is accepted in P1.
# Missing, invalid, or an explicit "mainnet" value fails closed to testnet.
NEXT_PUBLIC_NOSTOS_ENV=testnet
```

- [ ] **Step 2: Extend `docs/nostos-environments.md`**

Add a `## Frontend (P1)` note:

```markdown
## Frontend (P1)

- The live frontend is explicitly gated to BOT Testnet (968); writes are disabled.
- BOT Mainnet (677) is known internally but cannot activate in the frontend, even if a wallet connects on 677.
- Injected/EIP-1193 wallets only. No WalletConnect in P1.
- Live balances (tBOT, Testnet USDT) are read only when the wallet is on BOT Testnet; failed reads are shown as unavailable, never as zero.
```

- [ ] **Step 3: Commit**

```bash
git add .env.example docs/nostos-environments.md
git commit -m "docs: document P1 frontend testnet gate"
```

### Task 8: Full Verification And Manual Browser Script

**Files:**
- Verify: all P1 files.

**Interfaces:**
- Consumes: completed tasks 1-7.
- Produces: green gate and a manual browser test script for the user.

- [ ] **Step 1: Run the deterministic gate**

Run: `npm test`, `npx tsc --noEmit`, `npm run lint`, `npm run build`. Expected: all exit 0.

- [ ] **Step 2: Run the e2e suite (disconnected states)**

Run: `npm run test:e2e`. Expected: all pass (headless, no injected provider). If the dev server/Playwright needs a base URL, use the project's existing convention.

- [ ] **Step 3: Update agent state**

Refresh `.agent-state/project-state.md`, `.agent-state/memory.md`, `.agent-state/left-off.md` with P1 facts (testnet-only frontend, wagmi layer, live reads, no writes, next milestone P2).

- [ ] **Step 4: Compile the completion report**

Include the 13 required items plus the manual browser test script (Section 11 of the brief) and env/manual setup steps.

- [ ] **Step 5: Commit state updates**

```bash
git add .agent-state
git commit -m "docs(agent-state): record P1 live wallet foundation"
```