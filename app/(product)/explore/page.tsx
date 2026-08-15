import type { Metadata } from "next";
import { Compass } from "lucide-react";
import { ExplorerControls } from "@/components/product/explorer-controls";
import { DataPanel, ProductPage, StateNotice } from "@/components/product/product-primitives";
import { PageHeading } from "@/components/ui/page-heading";
import { StatusBadge } from "@/components/ui/status-badge";

export const metadata: Metadata = { title: "Explore vaults", description: "Compare selected RWA vault terms and settlement paths through the Nostos Gateway." };

export default function ExplorePage() {
  return <ProductPage><PageHeading eyebrow="Nostos Gateway" title="See the yield. Know the exit." description="Compare selected RWA opportunities by their terms, settlement path, and available liquidity before you deposit." actions={<StatusBadge label="Integration pending" tone="pending" icon={<Compass size={14} aria-hidden="true" />} />} /><div className="mt-8"><StateNotice title="Live registry data is not connected" message="No vaults, yields, liquidity figures, or safety scores are shown until a verified data source is available." /></div><DataPanel className="mt-6" title="Vault explorer" description="Filter and sort controls work locally. Results remain empty until the Nostos Registry is integrated."><ExplorerControls /></DataPanel></ProductPage>;
}
