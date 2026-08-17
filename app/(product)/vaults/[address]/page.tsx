import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Landmark, ExternalLink } from "lucide-react";
import {
  DataPanel,
  DefinitionRows,
  ProductGrid,
  ProductPage,
  StateNotice,
} from "@/components/product/product-primitives";
import { PageHeading } from "@/components/ui/page-heading";
import { StatusBadge } from "@/components/ui/status-badge";
import { AmountForm } from "@/components/product/amount-form";
import { DemoVaultPanel } from "@/components/product/demo-vault-panel";
import { getOpportunityBySlug } from "@/lib/rwa/opportunities";
import {
  canRedeem,
  displaySourced,
  sourceAffordance,
} from "@/lib/rwa/display";
import type { SourceReference } from "@/lib/rwa/types";

export const metadata: Metadata = {
  title: "Vault details",
  description:
    "Review an RWA opportunity's source-backed terms and Nostos integration status.",
};

const evmAddress = /^0x[a-fA-F0-9]{40}$/;
function shorten(address: string) {
  return `${address.slice(0, 8)}…${address.slice(-6)}`;
}

export default async function VaultPage({
  params,
}: {
  params: Promise<{ address: string }>;
}) {
  const { address } = await params;
  const opportunity = getOpportunityBySlug(address);

  if (address === "nostos-async-vault") {
    return (
      <ProductPage>
        <PageHeading
          eyebrow="Nostos Gateway"
          title="Nostos Async Settlement Vault"
          description="BOT TESTNET · 0% YIELD · REDEMPTION SUPPORTED. Testnet infrastructure demonstration. This vault does not represent an RWA investment and does not earn yield."
          actions={
            <StatusBadge
              label="REDEMPTION SUPPORTED"
              tone="pending"
              icon={<Landmark size={14} aria-hidden="true" />}
            />
          }
        />
        <div className="mt-8">
          <StateNotice
            title="DEMO / 0% YIELD / TESTNET SETTLEMENT INFRASTRUCTURE"
            message="Synchronous USDT deposit (ERC-4626) and asynchronous redemption (request → PENDING → CLAIMABLE → CLAIMED) are demonstrated against real BOT Testnet USDT. No RWA backing, no yield, no OUSG/TBILL exposure."
            tone="warning"
          />
        </div>
        <div className="mt-6">
          <DemoVaultPanel />
        </div>
      </ProductPage>
    );
  }

  if (opportunity) {
    const redeemEnabled = canRedeem(opportunity);
    const source = (s: { source: SourceReference }) => {
      const a = sourceAffordance(s.source);
      return (
        <a
          href={a.href}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-[var(--ink)]"
        >
          <ExternalLink size={12} aria-hidden="true" />
          {a.label}
          {a.asOf ? ` · ${a.asOf}` : ""}
        </a>
      );
    };
    return (
      <ProductPage>
        <PageHeading
          eyebrow="Nostos Gateway"
          title={opportunity.name}
          description={opportunity.description}
          actions={
            <StatusBadge
              label="DISCOVERY ONLY"
              tone="neutral"
              icon={<Landmark size={14} aria-hidden="true" />}
            />
          }
        />
        <div className="mt-8">
          <StateNotice
            title="DISCOVERY ONLY"
            message="This asset can be researched through Nostos, but direct BOT Chain entry is not yet integrated."
            tone="warning"
          />
        </div>
        <ProductGrid className="mt-6">
          <DataPanel
            title="Product"
            description="Source-backed issuer metadata."
          >
            <DefinitionRows
              rows={[
                { label: "Issuer", value: opportunity.issuer },
                { label: "Category", value: opportunity.category },
                { label: "Networks", value: displaySourced(opportunity.networks) },
                { label: "Networks source", value: source(opportunity.networks) },
                { label: "Eligibility", value: displaySourced(opportunity.eligibility) },
                { label: "Eligibility source", value: source(opportunity.eligibility) },
                {
                  label: "Yield",
                  value: opportunity.yield
                    ? opportunity.yield.value.label
                    : "Not reported",
                },
              ]}
            />
          </DataPanel>
          <DataPanel
            title="Settlement"
            description="Issuer-described entry and exit terms."
          >
            <DefinitionRows
              rows={[
                { label: "Subscription", value: opportunity.settlement.value.subscription },
                { label: "Redemption", value: opportunity.settlement.value.redemption },
                { label: "Processing", value: opportunity.settlement.value.processing },
                { label: "Minimums", value: opportunity.settlement.value.minimums },
                { label: "Settlement source", value: source(opportunity.settlement) },
                ...(opportunity.fees
                  ? [
                      {
                        label: "Fees",
                        value: `${opportunity.fees.value.management ?? ""} ${opportunity.fees.value.notes ?? ""}`.trim(),
                      },
                      { label: "Fees source", value: source(opportunity.fees) },
                    ]
                  : []),
                ...(opportunity.backing
                  ? [
                      { label: "Backing", value: opportunity.backing.value.backing },
                      {
                        label: "Custody",
                        value: opportunity.backing.value.custody ?? "Not reported",
                      },
                      ...(opportunity.backing.value.rating
                        ? [{ label: "Ratings", value: opportunity.backing.value.rating }]
                        : []),
                      { label: "Backing source", value: source(opportunity.backing) },
                    ]
                  : []),
              ]}
            />
          </DataPanel>
        </ProductGrid>
        <div className="mt-6 grid gap-6 xl:grid-cols-[1.1fr_.9fr]">
          <DataPanel
            title="Nostos integration"
            description="Direct BOT Chain entry is not integrated for this asset."
          >
            <StateNotice
              title="Deposit unavailable"
              message="This product is DISCOVERY ONLY in Nostos. Approvals, deposits, redemptions, and instant cashouts are not available."
            />
          </DataPanel>
          <DataPanel
            title="Deposit"
            description="Disabled for discovery-only assets."
          >
            <AmountForm
              purpose="vault-deposit"
              actionLabel="Deposit unavailable"
            />
            <div className="mt-5">
              <StateNotice
                title="Redemption disabled"
                message={
                  redeemEnabled
                    ? "Redemption is available in Nostos for this asset."
                    : "Redemption is not available for this DISCOVERY ONLY asset."
                }
              />
            </div>
          </DataPanel>
        </div>
      </ProductPage>
    );
  }

  if (!evmAddress.test(address)) notFound();
  return (
    <ProductPage>
      <PageHeading
        eyebrow="Nostos Vaults"
        title={`Vault ${shorten(address)}`}
        description="This address came from the route. No registry record has verified its issuer, asset, yield, eligibility, or settlement terms."
        actions={
          <StatusBadge
            label="Vault unavailable"
            tone="neutral"
            icon={<Landmark size={14} aria-hidden="true" />}
          />
        }
      />
      <div className="mt-8">
        <StateNotice
          title="Vault integration pending"
          message="This valid-shaped address is not yet backed by a connected registry record."
          tone="warning"
        />
      </div>
    </ProductPage>
  );
}