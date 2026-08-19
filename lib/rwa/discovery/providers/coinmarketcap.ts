// Server-only CoinMarketCap provider. Never import from components/ or client hooks.

import {
  IDENTITY_TTL_MS,
  QUOTE_TTL_MS,
  createMemoryCache,
  readThrough,
  type MemoryCache,
} from "../cache";
import {
  asFiniteNumber,
  asRecord,
  asString,
  extractIssuers,
  extractRwaAssets,
  normalizeDiscoveredAsset,
  paginationMeta,
} from "../normalize";
import { parseCmcCanonicalId } from "../provenance";
import type {
  DiscoveredIssuer,
  DiscoveredRwaAsset,
  ProviderHealth,
  ProviderHealthStatus,
  ProviderListQuery,
  ProviderListResult,
  RwaDiscoveryProvider,
} from "../types";
import {
  CmcClientError,
  cmcGet,
  getCoinMarketCapApiKey,
  type CmcGetDeps,
} from "./cmc-client";

const MAP_PATH = "/v5/real-world-assets/map";
const INFO_PATH = "/v5/real-world-assets/info";
const LIST_PATH = "/v5/real-world-assets/assets/list";
const QUOTES_PATH = "/v5/real-world-assets/quotes/latest";
const ISSUERS_LIST_PATH = "/v5/real-world-assets/issuers/list";

export type CmcProviderDeps = CmcGetDeps & {
  cache?: MemoryCache;
};

function isoNow(now?: () => number): string {
  return new Date(now ? now() : Date.now()).toISOString();
}

function healthFromError(error: unknown): ProviderHealthStatus {
  if (error instanceof CmcClientError) {
    if (
      error.code === "AUTH_FAILED" ||
      error.code === "RATE_LIMITED" ||
      error.code === "UNAVAILABLE" ||
      error.code === "PARTIAL"
    ) {
      return error.code;
    }
    if (error.code === "PLAN_RESTRICTED") return "PARTIAL";
  }
  return "UNAVAILABLE";
}

function toItems(
  data: unknown,
  retrievedAt: string,
  freshness: "fresh" | "stale",
): DiscoveredRwaAsset[] {
  return extractRwaAssets(data)
    .map((item) => normalizeDiscoveredAsset(item, { retrievedAt, freshness }))
    .filter((item): item is DiscoveredRwaAsset => item !== null);
}

