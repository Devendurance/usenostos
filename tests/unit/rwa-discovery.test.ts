import { describe, expect, it, vi } from "vitest";
import {
  CmcClientError,
  CMC_API_KEY_HEADER,
  cmcGet,
  getCoinMarketCapApiKey,
} from "@/lib/rwa/discovery/providers/cmc-client";
import { createMemoryCache, readThrough } from "@/lib/rwa/discovery/cache";
import { normalizeDiscoveredAsset } from "@/lib/rwa/discovery/normalize";
import { matchCuratedMapping } from "@/lib/rwa/discovery/mappings";
import {
  getCatalog,
  mergeCatalog,
  listCuratedCatalogAssets,
  overlayMarketData,
} from "@/lib/rwa/discovery/catalog";
import { parseCatalogQuery } from "@/lib/rwa/discovery/query";
import { rwaXyzProvider } from "@/lib/rwa/discovery/providers/rwa-xyz";
import { createCoinMarketCapProvider } from "@/lib/rwa/discovery/providers/coinmarketcap";
import type { DiscoveredRwaAsset, RwaDiscoveryProvider } from "@/lib/rwa/discovery/types";
import { listOpportunities } from "@/lib/rwa/opportunities";

const KEY = "test-cmc-key";
const env = { COINMARKETCAP_API_KEY: KEY };

