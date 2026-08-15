"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { WalletPreviewDialog } from "@/components/shell/wallet-preview-dialog";

export function AmountForm({ purpose, assetLabel = "Asset amount", actionLabel }: { purpose: string; assetLabel?: string; actionLabel: string }) {
  const [amount, setAmount] = useState("");
  return (
    <form onSubmit={(event) => event.preventDefault()}>
      <Input id={`${purpose}-amount`} name="amount" label={assetLabel} inputMode="decimal" autoComplete="off" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0.00" hint="Balances and asset decimals will be available after wallet and contract integration." />
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Button type="submit" disabled className="w-full disabled:opacity-45">{actionLabel}</Button>
        <WalletPreviewDialog className="w-full" />
      </div>
      <p className="mt-4 text-xs leading-5 text-[var(--muted)]">Entering an amount does not create an approval, quote, request, or transaction.</p>
    </form>
  );
}
