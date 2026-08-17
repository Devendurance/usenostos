import type { Metadata } from "next";
import { Compass } from "lucide-react";
import { ExplorerControls } from "@/components/product/explorer-controls";
import { ProductPage, StateNotice } from "@/components/product/product-primitives";
import { PageHeading } from "@/components/ui/page-heading";
import { StatusBadge } from "@/components/ui/status-badge";
import { listOpportunities } from "@/lib/rwa/opportunities";

export const metadata: Metadata = {
  title: "Explore vaults",
  description:
    "Compare selected RWA opportunities and their source-backed terms through the Nostos Gateway.",
};

export default function ExplorePage() {
  const opportunities = listOpportunities();
  return (
    <ProductPage>
      <PageHeading
        eyebrow="Nostos Gateway"
        title="See the yield. Know the exit."
        description="Compare selected RWA opportunities by their source-backed terms and integration status. Current APY, TVL, and NAV are shown only when a live source is available."
        actions={
          <StatusBadge
            label={`${opportunities.length} in discovery`}
            tone="pending"
            icon={<Compass size={14} aria-hidden="true" />}
          />
        }
      />
      <div className="mt-8">
        <StateNotice
          title="Discovery only"
          message="OUSG and TBILL are real issuer products surfaced for research. They are not BOT Chain-native Nostos vaults yet, so no deposit or redemption is available through Nostos."
        />
      </div>
      <div className="mt-6">
        <ExplorerControls opportunities={opportunities} />
      </div>
    </ProductPage>
  );
}