function envelope(data: unknown, errorCode: string | number = 0) {
  return {
    data,
    status: { error_code: errorCode, error_message: errorCode === 0 ? "" : "fail", credit_count: 1 },
  };
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function discovered(overrides: Partial<DiscoveredRwaAsset> = {}): DiscoveredRwaAsset {
  return {
    canonicalId: "cmc:rwa:42",
    kind: "discovered",
    provider: "coinmarketcap",
    providerAssetId: "42",
    name: "Tokenized Example",
    symbol: "EXAM",
    slug: "example",
    assetClass: "commodity",
    category: "commodity",
    description: null,
    issuer: { name: "Example Issuer" },
    tokenRepresentations: [{ cryptoId: "99", name: "Example token", symbol: "EXAM" }],
    priceUsd: 12.5,
    tokenizedMarketCapUsd: 1000,
    volume24hUsd: 50,
    rank: 8,
    lastUpdated: "2026-08-19T00:00:00.000Z",
    retrievedAt: "2026-08-19T00:00:00.000Z",
    freshness: "fresh",
    sourceReferences: [],
    integrationStatus: "DISCOVERY_ONLY",
    marketProvenance: "Market data: CoinMarketCap",
    href: "/explore/cmc%3Arwa%3A42",
    yieldDisplay: "Not reported",
    settlementSummary: null,
    ...overrides,
  };
}

describe("cmc client", () => {
  it("1 treats 401 and 403 as AUTH_FAILED without retry", async () => {
    let calls = 0;
    const fetchImpl: typeof fetch = async () => {
      calls += 1;
      return new Response("no", { status: 401 });
    };
    await expect(
      cmcGet("/v5/real-world-assets/map", { limit: 1 }, { fetch: fetchImpl, env, sleep: async () => {} }),
    ).rejects.toMatchObject({ code: "AUTH_FAILED" });
    calls = 0;
    const fetch403: typeof fetch = async () => {
      calls += 1;
      return new Response("no", { status: 403 });
    };
    await expect(
      cmcGet("/v5/real-world-assets/map", {}, { fetch: fetch403, env, sleep: async () => {} }),
    ).rejects.toMatchObject({ code: "AUTH_FAILED" });
    expect(calls).toBe(1);
  });

  it("2 treats 429 as RATE_LIMITED and does not retry", async () => {
    let calls = 0;
    const fetchImpl: typeof fetch = async () => {
      calls += 1;
      return new Response("slow", { status: 429 });
    };
    await expect(
      cmcGet("/v5/real-world-assets/map", {}, { fetch: fetchImpl, env, sleep: async () => {
        throw new Error("should not sleep");
      } }),
    ).rejects.toMatchObject({ code: "RATE_LIMITED" });
    expect(calls).toBe(1);
  });

  it("3 retries 5xx at most twice with capped backoff", async () => {
    let calls = 0;
    const sleeps: number[] = [];
    const fetchImpl: typeof fetch = async () => {
      calls += 1;
      if (calls < 3) return new Response("err", { status: 500 });
      return jsonResponse(envelope({ rwa_assets: [] }));
    };
    const result = await cmcGet("/v5/real-world-assets/map", {}, {
      fetch: fetchImpl,
      env,
      sleep: async (ms) => {
        sleeps.push(ms);
      },
    });
    expect(result.status.error_code).toBe(0);
    expect(calls).toBe(3);
    expect(sleeps).toEqual([250, 500]);
  });

  it("4 treats a non-zero envelope error_code as an error", async () => {
    const fetchImpl: typeof fetch = async () => jsonResponse(envelope(null, "1001"));
    await expect(
      cmcGet("/v5/real-world-assets/map", {}, { fetch: fetchImpl, env }),
    ).rejects.toBeInstanceOf(CmcClientError);
  });

  it("5 rejects non-JSON bodies", async () => {
    const fetchImpl: typeof fetch = async () =>
      new Response("<html>nope</html>", {
        status: 200,
        headers: { "content-type": "text/html" },
      });
    await expect(
      cmcGet("/v5/real-world-assets/map", {}, { fetch: fetchImpl, env }),
    ).rejects.toMatchObject({ message: expect.stringMatching(/non-JSON|malformed/i) });
  });

  it("6 sends the key in the header and never in the query string", async () => {
    let url = "";
    let header: string | null = null;
    const fetchImpl: typeof fetch = async (input, init) => {
      url = String(input);
      const headers = new Headers(init?.headers);
      header = headers.get(CMC_API_KEY_HEADER);
      expect(headers.get("authorization")).toBeNull();
      return jsonResponse(envelope({ rwa_assets: [] }));
    };
    await cmcGet("/v5/real-world-assets/map", { limit: 1 }, { fetch: fetchImpl, env });
    expect(header).toBe(KEY);
    expect(url).not.toContain(KEY);
    expect(url).not.toContain("COINMARKETCAP_API_KEY");
    expect(getCoinMarketCapApiKey(env)).toBe(KEY);
  });
});

describe("normalize and identity", () => {
  it("7 leaves missing market fields null instead of zero", () => {
    const asset = normalizeDiscoveredAsset(
      {
        rwa_id: 7,
        name: "Sparse",
        symbol: "SPR",
        slug: "sparse",
        asset_type: "stock",
        rwa_rank: 3,
      },
      { retrievedAt: "2026-08-19T00:00:00.000Z", freshness: "fresh" },
    );
    expect(asset?.priceUsd).toBeNull();
    expect(asset?.tokenizedMarketCapUsd).toBeNull();
    expect(asset?.volume24hUsd).toBeNull();
    expect(asset?.priceUsd).not.toBe(0);
  });

  it("8 uses cmc:rwa:{rwa_id} rather than symbol identity", () => {
    const asset = normalizeDiscoveredAsset(
      { rwa_id: 9, name: "SpaceX", symbol: "SPCX", slug: "spacex" },
      { retrievedAt: "2026-08-19T00:00:00.000Z", freshness: "fresh" },
    );
    expect(asset?.canonicalId).toBe("cmc:rwa:9");
    expect(asset?.canonicalId).not.toContain("SPCX");
    expect(asset?.href).toContain(encodeURIComponent("cmc:rwa:9"));
  });
});

describe("cache", () => {
  it("9 returns a cached entry marked stale after a failed refetch", async () => {
    let now = 0;
    const cache = createMemoryCache(() => now);
    cache.set("map", { ok: true }, 1_000);
    now = 2_000;
    const result = await readThrough(cache, "map", 1_000, async () => {
      throw new Error("network down");
    });
    expect(result.stale).toBe(true);
    expect(result.value).toEqual({ ok: true });
  });

  it("10 never marks a stale cache hit as fresh", async () => {
    let now = 0;
    const cache = createMemoryCache(() => now);
    cache.set("quotes", 1, 500);
    now = 501;
    const hit = cache.get<number>("quotes");
    expect(hit?.stale).toBe(true);
    const result = await readThrough(cache, "quotes", 500, async () => {
      throw new Error("fail");
    });
    expect(result.stale).toBe(true);
  });
});

describe("catalog merge", () => {
  it("11 merges OUSG/TBILL only when slug and issuer match, not symbol-only", () => {
    const curated = listCuratedCatalogAssets("2026-08-19T00:00:00.000Z");
    const symbolOnly = mergeCatalog(curated, [
      discovered({
        canonicalId: "cmc:rwa:100",
        providerAssetId: "100",
        name: "Other OUSG",
        symbol: "OUSG",
        slug: "not-ousg",
        issuer: { name: "Ondo Finance" },
      }),
    ]);
    expect(symbolOnly.filter((item) => item.name === "OUSG")).toHaveLength(1);
    expect(symbolOnly.find((item) => item.slug === "ousg")?.kind).toBe("curated");
    expect(matchCuratedMapping({ symbol: "OUSG", slug: "not-ousg", issuerName: "Ondo Finance" })).toBeNull();

    const slugAndIssuer = mergeCatalog(curated, [
      discovered({
        canonicalId: "cmc:rwa:101",
        providerAssetId: "101",
        name: "OUSG",
        symbol: "OUSG",
        slug: "ousg",
        issuer: { name: "Ondo Finance" },
        priceUsd: 105.2,
      }),
    ]);
    const ousg = slugAndIssuer.find((item) => item.curatedSlug === "ousg");
    expect(ousg?.kind).toBe("merged");
    expect(ousg?.priceUsd).toBe(105.2);
    expect(ousg?.href).toBe("/vaults/ousg");
    expect(ousg?.integrationStatus).toBe("DISCOVERY_ONLY");
    expect(slugAndIssuer.filter((item) => item.curatedSlug === "ousg")).toHaveLength(1);
  });

  it("12 never merges the demo vault with CMC assets", () => {
    const curated = listCuratedCatalogAssets("2026-08-19T00:00:00.000Z");
    const demo = curated.find((item) => item.curatedSlug === "nostos-async-vault")!;
    const overlaid = overlayMarketData(
      demo,
      discovered({ slug: "nostos-async-vault", issuer: { name: "Nostos" } }),
    );
    expect(overlaid.kind).toBe("curated");
    expect(overlaid.priceUsd).toBeNull();
    expect(overlaid.href).toBe("/vaults/nostos-async-vault");
  });

  it("13 still returns the curated three when CMC is unavailable", async () => {
    const result = await getCatalog(
      {},
      { env: { NEXT_PUBLIC_NOSTOS_E2E: "false" }, provider: null },
    );
    expect(result.provider.health).toBe("UNAVAILABLE");
    expect(result.items.map((item) => item.curatedSlug).sort()).toEqual([
      "nostos-async-vault",
      "ousg",
      "tbill",
    ]);
    expect(listOpportunities().map((item) => item.slug).sort()).toEqual([
      "nostos-async-vault",
      "ousg",
      "tbill",
    ]);
  });
});

describe("query validation", () => {
  it("14 rejects junk query params and caps limit at 50", () => {
    expect(parseCatalogQuery(new URLSearchParams("sort=apy")).ok).toBe(false);
    expect(parseCatalogQuery(new URLSearchParams("page=0")).ok).toBe(false);
    expect(parseCatalogQuery(new URLSearchParams("page=1.5")).ok).toBe(false);
    expect(parseCatalogQuery(new URLSearchParams("limit=abc")).ok).toBe(false);
    const parsed = parseCatalogQuery(new URLSearchParams("limit=999"));
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.query.limit).toBe(50);
  });
});

