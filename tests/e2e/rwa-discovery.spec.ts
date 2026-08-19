import { expect, test, type Page } from "@playwright/test";

const retrievedAt = "2026-08-19T12:00:00.000Z";

const ousg = {
  canonicalId: "curated:ousg",
  kind: "merged",
  provider: "coinmarketcap",
  providerAssetId: "501",
  name: "OUSG",
  symbol: "OUSG",
  slug: "ousg",
  assetClass: "Treasuries",
  category: "Treasuries",
  description: "Ondo Short-Term US Government Treasuries (OUSG).",
  issuer: { name: "Ondo Finance" },
  tokenRepresentations: [{ symbol: "OUSG", name: "OUSG" }],
  priceUsd: 110.25,
  tokenizedMarketCapUsd: 800000000,
  volume24hUsd: 2500000,
  rank: 12,
  lastUpdated: retrievedAt,
  retrievedAt,
  freshness: "fresh",
  sourceReferences: [],
  integrationStatus: "DISCOVERY_ONLY",
  marketProvenance: "Market data: CoinMarketCap",
  issuerTermsProvenance: "Product terms: Ondo Finance",
  integrationProvenance: "Integration: Nostos Registry",
  href: "/vaults/ousg",
  curatedSlug: "ousg",
  yieldDisplay: "See issuer",
  settlementSummary: "Instant redemption to USDC",
};

const tbill = {
  ...ousg,
  canonicalId: "curated:tbill",
  providerAssetId: "502",
  name: "TBILL",
  symbol: "TBILL",
  slug: "tbill",
  description: "OpenEden TBILL.",
  issuer: { name: "OpenEden" },
  tokenRepresentations: [{ symbol: "TBILL", name: "TBILL" }],
  href: "/vaults/tbill",
  curatedSlug: "tbill",
  issuerTermsProvenance: "Product terms: OpenEden",
};

const demo = {
  canonicalId: "curated:nostos-async-vault",
  kind: "curated",
  name: "Nostos Async Settlement Vault",
  symbol: "NOS-VAULT",
  slug: "nostos-async-vault",
  assetClass: "Testnet Demo",
  category: "Testnet Demo",
  description: "BOT TESTNET · 0% YIELD · REDEMPTION SUPPORTED.",
  issuer: { name: "Nostos (testnet demonstration)" },
  tokenRepresentations: [],
  priceUsd: null,
  tokenizedMarketCapUsd: null,
  volume24hUsd: null,
  rank: null,
  lastUpdated: null,
  retrievedAt,
  freshness: "fresh",
  sourceReferences: [],
  integrationStatus: "REDEMPTION_SUPPORTED",
  issuerTermsProvenance: "Product terms: Nostos (testnet demonstration)",
  integrationProvenance: "Integration: Nostos Registry",
  href: "/vaults/nostos-async-vault",
  curatedSlug: "nostos-async-vault",
  yieldDisplay: "See issuer",
  settlementSummary: "Asynchronous redemption",
};

const extra = {
  canonicalId: "cmc:rwa:9001",
  kind: "discovered",
  provider: "coinmarketcap",
  providerAssetId: "9001",
  name: "Fixture Tokenized Gold",
  symbol: "GOLD",
  slug: "gold",
  assetClass: "commodity",
  category: "commodity",
  description: "Fixture discovery asset used by Playwright.",
  issuer: { name: "Fixture Issuer" },
  tokenRepresentations: [{ cryptoId: "4705", name: "PAX Gold", symbol: "PAXG" }],
  priceUsd: 2400,
  tokenizedMarketCapUsd: 1880000000,
  volume24hUsd: 139000000,
  rank: 1,
  lastUpdated: retrievedAt,
  retrievedAt,
  freshness: "fresh",
  sourceReferences: [],
  integrationStatus: "DISCOVERY_ONLY",
  marketProvenance: "Market data: CoinMarketCap",
  integrationProvenance: "Integration: Nostos Registry",
  href: "/explore/cmc%3Arwa%3A9001",
  yieldDisplay: "Not reported",
  settlementSummary: null,
};

const allItems = [ousg, tbill, demo, extra];

function providerReady() {
  return {
    id: "coinmarketcap",
    health: "READY",
    freshness: "fresh",
    retrievedAt,
  };
}

function filterItems(url: URL) {
  const q = (url.searchParams.get("q") ?? "").toLowerCase();
  const assetClass = url.searchParams.get("assetClass");
  const issuer = url.searchParams.get("issuer");
  const integration = url.searchParams.get("integration") ?? "all";
  return allItems.filter((item) => {
    if (q) {
      const blob = [item.name, item.symbol, item.slug, item.issuer?.name, item.canonicalId]
        .join(" ")
        .toLowerCase();
      if (!blob.includes(q)) return false;
    }
    if (assetClass && assetClass !== "All") {
      if (item.category !== assetClass && item.assetClass !== assetClass) return false;
    }
    if (issuer && issuer !== "All" && item.issuer?.name !== issuer) return false;
    if (integration === "discovered" && item.integrationStatus !== "DISCOVERY_ONLY") return false;
    if (integration === "integrated" && item.integrationStatus === "DISCOVERY_ONLY") return false;
    return true;
  });
}

