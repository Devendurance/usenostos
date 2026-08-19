import { displaySourced } from "@/lib/rwa/display";
import {
  getOpportunityBySlug,
  listOpportunities,
} from "@/lib/rwa/opportunities";
import type { RwaOpportunity, SourceReference } from "@/lib/rwa/types";
import { matchCuratedMapping } from "./mappings";
import {
  CMC_MARKET_PROVENANCE,
  NOSTOS_INTEGRATION_PROVENANCE,
  parseCmcCanonicalId,
  productTermsProvenance,
} from "./provenance";
import { getCoinMarketCapDiscoveryProvider } from "./provider";
import { matchesSearch } from "./query";
import type {
  CatalogAsset,
  CatalogAssetResponse,
  CatalogListResponse,
  CatalogQuery,
  DiscoveredRwaAsset,
  ProviderHealthStatus,
  RwaDiscoveryProvider,
} from "./types";
import { CmcClientError, getCoinMarketCapApiKey } from "./providers/cmc-client";

const DEMO_SLUG = "nostos-async-vault";

export function isLiveDiscoveryEnabled(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return env.NEXT_PUBLIC_NOSTOS_E2E !== "true";
}

function opportunitySources(opportunity: RwaOpportunity): SourceReference[] {
  const refs = [
    opportunity.networks.source,
    opportunity.eligibility.source,
    opportunity.settlement.source,
    opportunity.yield?.source,
    opportunity.fees?.source,
    opportunity.backing?.source,
  ].filter((source): source is SourceReference => Boolean(source));
  const seen = new Set<string>();
  return refs.filter((source) => {
    if (seen.has(source.url)) return false;
    seen.add(source.url);
    return true;
  });
}

export function curatedToCatalogAsset(
  opportunity: RwaOpportunity,
  retrievedAt: string,
): CatalogAsset {
  return {
    canonicalId: `curated:${opportunity.slug}`,
    kind: "curated",
    name: opportunity.name,
    symbol: opportunity.symbol ?? null,
    slug: opportunity.slug,
    assetClass: opportunity.category,
    category: opportunity.category,
    description: opportunity.description ?? null,
    issuer: { name: opportunity.issuer },
    tokenRepresentations: [],
    priceUsd: null,
    tokenizedMarketCapUsd: null,
    volume24hUsd: null,
    rank: null,
    lastUpdated: null,
    retrievedAt,
    freshness: "fresh",
    sourceReferences: opportunitySources(opportunity),
    integrationStatus: opportunity.integrationStatus,
    issuerTermsProvenance: productTermsProvenance(opportunity.issuer),
    integrationProvenance: NOSTOS_INTEGRATION_PROVENANCE,
    href: `/vaults/${opportunity.slug}`,
    curatedSlug: opportunity.slug,
    yieldDisplay: opportunity.yield ? "See issuer" : "Not reported",
    settlementSummary: displaySourced({
      value: opportunity.settlement.value.redemption,
      source: opportunity.settlement.source,
    }),
  };
}

export function listCuratedCatalogAssets(retrievedAt = new Date().toISOString()): CatalogAsset[] {
  return listOpportunities().map((opportunity) =>
    curatedToCatalogAsset(opportunity, retrievedAt),
  );
}

function hasMarket(asset: Pick<CatalogAsset, "priceUsd" | "tokenizedMarketCapUsd" | "volume24hUsd">): boolean {
  return (
    asset.priceUsd !== null ||
    asset.tokenizedMarketCapUsd !== null ||
    asset.volume24hUsd !== null
  );
}

