import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FileSearch } from "lucide-react";
import { DataPanel, DefinitionRows, ProductPage, StateNotice } from "@/components/product/product-primitives";
import { PageHeading } from "@/components/ui/page-heading";
import { StatusBadge } from "@/components/ui/status-badge";

export const metadata: Metadata = { title: "Settlement receipt", description: "Inspect a public Nostos settlement receipt when a verified record is available." };
const numericId = /^\d+$/;

export default async function ReceiptPage({ params }: { params: Promise<{ requestId: string }> }) {
  const { requestId } = await params;
  if (!numericId.test(requestId)) notFound();
  return <ProductPage><PageHeading eyebrow="Nostos Receipt" title="Settlement record" description="A readable record of the vault, path, amounts, state, chain, and transaction—when verified data is available." actions={<StatusBadge label="Record not found" tone="neutral" icon={<FileSearch size={14} aria-hidden="true" />} />} /><div className="mt-8"><StateNotice title="No verified receipt is available" message={`Request #${requestId} came from the route, but no registry lookup has confirmed a settlement receipt. No transaction or Mainnet claim is shown.`} tone="warning" /></div><DataPanel className="mx-auto mt-6 max-w-3xl" title="Nostos settlement"><DefinitionRows rows={[{ label: "Vault" }, { label: "Request", value: `#${requestId}` }, { label: "Path" }, { label: "Gross" }, { label: "Discount" }, { label: "Net" }, { label: "State" }, { label: "Chain" }, { label: "Transaction" }]} /><p className="mt-5 text-xs leading-5 text-muted-foreground">Estimated information and confirmed settlement records will remain visibly distinct after registry integration.</p></DataPanel></ProductPage>;
}