describe("rwa.xyz stub", () => {
  it("15 never performs network I/O or invents assets", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const health = await rwaXyzProvider.health();
    const listed = await rwaXyzProvider.listAssets();
    const item = await rwaXyzProvider.getAsset("cmc:rwa:1");
    expect(health.status).toBe("UNAVAILABLE");
    expect(listed.items).toEqual([]);
    expect(item).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});

describe("coinmarketcap provider fixtures", () => {
  it("16 serves list data from fixtures and uses stale cache after a later failure", async () => {
    let now = 0;
    let failQuotes = false;
    const fetchImpl: typeof fetch = async (input) => {
      const url = String(input);
      expect(url).not.toContain(KEY);
      if (failQuotes) return new Response("no", { status: 500 });
      if (url.includes("/assets/list")) {
        return jsonResponse(
          envelope({
            total_size: 1,
            has_more: false,
            rwa_assets: [
              {
                rwa_id: 1,
                name: "Gold",
                symbol: "GOLD",
                slug: "gold",
                asset_type: "commodity",
                rwa_rank: 1,
                average_tokenized_price: 2000.25,
                tokenized_market_cap: 5000000,
                tokenized_volume_24h: 123456,
              },
            ],
          }),
        );
      }
      return jsonResponse(envelope({ rwa_assets: [] }));
    };
    const provider = createCoinMarketCapProvider({
      fetch: fetchImpl,
      env,
      now: () => now,
      sleep: async () => {},
    });
    const first = await provider.listAssets({ limit: 1 });
    expect(first.items[0]?.canonicalId).toBe("cmc:rwa:1");
    expect(first.items[0]?.priceUsd).toBe(2000.25);
    expect(first.freshness).toBe("fresh");
    failQuotes = true;
    now = 120_000;
    const second = await provider.listAssets({ limit: 1 });
    expect(second.freshness).toBe("stale");
    expect(second.items[0]?.priceUsd).toBe(2000.25);

    const mockProvider: RwaDiscoveryProvider = {
      id: "coinmarketcap",
      health: async () => ({ status: "READY" }),
      listAssets: async () => first,
      getAsset: async () => first.items[0] ?? null,
    };
    const catalog = await getCatalog(
      { sort: "name", dir: "asc", integration: "all", page: 1, limit: 20 },
      { provider: mockProvider, env: { ...env, NEXT_PUBLIC_NOSTOS_E2E: "false" } },
    );
    expect(catalog.items.some((item) => item.canonicalId === "cmc:rwa:1")).toBe(true);
    expect(catalog.items.filter((item) => item.curatedSlug === "ousg")).toHaveLength(1);
  });
});
