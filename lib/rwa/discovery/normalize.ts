import type { SourceReference } from "@/lib/rwa/types";
import { CMC_MARKET_PROVENANCE, CMC_SOURCE, cmcCanonicalId } from "./provenance";
import type { DiscoveredRwaAsset, TokenRepresentation } from "./types";

export function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

export function asString(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

export function asFiniteNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function extractRwaAssets(data: unknown): Record<string, unknown>[] {
  if (Array.isArray(data)) {
    return data.map(asRecord).filter((item): item is Record<string, unknown> => item !== null);
  }
  const root = asRecord(data);
  if (!root) return [];
  const fromRoot = root.rwa_assets ?? root.assets;
  if (Array.isArray(fromRoot)) {
    return fromRoot
      .map(asRecord)
      .filter((item): item is Record<string, unknown> => item !== null);
  }
  if (asString(root.rwa_id) && asString(root.name)) return [root];
  const values = Object.values(root)
    .map(asRecord)
    .filter((item): item is Record<string, unknown> => Boolean(item && asString(item.rwa_id)));
  return values;
}

export function extractIssuers(data: unknown): Record<string, unknown>[] {
  const root = asRecord(data);
  const list = root?.issuers;
  if (!Array.isArray(list)) return [];
  return list.map(asRecord).filter((item): item is Record<string, unknown> => item !== null);
}

export function extractStatus(envelope: unknown): {
  errorCode: string | number | null;
  errorMessage: string | null;
  creditCount: number | null;
} | null {
  const root = asRecord(envelope);
  const status = asRecord(root?.status);
  if (!status) return null;
  const errorCode =
    status.error_code === undefined || status.error_code === null
      ? null
      : (status.error_code as string | number);
  return {
    errorCode,
    errorMessage: asString(status.error_message),
    creditCount: asFiniteNumber(status.credit_count),
  };
}

export function isCmcErrorCode(errorCode: string | number | null): boolean {
  if (errorCode === null) return true;
  return !(errorCode === 0 || errorCode === "0");
}

function usdQuote(item: Record<string, unknown>): Record<string, unknown> | null {
  const quotes = item.quotes;
  if (!Array.isArray(quotes)) return null;
  const usd = quotes
    .map(asRecord)
    .find((quote) => quote && asString(quote.symbol)?.toUpperCase() === "USD");
  return usd ?? asRecord(quotes[0]);
}

function pickUsdNumber(
  item: Record<string, unknown>,
  keys: string[],
): number | null {
  for (const key of keys) {
    if (key in item) {
      const direct = asFiniteNumber(item[key]);
      if (direct !== null) return direct;
    }
  }
  const quote = usdQuote(item);
  if (!quote) return null;
  for (const key of keys) {
    if (key in quote) {
      const nested = asFiniteNumber(quote[key]);
      if (nested !== null) return nested;
    }
  }
  return null;
}

function tokenRepresentations(item: Record<string, unknown>): TokenRepresentation[] {
  const tokens = item.tokens;
  if (!Array.isArray(tokens)) return [];
  const out: TokenRepresentation[] = [];
  for (const token of tokens) {
    const row = asRecord(token);
    if (!row) continue;
    const cryptoId = asString(row.crypto_id);
    const name = asString(row.name);
    const symbol = asString(row.symbol);
    const network = asString(row.network) ?? asString(row.platform);
    if (!cryptoId && !name && !symbol) continue;
    out.push({
      ...(cryptoId ? { cryptoId } : {}),
      ...(name ? { name } : {}),
      ...(symbol ? { symbol } : {}),
      ...(network ? { network } : {}),
    });
  }
  return out;
}

function issuerFromItem(item: Record<string, unknown>): { id?: string; name: string } | null {
  const issuer = asRecord(item.issuer);
  const issuerName =
    asString(issuer?.name) ??
    asString(item.issuer_name) ??
    firstTokenIssuerName(item);
  const issuerId =
    asString(issuer?.issuer_id) ??
    asString(issuer?.id) ??
    asString(item.issuer_id);
  if (!issuerName) return null;
  return issuerId ? { id: issuerId, name: issuerName } : { name: issuerName };
}

function firstTokenIssuerName(item: Record<string, unknown>): string | null {
  const tokens = item.tokens;
  if (!Array.isArray(tokens)) return null;
  for (const token of tokens) {
    const row = asRecord(token);
    const name = asString(row?.issuer_name);
    if (name) return name;
  }
  return null;
}

function descriptionFromInfo(item: Record<string, unknown>): string | null {
  const about = asRecord(item.about);
  return asString(about?.description) ?? asString(item.description);
}

export function normalizeDiscoveredAsset(
  item: unknown,
  options: { retrievedAt: string; freshness: "fresh" | "stale" },
): DiscoveredRwaAsset | null {
  const row = asRecord(item);
  if (!row) return null;
  const rwaId = asString(row.rwa_id);
  const name = asString(row.name);
  if (!rwaId || !name) return null;

  const priceUsd = pickUsdNumber(row, ["average_tokenized_price", "price"]);
  const tokenizedMarketCapUsd = pickUsdNumber(row, [
    "tokenized_market_cap",
    "market_cap",
  ]);
  const volume24hUsd = pickUsdNumber(row, [
    "tokenized_volume_24h",
    "volume_24h",
  ]);
  const rank = asFiniteNumber(row.rwa_rank);
  const lastUpdated =
    asString(row.last_updated) ?? asString(usdQuote(row)?.last_updated);
  const hasMarket =
    priceUsd !== null ||
    tokenizedMarketCapUsd !== null ||
    volume24hUsd !== null;
  const sourceReferences: SourceReference[] = [
    { ...CMC_SOURCE, retrievedAt: options.retrievedAt, asOf: lastUpdated ?? undefined },
  ];

  return {
    canonicalId: cmcCanonicalId(rwaId),
    kind: "discovered",
    provider: "coinmarketcap",
    providerAssetId: rwaId,
    name,
    symbol: asString(row.symbol),
    slug: asString(row.slug),
    assetClass: asString(row.asset_type),
    category: asString(row.asset_type),
    description: descriptionFromInfo(row),
    issuer: issuerFromItem(row),
    tokenRepresentations: tokenRepresentations(row),
    priceUsd,
    tokenizedMarketCapUsd,
    volume24hUsd,
    rank,
    lastUpdated,
    retrievedAt: options.retrievedAt,
    freshness: options.freshness,
    sourceReferences,
    integrationStatus: "DISCOVERY_ONLY",
    marketProvenance: hasMarket ? CMC_MARKET_PROVENANCE : undefined,
    href: `/explore/${encodeURIComponent(cmcCanonicalId(rwaId))}`,
    yieldDisplay: "Not reported",
    settlementSummary: null,
  };
}

export function paginationMeta(data: unknown): { total: number | null; hasMore: boolean | null } {
  const root = asRecord(data);
  return {
    total: asFiniteNumber(root?.total_size),
    hasMore: typeof root?.has_more === "boolean" ? root.has_more : null,
  };
}