export function overlayMarketData(
  curated: CatalogAsset,
  discovered: DiscoveredRwaAsset,
): CatalogAsset {
  if (curated.curatedSlug === DEMO_SLUG) return curated;
  return {
    ...curated,
    kind: "merged",
    provider: "coinmarketcap",
    providerAssetId: discovered.providerAssetId,
    tokenRepresentations: discovered.tokenRepresentations,
    priceUsd: discovered.priceUsd,
    tokenizedMarketCapUsd: discovered.tokenizedMarketCapUsd,
    volume24hUsd: discovered.volume24hUsd,
    rank: discovered.rank,
    lastUpdated: discovered.lastUpdated,
    retrievedAt: discovered.retrievedAt,
    freshness: discovered.freshness,
    sourceReferences: [...curated.sourceReferences, ...discovered.sourceReferences],
    marketProvenance: hasMarket(discovered) ? CMC_MARKET_PROVENANCE : curated.marketProvenance,
    href: curated.href,
    integrationStatus: curated.integrationStatus,
    description: curated.description ?? discovered.description,
  };
}

export function mergeCatalog(
  curated: CatalogAsset[],
  discovered: DiscoveredRwaAsset[],
): CatalogAsset[] {
  const used = new Set<string>();
  const merged = curated.map((item) => {
    if (item.curatedSlug === DEMO_SLUG) return item;
    const match = discovered.find((candidate) => {
      if (used.has(candidate.canonicalId)) return false;
      const mapping = matchCuratedMapping({
        providerAssetId: candidate.providerAssetId,
        slug: candidate.slug,
        symbol: candidate.symbol,
        issuerName: candidate.issuer?.name,
      });
      return mapping?.slug === item.curatedSlug;
    });
    if (!match) return item;
    used.add(match.canonicalId);
    return overlayMarketData(item, match);
  });

  const extras = discovered.filter((item) => {
    if (used.has(item.canonicalId)) return false;
    const mapping = matchCuratedMapping({
      providerAssetId: item.providerAssetId,
      slug: item.slug,
      symbol: item.symbol,
      issuerName: item.issuer?.name,
    });
    return mapping === null;
  });

  return [...merged, ...extras];
}

function compareNullable(
  a: number | null,
  b: number | null,
  dir: number,
): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return (a - b) * dir;
}

export function filterCatalog(items: CatalogAsset[], query: CatalogQuery): CatalogAsset[] {
  return items.filter((item) => {
    if (
      !matchesSearch(
        [
          item.name,
          item.symbol,
          item.slug,
          item.issuer?.name,
          item.canonicalId,
          item.assetClass,
          item.category,
        ],
        query.q,
      )
    ) {
      return false;
    }
    if (query.assetClass && query.assetClass !== "All") {
      const bucket = item.category ?? item.assetClass;
      if (bucket !== query.assetClass && item.assetClass !== query.assetClass) {
        return false;
      }
    }
    if (query.issuer) {
      const issuer = item.issuer?.name ?? "";
      if (!issuer.toLowerCase().includes(query.issuer.toLowerCase())) return false;
    }
    if (query.integration === "discovered" && item.integrationStatus !== "DISCOVERY_ONLY") {
      return false;
    }
    if (query.integration === "integrated" && item.integrationStatus === "DISCOVERY_ONLY") {
      return false;
    }
    return true;
  });
}

export function sortCatalog(
  items: CatalogAsset[],
  sort: CatalogQuery["sort"],
  dir: CatalogQuery["dir"],
): CatalogAsset[] {
  const copy = [...items];
  const direction = dir === "desc" ? -1 : 1;
  copy.sort((a, b) => {
    if (sort === "name") return a.name.localeCompare(b.name) * direction;
    if (sort === "marketCap") {
      return compareNullable(a.tokenizedMarketCapUsd, b.tokenizedMarketCapUsd, direction);
    }
    if (sort === "volume") {
      return compareNullable(a.volume24hUsd, b.volume24hUsd, direction);
    }
    return compareNullable(a.rank, b.rank, direction);
  });
  return copy;
}

function paginate(items: CatalogAsset[], page: number, limit: number) {
  const start = (page - 1) * limit;
  return {
    items: items.slice(start, start + limit),
    total: items.length,
    hasMore: start + limit < items.length,
  };
}

