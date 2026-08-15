"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { ArrowUpRight, WalletCards, X } from "lucide-react";
import { Button, type NostosButtonProps } from "@/components/ui/button";

type ButtonVariant = NonNullable<NostosButtonProps["variant"]>;

export function WalletPreviewDialog({
  className = "",
  label = "Connect wallet",
  triggerVariant = "default",
}: {
  className?: string;
  label?: string;
  triggerVariant?: ButtonVariant;
}) {
  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>
        <Button className={className} variant={triggerVariant}>
          {label}
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-[rgba(16,16,16,.55)] backdrop-blur-[2px]" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[min(calc(100%-32px),440px)] -translate-x-1/2 -translate-y-1/2 rounded-card border border-[var(--ink)] bg-white p-6 shadow-[8px_8px_0_var(--ink)] focus:outline-none">
          <div className="flex items-start justify-between gap-4">
            <div>
              <Dialog.Title className="display text-2xl font-bold tracking-[-.03em]">Wallet connection is next.</Dialog.Title>
              <Dialog.Description className="mt-3 text-sm leading-6 text-muted-foreground">
                Connect a wallet to view eligible vaults and submit a redemption request on BOT Chain. Wallet integration is not available in this UI phase.
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-control border border-transparent hover:border-[var(--ink)]" aria-label="Close wallet preview">
                <X size={18} aria-hidden="true" />
              </button>
            </Dialog.Close>
          </div>
          <div className="mt-6 flex flex-col gap-3">
            <p className="eyebrow text-muted-foreground">Supported wallet paths</p>
            {["MetaMask", "OKX Wallet", "WalletConnect"].map((name) => (
              <button key={name} type="button" disabled className="flex min-h-12 w-full items-center justify-between rounded-control border border-[var(--line)] bg-[#fbfaf8] px-4 text-left text-sm font-semibold text-muted-foreground">
                <span className="flex items-center gap-3"><WalletCards size={18} aria-hidden="true" />{name}</span>
                <ArrowUpRight size={16} aria-hidden="true" />
              </button>
            ))}
          </div>
          <p className="mt-6 border-t border-[var(--line)] pt-4 text-xs leading-5 text-muted-foreground">This preview does not detect providers, connect accounts, or create a transaction.</p>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
