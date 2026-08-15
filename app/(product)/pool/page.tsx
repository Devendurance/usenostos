import type { Metadata } from "next";
import { Droplets } from "lucide-react";
import { AmountForm } from "@/components/product/amount-form";
import { DataPanel, Metric, ProductGrid, ProductPage, StateNotice } from "@/components/product/product-primitives";
import { PageHeading } from "@/components/ui/page-heading";
import { StatusBadge } from "@/components/ui/status-badge";

export const metadata: Metadata = { title: "Instant pool", description: "Review the Nostos Instant liquidity pool interface and position controls." };

export default function PoolPage() {
  return <ProductPage><PageHeading eyebrow="Nostos Instant" title="Liquidity for a defined claim." description="The pool is designed to purchase eligible pending claims at disclosed terms when verified capacity is available." actions={<StatusBadge label="No liquidity data" tone="neutral" icon={<Droplets size={14} aria-hidden="true" />} />} /><ProductGrid className="mt-8"><Metric label="Available capacity" hint="No pool adapter connected" /><Metric label="Claims exposure" hint="No pool adapter connected" /><Metric label="Your position" hint="Wallet disconnected" /></ProductGrid><div className="mt-6"><StateNotice title="Instant liquidity unavailable" message="No live capacity, pricing, or claim exposure is available. This page does not imply that any redemption can be cashed out." tone="warning" /></div><div className="mt-6 grid gap-6 lg:grid-cols-2"><DataPanel title="Provide liquidity" description="Review asset, allowance, and expected pool shares before a future deposit."><AmountForm purpose="pool-deposit" actionLabel="Deposit unavailable" /></DataPanel><DataPanel title="Withdraw liquidity" description="A connected wallet position will determine the withdrawable amount."><AmountForm purpose="pool-withdraw" assetLabel="Pool share amount" actionLabel="Withdraw unavailable" /></DataPanel></div><DataPanel className="mt-6" title="Capacity and exposure" description="Pool utilization and claim concentration will appear only when verified contract reads are available."><div className="grid gap-4 sm:grid-cols-2"><Metric label="Utilization" /><Metric label="Pending claim exposure" /></div></DataPanel></ProductPage>;
}
