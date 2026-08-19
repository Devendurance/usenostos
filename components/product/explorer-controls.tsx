"use client";

import { useEffect, useMemo, useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import type {
  CatalogAsset,
  CatalogDir,
  CatalogIntegration,
  CatalogListResponse,
  CatalogSort,
  ProviderHealthStatus,
} from "@/lib/rwa/discovery/types";
import { CatalogAssetCard } from "@/components/product/catalog-asset-card";
import { StateNotice } from "@/components/product/product-primitives";
import { StatusBadge } from "@/components/ui/status-badge";

const CATEGORY_CHIPS = ["All", "Treasuries", "Testnet Demo"] as const;

type SortOption = CatalogSort;

function availableSorts(items: CatalogAsset[]): SortOption[] {
  const sorts: SortOption[] = ["name"];
  if (items.some((item) => item.tokenizedMarketCapUsd !== null)) sorts.push("marketCap");
  if (items.some((item) => item.volume24hUsd !== null)) sorts.push("volume");
  if (items.some((item) => item.rank !== null)) sorts.push("rank");
  return sorts;
}

function uniqueClasses(items: CatalogAsset[]): string[] {
  const values = new Set<string>();
  for (const item of items) {
    if (item.category) values.add(item.category);
    if (item.assetClass) values.add(item.assetClass);
  }
  return [...values].filter(
    (value) => !CATEGORY_CHIPS.includes(value as (typeof CATEGORY_CHIPS)[number]),
  );
}

function uniqueIssuers(items: CatalogAsset[]): string[] {
  const values = new Set<string>();
  for (const item of items) {
    if (item.issuer?.name) values.add(item.issuer.name);
  }
  return [...values].sort((a, b) => a.localeCompare(b));
}

function statusCopy(
  health: ProviderHealthStatus | null,
  total: number,
  loading: boolean,
): { label: string; tone: "neutral" | "pending" | "warning"; notice?: string } {
  if (loading) {
    return { label: "Loading discovery", tone: "pending", notice: "Loading live discovery. Values are not shown as zero while this request is in flight." };
  }
  if (!health || health === "UNAVAILABLE" || health === "AUTH_FAILED") {
    return {
      label: "CMC provider unavailable",
      tone: "warning",
      notice: "CMC provider unavailable. Curated Nostos records remain listed.",
    };
  }
  if (health === "RATE_LIMITED") {
    return {
      label: "CMC provider unavailable",
      tone: "warning",
      notice: "CoinMarketCap rate limited this request. Curated records remain listed.",
    };
  }
  return { label: `${total} in discovery`, tone: "pending" };
}

export function ExplorerControls({
  initialItems,
}: {
  initialItems: CatalogAsset[];
}) {
  const [category, setCategory] = useState<string>("All");
  const [sort, setSort] = useState<SortOption>("name");
  const [dir, setDir] = useState<CatalogDir>("asc");
  const [q, setQ] = useState("");
  const [issuer, setIssuer] = useState("All");
  const [integration, setIntegration] = useState<CatalogIntegration>("all");
  const [items, setItems] = useState<CatalogAsset[]>(initialItems);
  const [total, setTotal] = useState(initialItems.length);
  const [health, setHealth] = useState<ProviderHealthStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const sorts = availableSorts(items);
  const extraClasses = uniqueClasses([...initialItems, ...items]);
  const issuers = uniqueIssuers([...initialItems, ...items]);
  const activeSort: SortOption = sorts.includes(sort) ? sort : "name";

  useEffect(() => {
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (category !== "All") params.set("assetClass", category);
    if (issuer !== "All") params.set("issuer", issuer);
    params.set("sort", activeSort);
    params.set("dir", dir);
    params.set("integration", integration);
    params.set("page", "1");
    params.set("limit", "50");

    const controller = new AbortController();
    fetch(`/api/rwa/assets?${params.toString()}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("catalog unavailable");
        return (await response.json()) as CatalogListResponse;
      })
      .then((payload) => {
        setItems(payload.items);
        setTotal(payload.total);
        setHealth(payload.provider.health);
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setItems(initialItems);
        setTotal(initialItems.length);
        setHealth("UNAVAILABLE");
        void error;
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [activeSort, category, dir, initialItems, integration, issuer, q]);

  const status = statusCopy(health, total, loading);
  const classes = useMemo(
    () => [...CATEGORY_CHIPS, ...extraClasses],
    [extraClasses],
  );

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <StatusBadge label={status.label} tone={status.tone === "warning" ? "warning" : "pending"} />
      </div>
      {status.notice && (
        <div className="mb-5">
          <StateNotice title={loading ? "Loading" : "Discovery status"} message={status.notice} />
        </div>
      )}
      <div className="flex flex-col gap-4 border-y border-[var(--line)] py-5">
        <label className="flex flex-col gap-2 text-sm font-semibold">
          Search
          <input
            type="search"
            value={q}
            onChange={(event) => setQ(event.target.value)}
            placeholder="Name, symbol, issuer"
            className="min-h-12 rounded-control border border-[var(--ink)] bg-white px-4 text-sm focus-visible:ring-2 focus-visible:ring-[var(--lilac)]"
          />
        </label>
        <fieldset>
          <legend className="eyebrow mb-3 text-muted-foreground">Asset category</legend>
          <div className="flex flex-wrap gap-2">
            {classes.map((item) => (
              <button
                key={item}
                type="button"
                aria-pressed={category === item}
                onClick={() => setCategory(item)}
                className={`min-h-11 rounded-full border px-4 text-sm font-semibold transition-colors ${
                  category === item
                    ? "border-[var(--ink)] bg-[var(--ink)] text-white"
                    : "border-[var(--line-strong)] bg-white hover:border-[var(--ink)]"
                }`}
              >
                {item}
              </button>
            ))}
          </div>
        </fieldset>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          {issuers.length > 0 && (
            <label className="flex min-w-56 flex-col gap-2 text-sm font-semibold">
              Issuer
              <select
                value={issuer}
                onChange={(event) => setIssuer(event.target.value)}
                className="min-h-12 rounded-control border border-[var(--ink)] bg-white px-4 text-sm focus-visible:ring-2 focus-visible:ring-[var(--lilac)]"
              >
                <option value="All">All</option>
                {issuers.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="flex min-w-56 flex-col gap-2 text-sm font-semibold">
            Nostos integration
            <select
              value={integration}
              onChange={(event) =>
                setIntegration(event.target.value as CatalogIntegration)
              }
              className="min-h-12 rounded-control border border-[var(--ink)] bg-white px-4 text-sm focus-visible:ring-2 focus-visible:ring-[var(--lilac)]"
            >
              <option value="all">All</option>
              <option value="discovered">Discovered</option>
              <option value="integrated">Nostos integrated</option>
            </select>
          </label>
          <label className="flex min-w-56 flex-col gap-2 text-sm font-semibold">
            Sort by
            <select
              value={activeSort}
              onChange={(event) => setSort(event.target.value as SortOption)}
              className="min-h-12 rounded-control border border-[var(--ink)] bg-white px-4 text-sm focus-visible:ring-2 focus-visible:ring-[var(--lilac)]"
            >
              {sorts.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <label className="flex min-w-40 flex-col gap-2 text-sm font-semibold">
            Direction
            <select
              value={dir}
              onChange={(event) => setDir(event.target.value as CatalogDir)}
              className="min-h-12 rounded-control border border-[var(--ink)] bg-white px-4 text-sm focus-visible:ring-2 focus-visible:ring-[var(--lilac)]"
            >
              <option value="asc">asc</option>
              <option value="desc">desc</option>
            </select>
          </label>
        </div>
      </div>
      <div className="pt-6" aria-live="polite">
        <p className="mb-4 text-xs text-muted-foreground">
          Showing {category.toLowerCase()} · ordered by {sort.toLowerCase()}
        </p>
        {items.length === 0 ? (
          <div className="rounded-control border border-[var(--line)] p-8 text-center text-sm text-muted-foreground">
            <SlidersHorizontal size={18} className="mx-auto mb-2" aria-hidden="true" />
            No opportunities match this filter.
          </div>
        ) : (
          <div className="grid gap-5 md:grid-cols-2">
            {items.map((asset) => (
              <CatalogAssetCard key={asset.canonicalId} asset={asset} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
