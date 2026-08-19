"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Compass } from "lucide-react";
import {
  DataPanel,
  DefinitionRows,
  ProductGrid,
  StateNotice,
} from "@/components/product/product-primitives";
import { PageHeading } from "@/components/ui/page-heading";
import { StatusBadge } from "@/components/ui/status-badge";
import type { CatalogAsset, CatalogAssetResponse } from "@/lib/rwa/discovery/types";
import { formatRank, formatUsdAmount } from "@/lib/rwa/discovery/format";
import { NOT_REPORTED } from "@/lib/rwa/display";

export function DiscoveredAssetDetail({ id }: { id: string }) {
  const router = useRouter();
  const [item, setItem] = useState<CatalogAsset | null>(null);
  const [status, setStatus] = useState<"loading" | "missing" | "ready">("loading");

  useEffect(() => {
    const controller = new AbortController();
    const lookup = (() => {
      try {
        return decodeURIComponent(id);
      } catch {
        return id;
      }
    })();
    fetch(`/api/rwa/assets/${encodeURIComponent(lookup)}`, { signal: controller.signal })
      .then(async (response) => {
        if (response.status === 404) {
          setStatus("missing");
          return null;
        }
        if (!response.ok) throw new Error("unavailable");
        return (await response.json()) as CatalogAssetResponse;
      })
      .then((payload) => {
        if (!payload) return;
        if (payload.item.curatedSlug) {
          router.replace(`/vaults/${payload.item.curatedSlug}`);
          return;
        }
        setItem(payload.item);
        setStatus("ready");
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setStatus("missing");
        void error;
      });
    return () => controller.abort();
  }, [id, router]);

  if (status === "loading") {
    return (
      <>
        <PageHeading
          eyebrow="Nostos Gateway"
          title="Discovered asset"
          description="Loading discovery details from the Nostos catalog."
        />
        <div className="mt-8">
          <StateNotice
            title="Loading"
            message="Loading live discovery. Missing market values are not shown as zero while this request is in flight."
          />
        </div>
      </>
    );
  }

  if (status === "missing" || !item) {
    return (
      <>
        <PageHeading eyebrow="Nostos Gateway" title="Asset not found" />
        <div className="mt-8">
          <StateNotice
            title="Not in catalog"
            message="This discovery id is not in the Nostos catalog."
          />
        </div>
      </>
    );
  }

  const token = item.tokenRepresentations[0];
  return (
    <>
      <PageHeading
        eyebrow="Nostos Gateway"
        title={item.name}
        description={
          item.description ??
          "Discovered from CoinMarketCap. Nostos has not integrated execution for this asset."
        }
        actions={
          <StatusBadge
            label="DISCOVERED"
            tone="neutral"
            icon={<Compass size={14} aria-hidden="true" />}
          />
        }
      />
      <div className="mt-8">
        <StateNotice
          title="Discovery only / Nostos execution is not yet available for this asset."
          message="This record is indexed for research. Deposit, redeem, and instant cashout are not available through Nostos."
          tone="warning"
        />
      </div>
      <ProductGrid className="mt-6">
        <DataPanel title="Overview" description="Identity fields returned by the discovery provider.">
          <DefinitionRows
            rows={[
              { label: "Canonical ID", value: item.canonicalId },
              { label: "Symbol", value: item.symbol ?? NOT_REPORTED },
              { label: "Slug", value: item.slug ?? NOT_REPORTED },
              { label: "Asset class", value: item.assetClass ?? NOT_REPORTED },
              { label: "Issuer", value: item.issuer?.name ?? NOT_REPORTED },
              { label: "Freshness", value: item.freshness === "stale" ? "Stale" : "Fresh" },
            ]}
          />
        </DataPanel>
        <DataPanel title="Market data" description="Tokenized aggregate quotes when the provider reports them.">
          <DefinitionRows
            rows={[
              { label: "Price (USD)", value: formatUsdAmount(item.priceUsd) },
              { label: "Tokenized market cap", value: formatUsdAmount(item.tokenizedMarketCapUsd) },
              { label: "24h volume", value: formatUsdAmount(item.volume24hUsd) },
              { label: "Rank", value: formatRank(item.rank) },
              { label: "Last updated", value: item.lastUpdated ?? NOT_REPORTED },
            ]}
          />
        </DataPanel>
        <DataPanel title="Issuer" description="Issuer fields are shown only when the provider supplies them.">
          <DefinitionRows
            rows={[
              { label: "Issuer name", value: item.issuer?.name ?? NOT_REPORTED },
              { label: "Issuer id", value: item.issuer?.id ?? NOT_REPORTED },
            ]}
          />
        </DataPanel>
        <DataPanel title="Token representations" description="On-chain tokens linked to this RWA, when present.">
          <DefinitionRows
            rows={[
              {
                label: "Token",
                value: token
                  ? [token.name, token.symbol, token.cryptoId].filter(Boolean).join(" · ")
                  : NOT_REPORTED,
              },
            ]}
          />
        </DataPanel>
        <DataPanel title="Source provenance" description="Where these fields were retrieved.">
          <DefinitionRows
            rows={[
              { label: "Market", value: item.marketProvenance ?? NOT_REPORTED },
              { label: "Product terms", value: item.issuerTermsProvenance ?? NOT_REPORTED },
              {
                label: "Integration",
                value: item.integrationProvenance ?? "Integration: Nostos Registry",
              },
              { label: "Retrieved at", value: item.retrievedAt },
            ]}
          />
        </DataPanel>
        <DataPanel title="Nostos availability" description="Discovery does not imply execution.">
          <StateNotice
            title="No adapter"
            message="Discovery only / Nostos execution is not yet available for this asset."
          />
        </DataPanel>
      </ProductGrid>
    </>
  );
}
