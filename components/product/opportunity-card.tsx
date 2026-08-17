import Link from "next/link";
import { ExternalLink, ArrowUpRight } from "lucide-react";
import type { RwaOpportunity } from "@/lib/rwa/types";
import { displaySourced, sourceAffordance } from "@/lib/rwa/display";
import { StatusBadge } from "@/components/ui/status-badge";

export function OpportunityCard({
  opportunity,
}: {
  opportunity: RwaOpportunity;
}) {
  const yieldAff = opportunity.yield
    ? sourceAffordance(opportunity.yield.source)
    : null;
  return (
    <article className="flex flex-col gap-4 rounded-card border border-[var(--line)] bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="display text-xl font-semibold tracking-[-.02em]">
            {opportunity.name}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {opportunity.issuer}
          </p>
        </div>
        <StatusBadge label="DISCOVERY ONLY" tone="neutral" />
      </div>
      <p className="text-sm leading-6 text-muted-foreground">
        {opportunity.description}
      </p>
      <dl className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="eyebrow text-muted-foreground">Category</dt>
          <dd className="mt-1 font-semibold">{opportunity.category}</dd>
        </div>
        <div>
          <dt className="eyebrow text-muted-foreground">Networks</dt>
          <dd className="mt-1 font-semibold">
            {displaySourced(opportunity.networks)}
          </dd>
        </div>
        <div>
          <dt className="eyebrow text-muted-foreground">Yield</dt>
          <dd className="mt-1 font-semibold">
            {opportunity.yield ? "See issuer" : "Not reported"}
          </dd>
        </div>
        <div>
          <dt className="eyebrow text-muted-foreground">Settlement</dt>
          <dd className="mt-1 font-semibold">
            {opportunity.settlement.value.redemption}
          </dd>
        </div>
      </dl>
      <div className="mt-auto flex items-center justify-between gap-3">
        <Link
          href={`/vaults/${opportunity.slug}`}
          className="inline-flex min-h-11 items-center gap-2 rounded-control border border-[var(--ink)] px-4 text-sm font-semibold hover:bg-black/[.04]"
        >
          View details <ArrowUpRight size={16} aria-hidden="true" />
        </Link>
        {yieldAff && (
          <a
            href={yieldAff.href}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-[var(--ink)]"
          >
            <ExternalLink size={13} aria-hidden="true" /> {yieldAff.label}
            {yieldAff.asOf ? ` · as of ${yieldAff.asOf}` : ""}
          </a>
        )}
      </div>
    </article>
  );
}