export type CatalogDeps = {
  provider?: RwaDiscoveryProvider | null;
  env?: Record<string, string | undefined>;
  now?: () => number;
};

function healthFromError(error: unknown): ProviderHealthStatus {
  if (error instanceof CmcClientError) {
    if (
      error.code === "AUTH_FAILED" ||
      error.code === "RATE_LIMITED" ||
      error.code === "UNAVAILABLE"
    ) {
      return error.code;
    }
    if (error.code === "PLAN_RESTRICTED") return "PARTIAL";
  }
  return "UNAVAILABLE";
}

const defaultQuery: CatalogQuery = {
  sort: "name",
  dir: "asc",
  integration: "all",
  page: 1,
  limit: 20,
};

export async function getCatalog(
  query: Partial<CatalogQuery> = {},
  deps: CatalogDeps = {},
): Promise<CatalogListResponse> {
  const resolved: CatalogQuery = { ...defaultQuery, ...query };
  const retrievedAt = new Date(deps.now ? deps.now() : Date.now()).toISOString();
  const curated = listCuratedCatalogAssets(retrievedAt);
  const env = deps.env ?? process.env;
  const live = isLiveDiscoveryEnabled(env);
  const hasKey = Boolean(getCoinMarketCapApiKey(env));

  const unavailable = (
    health: ProviderHealthStatus,
    notice: string,
    stale = false,
  ): CatalogListResponse => {
    const filtered = sortCatalog(filterCatalog(curated, resolved), resolved.sort, resolved.dir);
    const page = paginate(filtered, resolved.page, resolved.limit);
    return {
      ...page,
      page: resolved.page,
      limit: resolved.limit,
      provider: {
        id: "coinmarketcap",
        health,
        freshness: stale ? "stale" : "fresh",
        retrievedAt,
        ...(stale ? { stale: true } : {}),
      },
      notice,
    };
  };

  if (!live || !hasKey) {
    return unavailable(
      "UNAVAILABLE",
      live
        ? "CMC provider unavailable"
        : "Live CoinMarketCap discovery is disabled in this environment.",
    );
  }

  const provider = deps.provider === undefined ? getCoinMarketCapDiscoveryProvider() : deps.provider;
  if (!provider) {
    return unavailable("UNAVAILABLE", "CMC provider unavailable");
  }

  try {
    const listed = await provider.listAssets({
      q: resolved.q,
      assetClass:
        resolved.assetClass &&
        resolved.assetClass !== "All" &&
        resolved.assetClass !== "Treasuries" &&
        resolved.assetClass !== "Testnet Demo"
          ? resolved.assetClass
          : undefined,
      start: 1,
      limit: 100,
    });
    const merged = mergeCatalog(curated, listed.items);
    const filtered = sortCatalog(filterCatalog(merged, resolved), resolved.sort, resolved.dir);
    const page = paginate(filtered, resolved.page, resolved.limit);
    const identityOnly = listed.items.every((item) => !hasMarket(item));
    const health: ProviderHealthStatus = listed.freshness === "stale" || identityOnly ? "PARTIAL" : "READY";
    return {
      ...page,
      page: resolved.page,
      limit: resolved.limit,
      provider: {
        id: provider.id,
        health,
        freshness: listed.freshness,
        retrievedAt: listed.retrievedAt,
        ...(listed.freshness === "stale" ? { stale: true } : {}),
      },
    };
  } catch (error) {
    return unavailable(
      healthFromError(error),
      error instanceof CmcClientError && error.code === "AUTH_FAILED"
        ? "CMC provider unavailable"
        : error instanceof Error
          ? error.message
          : "CMC provider unavailable",
    );
  }
}

function fullyDecode(id: string): string {
  let current = id;
  for (let i = 0; i < 3; i += 1) {
    try {
      const next = decodeURIComponent(current);
      if (next === current) break;
      current = next;
    } catch {
      break;
    }
  }
  return current;
}

