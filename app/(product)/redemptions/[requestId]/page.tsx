import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CircleDashed } from "lucide-react";
import { DataPanel, DefinitionRows, ProductPage, StateNotice } from "@/components/product/product-primitives";
import { PageHeading } from "@/components/ui/page-heading";
import { StatusBadge } from "@/components/ui/status-badge";

export const metadata: Metadata = { title: "Redemption request", description: "Inspect the state and settlement path for a Nostos redemption request." };

const numericId = /^\d+$/;

export default async function RedemptionRequestPage({ params }: { params: Promise<{ requestId: string }> }) {
  const { requestId } = await params;
  if (!numericId.test(requestId)) notFound();
  const stages = ["Request recorded", "Pending settlement", "Claimable", "Claimed"];
  return <ProductPage><PageHeading eyebrow="Redemption request" title={`Request #${requestId}`} description="This request identifier came from the route. No registry or chain record has been loaded for it." actions={<StatusBadge label="Record unavailable" tone="neutral" />} /><div className="mt-8"><StateNotice title="Record lookup pending" message="The request cannot be verified until the queue and registry adapters are connected. Do not treat this route as evidence that the request exists." tone="warning" /></div><div className="mt-6 grid gap-6 xl:grid-cols-[1.1fr_.9fr]"><DataPanel title="Settlement timeline" description="Verified state transitions will activate in order as they are recorded."><ol className="space-y-3">{stages.map((stage) => <li key={stage} className="flex min-h-14 items-center gap-3 rounded-control border border-[var(--line)] bg-[#fbfaf8] px-4"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[var(--line-strong)] text-muted-foreground"><CircleDashed size={15} aria-hidden="true" /></span><div><p className="text-sm font-semibold">{stage}</p><p className="text-xs text-muted-foreground">Unverified</p></div></li>)}</ol></DataPanel><DataPanel title="Request details"><DefinitionRows rows={[{ label: "Request ID", value: requestId }, { label: "Vault" }, { label: "Owner" }, { label: "Shares" }, { label: "Estimated assets" }, { label: "Settlement window" }, { label: "Current state" }]} /></DataPanel></div><DataPanel className="mt-6" title="Instant liquidity"><StateNotice title="No eligible quote" message="Instant cashout becomes available only for a verified pending claim with sufficient pool capacity. A transferred claim may remain unsettled until its underlying settlement completes." /></DataPanel></ProductPage>;
}
