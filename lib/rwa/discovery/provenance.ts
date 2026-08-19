export const CMC_MARKET_PROVENANCE = "Market data: CoinMarketCap";
export const NOSTOS_INTEGRATION_PROVENANCE = "Integration: Nostos Registry";

export function productTermsProvenance(issuerName: string): string {
  return `Product terms: ${issuerName}`;
}

export function cmcCanonicalId(rwaId: string | number): string {
  return `cmc:rwa:${String(rwaId)}`;
}

export function parseCmcCanonicalId(id: string): string | null {
  const match = /^cmc:rwa:(.+)$/.exec(id.trim());
  return match?.[1] ? match[1] : null;
}

export const CMC_SOURCE = {
  name: "CoinMarketCap",
  url: "https://coinmarketcap.com/api/documentation/pro-api-reference/real-world-assets",
  type: "aggregator" as const,
};
