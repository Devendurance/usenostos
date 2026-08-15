import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Landmark } from "lucide-react";
import { AmountForm } from "@/components/product/amount-form";
import { DataPanel, DefinitionRows, Metric, ProductGrid, ProductPage, StateNotice, TableEmpty } from "@/components/product/product-primitives";
import { PageHeading } from "@/components/ui/page-heading";
import { StatusBadge } from "@/components/ui/status-badge";

export const metadata: Metadata = { title: "Vault details", description: "Review a Nostos vault's terms, eligibility, settlement path, and deposit interface." };
const evmAddress = /^0x[a-fA-F0-9]{40}$/;
function shorten(address: string) { return `${address.slice(0, 8)}…${address.slice(-6)}`; }

export default async function VaultPage({ params }: { params: Promise<{ address: string }> }) {
  const { address } = await params;
  if (!evmAddress.test(address)) notFound();
  return <ProductPage><PageHeading eyebrow="Nostos Vaults" title={`Vault ${shorten(address)}`} description="This address came from the route. No registry record has verified its issuer, asset, yield, eligibility, or settlement terms." actions={<StatusBadge label="Vault unavailable" tone="neutral" icon={<Landmark size={14} aria-hidden="true" />} />} /><div className="mt-8"><StateNotice title="Vault integration pending" message="This valid-shaped address is not yet backed by a connected registry record. Existing requests would remain visible after integration even if deposits were unavailable." tone="warning" /></div><ProductGrid className="mt-6"><Metric label="Net APY" hint="Source and timestamp unavailable" /><Metric label="Total value locked" hint="Contract read unavailable" /><Metric label="Settlement window" hint="Vault terms unavailable" /></ProductGrid><div className="mt-6 grid gap-6 xl:grid-cols-[1.1fr_.9fr]"><DataPanel title="Vault terms" description="Review the asset and exit conditions before any future deposit."><DefinitionRows rows={[{ label: "Vault address", value: <span className="break-all font-mono text-xs">{address}</span> }, { label: "Issuer" }, { label: "Underlying asset" }, { label: "Asset category" }, { label: "Fees and minimums" }, { label: "Eligibility" }]} /></DataPanel><DataPanel title="Deposit" description="Approval and deposit remain disabled until wallet, network, registry, and contract integrations are ready."><AmountForm purpose="vault-deposit" actionLabel="Deposit unavailable" /><div className="mt-5"><StateNotice title="Unsupported networks remain blocked" message="A future connected flow will require BOT Chain and will explain how to switch before enabling a transaction." /></div></DataPanel></div><DataPanel className="mt-6" title="Settlement path" description="The complete entry and exit terms must be visible before a deposit can be confirmed."><DefinitionRows rows={[{ label: "Request standard" }, { label: "Queue or batch" }, { label: "Settlement estimate" }, { label: "Instant path" }, { label: "Liquidity capacity" }]} /></DataPanel><DataPanel className="mt-6" title="History" description="Yield and TVL history will use verified time-series data only."><TableEmpty columns={["Period", "Net APY", "TVL", "Source", "Updated"]} title="No history is available" message="No placeholder chart points or sample performance records are displayed." /></DataPanel></ProductPage>;
}
