"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useState, useSyncExternalStore } from "react";
import {
  WalletCards,
  X,
  RefreshCw,
  PlugZap,
  ShieldAlert,
  LogOut,
  CheckCircle2,
} from "lucide-react";
import { useConnect, useDisconnect, useSwitchChain } from "wagmi";
import { Button, type NostosButtonProps } from "@/components/ui/button";
import { botTestnet } from "@/lib/chain/bot-testnet";
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
          <button
            type="button"
            onClick={onRetry}
            aria-label={`Retry ${label}`}
            className="inline-flex min-h-8 min-w-8 items-center justify-center rounded-control border border-[var(--line)] hover:border-[var(--ink)]"
          >
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
  const [switchError, setSwitchError] = useState<string | null>(null);

  // Client-only flag: true after hydration, false during SSR, so connected
  // wallet UI never causes a server/client markup mismatch.
  const isHydrated = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const { status, address } = useWalletConnection();
  const { isBotTestnet, chainId } = useBotNetwork();
  const {
    connectors,
    connectAsync,
    isPending: connectPending,
    error: connectError,
  } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChainAsync, isPending: switchPending } = useSwitchChain();
  const native = useNativeBalance();
  const usdt = useSettlementTokenBalance();

  // Only render the provider check after hydration; `window` is undefined
  // during SSR. When no EIP-1193 provider exists, connecting is impossible,
  // so the dialog shows a truthful no-provider state instead of a dead button.
  const hasInjectedProvider =
    isHydrated &&
    typeof window !== "undefined" &&
    Boolean((window as { ethereum?: unknown }).ethereum);

  // Show only connectors Wagmi actually discovers (provider present).
  const availableConnectors = connectors.filter((c) => c.ready !== false);

  const isConnected =
    isHydrated && status === "connected" && address !== undefined;

  const triggerLabel = isConnected && address ? shorten(address) : label;

  async function handleSwitch() {
    setSwitchError(null);
    try {
      await switchChainAsync({ chainId: botTestnet.id });
    } catch {
      setSwitchError(
        "Switch declined. Still connected, but BOT Testnet is required.",
      );
    }
  }

  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>
        <Button
          className={className}
          variant={triggerVariant}
          data-testid="wallet-trigger"
        >
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
                Nostos staging runs on BOT Testnet. Balances shown are live
                chain data.
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button
                className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-control border border-transparent hover:border-[var(--ink)]"
                aria-label="Close wallet dialog"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </Dialog.Close>
          </div>

          <div className="mt-6 flex flex-col gap-3">
            {!isConnected ? (
              availableConnectors.length === 0 || !hasInjectedProvider ? (
                <p className="rounded-control border border-[var(--line)] bg-[#fbfaf8] p-4 text-sm leading-6 text-muted-foreground">
                  No injected wallet detected. Install an EVM wallet extension
                  (for example MetaMask), add BOT Testnet, and refresh.
                </p>
              ) : (
                <>
                  <p className="eyebrow text-muted-foreground">
                    Detected wallets
                  </p>
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
                      {connectPending ? (
                        "Waiting for approval…"
                      ) : (
                        <PlugZap size={16} aria-hidden="true" />
                      )}
                    </button>
                  ))}
                </>
              )
            ) : !isBotTestnet ? (
              <>
                <div className="rounded-control border border-[var(--line)] bg-[#fbfaf8] p-4">
                  <p
                    className="truncate font-mono text-sm font-semibold"
                    data-testid="connected-address"
                  >
                    {address}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Connected · wrong network
                  </p>
                </div>
                <div className="flex items-center gap-3 rounded-control border border-[var(--ink)] bg-[#fbfaf8] p-4">
                  <ShieldAlert size={18} aria-hidden="true" />
                  <div>
                    <p className="text-sm font-bold">BOT TESTNET REQUIRED</p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      You are on chain {chainId ?? "unknown"}. Nostos staging
                      only works on BOT Testnet (968).
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
                  <p className="text-xs leading-5 text-muted-foreground">
                    {switchError}
                  </p>
                )}
                <button
                  type="button"
                  onClick={() => disconnect()}
                  className="inline-flex min-h-11 items-center justify-center gap-2 text-sm font-semibold text-muted-foreground hover:text-[var(--ink)]"
                >
                  <LogOut size={16} aria-hidden="true" /> Disconnect
                </button>
              </>
            ) : (
              <>
                <div className="flex items-center gap-3 rounded-control border border-[var(--line)] bg-[#fbfaf8] p-4">
                  <CheckCircle2 size={18} aria-hidden="true" />
                  <div className="min-w-0">
                    <p
                      className="truncate font-mono text-sm font-semibold"
                      data-testid="connected-address"
                    >
                      {address}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      BOT TESTNET (968) · connected
                    </p>
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
                        ? `${formatTokenAmount(
                            usdt.data ?? undefined,
                            BOT_TESTNET_SETTLEMENT_TOKEN.decimals ?? 6,
                          )} USDT`
                        : null
                    }
                    phase={usdt.phase}
                    onRetry={usdt.refetch}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => disconnect()}
                  className="inline-flex min-h-11 items-center justify-center gap-2 text-sm font-semibold text-muted-foreground hover:text-[var(--ink)]"
                >
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