async function installDiscoveryFixture(page: Page, mode: "ready" | "unavailable" = "ready") {
  await page.route("**/api/rwa/**", async (route) => {
    const url = new URL(route.request().url());
    if (mode === "unavailable") {
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ error: "CMC unavailable" }),
      });
      return;
    }
    if (url.pathname.includes("/api/rwa/issuers")) {
      await route.fulfill({
        json: { items: [{ id: "iss-1", name: "Fixture Issuer", numTokens: 1 }], total: 1, hasMore: false, provider: providerReady() },
      });
      return;
    }
    const detailMatch = url.pathname.match(/\/api\/rwa\/assets\/(.+)$/);
    if (detailMatch) {
      let id = detailMatch[1];
      try {
        id = decodeURIComponent(id);
        id = decodeURIComponent(id);
      } catch {
        // already decoded
      }
      const item = allItems.find((entry) => {
        const curatedSlug = "curatedSlug" in entry ? entry.curatedSlug : undefined;
        return entry.canonicalId === id || entry.slug === id || curatedSlug === id;
      });
      if (!item) {
        await route.fulfill({ status: 404, json: { error: "Asset not found" } });
        return;
      }
      await route.fulfill({ json: { item, provider: providerReady() } });
      return;
    }
    const items = filterItems(url);
    await route.fulfill({
      json: {
        items,
        page: 1,
        limit: 50,
        total: items.length,
        hasMore: false,
        provider: providerReady(),
      },
    });
  });
}

test.describe("RWA discovery catalog", () => {
  test("lists an extra discovered asset with provenance and no deposit", async ({ page }) => {
    await installDiscoveryFixture(page);
    await page.goto("/explore");
    await expect(page.getByRole("heading", { name: "OUSG" })).toHaveCount(1);
    await expect(page.getByRole("heading", { name: "TBILL" })).toHaveCount(1);
    await expect(page.getByRole("heading", { name: "Nostos Async Settlement Vault" })).toHaveCount(1);
    await expect(page.getByRole("heading", { name: "Fixture Tokenized Gold" })).toBeVisible();
    await expect(page.getByText("Market data: CoinMarketCap").first()).toBeVisible();
    await expect(page.getByText("Product terms: Ondo Finance")).toBeVisible();
    const goldCard = page.locator("article").filter({ hasText: "Fixture Tokenized Gold" });
    await expect(goldCard.getByText("DISCOVERED")).toBeVisible();
    await expect(goldCard.getByRole("link", { name: /view details/i })).toHaveAttribute(
      "href",
      "/explore/cmc%3Arwa%3A9001",
    );
    await expect(goldCard).not.toContainText(/deposit|redeem/i);
    await expect(page.locator("main")).not.toContainText(/[1-9]\d*(\.\d+)?\s?%|0\.\d+%/);
  });

  test("search and category filters narrow the catalog", async ({ page }) => {
    await installDiscoveryFixture(page);
    await page.goto("/explore");
    await page.getByLabel("Search").fill("Gold");
    await expect(page.getByRole("heading", { name: "Fixture Tokenized Gold" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "OUSG" })).toHaveCount(0);
    await page.getByLabel("Search").fill("");
    await page.getByRole("button", { name: "Treasuries" }).click();
    await expect(page.getByRole("heading", { name: "OUSG" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "TBILL" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Fixture Tokenized Gold" })).toHaveCount(0);
  });

  test("discovered detail page is research-only", async ({ page }) => {
    await installDiscoveryFixture(page);
    await page.goto("/explore/cmc%3Arwa%3A9001");
    await expect(page.getByRole("heading", { name: "Fixture Tokenized Gold" })).toBeVisible();
    await expect(
      page.getByText(/Discovery only \/ Nostos execution is not yet available for this asset/i).first(),
    ).toBeVisible();
    await expect(page.getByText("Market data: CoinMarketCap")).toBeVisible();
    await expect(page.getByText("PAX Gold")).toBeVisible();
    await expect(page.getByRole("button", { name: /deposit/i })).toHaveCount(0);
    await expect(page.locator("form")).toHaveCount(0);
  });

  test("API unavailability still shows OUSG, TBILL, and the demo vault", async ({ page }) => {
    await installDiscoveryFixture(page, "unavailable");
    await page.goto("/explore");
    await expect(page.getByRole("heading", { name: "OUSG" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "TBILL" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Nostos Async Settlement Vault" })).toBeVisible();
    await expect(page.getByText(/CMC provider unavailable/i).first()).toBeVisible();
  });
});