export function createCoinMarketCapProvider(
  deps: CmcProviderDeps = {},
): RwaDiscoveryProvider {
  const cache = deps.cache ?? createMemoryCache(deps.now);
  const now = deps.now;

  async function getJson(
    path: string,
    params: Record<string, string | number | undefined>,
    ttlMs: number,
  ) {
    const key = `${path}?${new URLSearchParams(
      Object.entries(params)
        .filter(([, value]) => value !== undefined && value !== "")
        .map(([name, value]) => [name, String(value)]),
    ).toString()}`;
    return readThrough(cache, key, ttlMs, () => cmcGet(path, params, deps));
  }

  async function probe(
    path: string,
    params: Record<string, string | number | undefined>,
  ): Promise<boolean> {
    try {
      await cmcGet(path, params, deps);
      return true;
    } catch (error) {
      if (error instanceof CmcClientError && error.code === "PLAN_RESTRICTED") {
        return false;
      }
      throw error;
    }
  }

  return {
    id: "coinmarketcap",
    async health(): Promise<ProviderHealth> {
      if (!getCoinMarketCapApiKey(deps.env ?? process.env)) {
        return { status: "UNAVAILABLE", message: "CoinMarketCap API key is not configured" };
      }
      try {
        const mapOk = await probe(MAP_PATH, { limit: 1 });
        let infoOk = false;
        let listOk = false;
        let quotesOk = false;
        let issuersOk = false;
        try {
          listOk = await probe(LIST_PATH, { limit: 1 });
        } catch (error) {
          if (error instanceof CmcClientError && error.code === "PLAN_RESTRICTED") {
            listOk = false;
          } else if (!(error instanceof CmcClientError && error.code === "ERROR")) {
            throw error;
          }
        }
        try {
          const map = await cmcGet<{ rwa_assets?: Array<{ rwa_id?: unknown }> }>(
            MAP_PATH,
            { limit: 1 },
            deps,
          );
          const firstId = asString(extractRwaAssets(map.data)[0]?.rwa_id);
          if (firstId) {
            try {
              infoOk = await probe(INFO_PATH, { rwa_id: firstId });
            } catch {
              infoOk = false;
            }
            try {
              quotesOk = await probe(QUOTES_PATH, { rwa_id: firstId });
            } catch {
              quotesOk = false;
            }
          }
        } catch {
          infoOk = false;
          quotesOk = false;
        }
        try {
          issuersOk = await probe(ISSUERS_LIST_PATH, { limit: 1 });
        } catch {
          issuersOk = false;
        }

        const requiredMeta = listOk || infoOk;
        const status: ProviderHealthStatus =
          mapOk && requiredMeta ? "READY" : mapOk || requiredMeta ? "PARTIAL" : "UNAVAILABLE";
        return {
          status,
          capabilities: {
            map: mapOk,
            info: infoOk,
            assetsList: listOk,
            quotes: quotesOk,
            issuers: issuersOk,
          },
        };
      } catch (error) {
        return { status: healthFromError(error), message: error instanceof Error ? error.message : String(error) };
      }
    },

    async listAssets(query: ProviderListQuery = {}): Promise<ProviderListResult> {
      const retrievedAt = isoNow(now);
      const start = query.start ?? 1;
      const limit = query.limit ?? 100;
      const params: Record<string, string | number | undefined> = {
        start,
        limit,
        asset_type: query.assetClass,
      };
      if (query.q) params.symbol = query.q;

      try {
        const listed = await getJson(LIST_PATH, params, QUOTE_TTL_MS);
        const items = toItems(listed.value.data, retrievedAt, listed.stale ? "stale" : "fresh");
        const meta = paginationMeta(listed.value.data);
        return {
          items,
          total: meta.total ?? items.length,
          hasMore: meta.hasMore ?? false,
          freshness: listed.stale ? "stale" : "fresh",
          retrievedAt,
        };
      } catch (listError) {
        if (
          listError instanceof CmcClientError &&
          (listError.code === "AUTH_FAILED" || listError.code === "RATE_LIMITED")
        ) {
          throw listError;
        }
        const mapped = await getJson(MAP_PATH, params, IDENTITY_TTL_MS);
        const items = toItems(mapped.value.data, retrievedAt, mapped.stale ? "stale" : "fresh");
        const meta = paginationMeta(mapped.value.data);
        return {
          items,
          total: meta.total ?? items.length,
          hasMore: meta.hasMore ?? false,
          freshness: mapped.stale ? "stale" : "fresh",
          retrievedAt,
        };
      }
    },

    async getAsset(id: string): Promise<DiscoveredRwaAsset | null> {
      const rwaId = parseCmcCanonicalId(id) ?? id;
      if (!rwaId) return null;
      const retrievedAt = isoNow(now);
      let freshness: "fresh" | "stale" = "fresh";
      let infoItem: Record<string, unknown> | null = null;
      let quoteItem: Record<string, unknown> | null = null;

      try {
        const info = await getJson(INFO_PATH, { rwa_id: rwaId }, IDENTITY_TTL_MS);
        freshness = info.stale ? "stale" : freshness;
        infoItem = extractRwaAssets(info.value.data)[0] ?? asRecord(info.value.data);
      } catch (error) {
        if (error instanceof CmcClientError && error.code === "UNAVAILABLE") throw error;
      }

      try {
        const quotes = await getJson(QUOTES_PATH, { rwa_id: rwaId }, QUOTE_TTL_MS);
        freshness = quotes.stale ? "stale" : freshness;
        quoteItem = extractRwaAssets(quotes.value.data)[0] ?? asRecord(quotes.value.data);
      } catch {
        // quotes are optional
      }

      if (!infoItem && !quoteItem) {
        try {
          const mapped = await getJson(MAP_PATH, { limit: 1, symbol: rwaId }, IDENTITY_TTL_MS);
          const fromMap = toItems(mapped.value.data, retrievedAt, mapped.stale ? "stale" : "fresh");
          return fromMap.find((item) => item.providerAssetId === rwaId) ?? fromMap[0] ?? null;
        } catch {
          return null;
        }
      }

      const merged = { ...(infoItem ?? {}), ...(quoteItem ?? {}) };
      return normalizeDiscoveredAsset(merged, { retrievedAt, freshness });
    },

    async listIssuers(start = 1, limit = 100) {
      try {
        const listed = await getJson(ISSUERS_LIST_PATH, { start, limit }, IDENTITY_TTL_MS);
        const rows = extractIssuers(listed.value.data);
        const items: DiscoveredIssuer[] = [];
        for (const row of rows) {
          const id = asString(row.issuer_id);
          const name = asString(row.name);
          if (!id || !name) continue;
          items.push({
            id,
            name,
            numTokens: asFiniteNumber(row.num_tokens),
            website: asString(row.website),
          });
        }
        const meta = paginationMeta(listed.value.data);
        return {
          items,
          total: meta.total ?? items.length,
          hasMore: meta.hasMore ?? false,
        };
      } catch (error) {
        if (error instanceof CmcClientError && (error.code === "PLAN_RESTRICTED" || error.code === "UNAVAILABLE")) {
          return { items: [], total: 0, hasMore: false, notice: "Issuer list is not available from CoinMarketCap." };
        }
        throw error;
      }
    },
  };
}


