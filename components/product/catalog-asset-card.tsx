import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { CatalogAsset } from "@/lib/rwa/discovery/types";
import { formatRank, formatUsdAmount } from "@/lib/rwa/discovery/format";
import { StatusBadge } from "@/components/ui/status-badge";

function statusLabel(asset: CatalogAsset): { label: string; tone: "neutral" | "pending" } {
  if (
    asset.integrationStatus === "REDEMPTION_SUPPORTED" ||
    asset.integrationStatus === "DEPOSIT_SUPPORTED" ||
    asset.integrationStatus === "INSTANT_LIQUIDITY_SUPPORTED"
  ) {
    return { label: "REDEMPTION SUPPORTED", tone: "pending" };
  }
  if (asset.kind === "discovered") {
    return { label: "DISCOVERED", tone: "neutral" };
  }
  return { label: "DISCOVERY ONLY", tone: "neutral" };
}

export function CatalogAssetCard({ asset }: { asset: CatalogAsset }) {
  const status = statusLabel(asset);
  const token = asset.tokenRepresentations[0];
  const classLabel = asset.category ?? asset.assetClass ?? "Not reported";
  return (
    <article className="flex flex-col gap-4 rounded-card border border-[var(--line)] bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="display text-xl font-semibold tracking-[-.02em]">
            {asset.name}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {asset.issuer?.name ?? "Not reported"}
          </p>
        </div>
        <StatusBadge label={status.label} tone={status.tone} />
      </div>
      {asset.description && (
        <p className="text-sm leading-6 text-muted-foreground">{asset.description}</p>
      )}
      <dl className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="eyebrow text-muted-foreground">Class</dt>
          <dd className="mt-1 font-semibold">{classLabel}</dd>
        </div>
        <div>
          <dt className="eyebrow text-muted-foreground">Token</dt>
          <dd className="mt-1 font-semibold">
            {token?.symbol ?? token?.name ?? "Not reported"}
          </dd>
        </div>
        <div>
          <dt className="eyebrow text-muted-foreground">Price</dt>
          <dd className="mt-1 font-semibold tabular">{formatUsdAmount(asset.priceUsd)}</dd>
        </div>
        <div>
          <dt className="eyebrow text-muted-foreground">Tokenized mcap</dt>
          <dd className="mt-1 font-semibold tabular">
            {formatUsdAmount(asset.tokenizedMarketCapUsd)}
          </dd>
        </div>
        <div>
          <dt className="eyebrow text-muted-foreground">24h volume</dt>
          <dd className="mt-1 font-semibold tabular">{formatUsdAmount(asset.volume24hUsd)}</dd>
        </div>
        <div>
          <dt className="eyebrow text-muted-foreground">Rank</dt>
          <dd className="mt-1 font-semibold tabular">{formatRank(asset.rank)}</dd>
        </div>
        <div>
          <dt className="eyebrow text-muted-foreground">Yield</dt>
          <dd className="mt-1 font-semibold">{asset.yieldDisplay}</dd>
        </div>
        <div>
          <dt className="eyebrow text-muted-foreground">Freshness</dt>
          <dd className="mt-1 font-semibold">
            {asset.freshness === "stale" ? "Stale" : "Fresh"}
          </dd>
        </div>
      </dl>
      <div className="space-y-1 text-xs text-muted-foreground">
        {asset.marketProvenance && <p>{asset.marketProvenance}</p>}
        {asset.issuerTermsProvenance && <p>{asset.issuerTermsProvenance}</p>}
        {asset.integrationProvenance && <p>{asset.integrationProvenance}</p>}
      </div>
      <div className="mt-auto">
        <Link
          href={asset.href}
          className="inline-flex min-h-11 items-center gap-2 rounded-control border border-[var(--ink)] px-4 text-sm font-semibold hover:bg-black/[.04]"
        >
          View details <ArrowUpRight size={16} aria-hidden="true" />
        </Link>
      </div>
    </article>
  );
}