function lookupId(id: string): { curatedSlug?: string; cmcId?: string } {
  const decoded = fullyDecode(id);
  if (decoded.startsWith("curated:")) {
    return { curatedSlug: decoded.slice("curated:".length) };
  }
  const cmcId = parseCmcCanonicalId(decoded);
  if (cmcId) return { cmcId: decoded };
  if (getOpportunityBySlug(decoded)) return { curatedSlug: decoded };
  return { cmcId: decoded };
}

export async function getCatalogAsset(
  id: string,
  deps: CatalogDeps = {},
): Promise<CatalogAssetResponse | null> {
  const retrievedAt = new Date(deps.now ? deps.now() : Date.now()).toISOString();
  const parsed = lookupId(id);
  const env = deps.env ?? process.env;
  const live = isLiveDiscoveryEnabled(env);
  const provider = deps.provider === undefined ? getCoinMarketCapDiscoveryProvider() : deps.provider;

  if (parsed.curatedSlug) {
    const opportunity = getOpportunityBySlug(parsed.curatedSlug);
    if (!opportunity) return null;
    let item = curatedToCatalogAsset(opportunity, retrievedAt);
    if (live && provider && opportunity.slug !== DEMO_SLUG) {
      try {
        const listed = await provider.listAssets({ limit: 100, start: 1 });
        const merged = mergeCatalog([item], listed.items);
        item = merged[0] ?? item;
      } catch {
        // curated still returned
      }
    }
    return {
      item,
      provider: {
        id: "coinmarketcap",
        health: item.kind === "merged" ? "READY" : "UNAVAILABLE",
        freshness: item.freshness,
        retrievedAt: item.retrievedAt,
      },
    };
  }

  if (!live || !provider) return null;

  try {
    const discovered = await provider.getAsset(parsed.cmcId ?? id);
    if (!discovered) return null;
    const mapping = matchCuratedMapping({
      providerAssetId: discovered.providerAssetId,
      slug: discovered.slug,
      symbol: discovered.symbol,
      issuerName: discovered.issuer?.name,
    });
    if (mapping) {
      const opportunity = getOpportunityBySlug(mapping.slug);
      if (opportunity) {
        return {
          item: overlayMarketData(curatedToCatalogAsset(opportunity, retrievedAt), discovered),
          provider: {
            id: provider.id,
            health: "READY",
            freshness: discovered.freshness,
            retrievedAt: discovered.retrievedAt,
          },
        };
      }
    }
    return {
      item: discovered,
      provider: {
        id: provider.id,
        health: "READY",
        freshness: discovered.freshness,
        retrievedAt: discovered.retrievedAt,
      },
    };
  } catch {
    return null;
  }
}

export async function getCatalogIssuers(deps: CatalogDeps = {}) {
  const env = deps.env ?? process.env;
  const live = isLiveDiscoveryEnabled(env);
  const provider = deps.provider === undefined ? getCoinMarketCapDiscoveryProvider() : deps.provider;
  if (!live || !provider?.listIssuers) {
    return {
      items: [],
      total: 0,
      hasMore: false,
      notice: "Issuer list is not available.",
      provider: {
        id: "coinmarketcap" as const,
        health: "UNAVAILABLE" as const,
        freshness: "fresh" as const,
        retrievedAt: new Date().toISOString(),
      },
    };
  }
  try {
    const listed = await provider.listIssuers(1, 100);
    return {
      ...listed,
      provider: {
        id: provider.id,
        health: "READY" as const,
        freshness: "fresh" as const,
        retrievedAt: new Date().toISOString(),
      },
    };
  } catch (error) {
    return {
      items: [],
      total: 0,
      hasMore: false,
      notice: "Issuer list is not available.",
      provider: {
        id: provider.id,
        health: healthFromError(error),
        freshness: "fresh" as const,
        retrievedAt: new Date().toISOString(),
      },
    };
  }
}
