import type { IntegrationStatus, SourceReference } from "@/lib/rwa/types";

export type DiscoveryProviderId = "coinmarketcap" | "rwa.xyz";

export type ProviderHealthStatus =
  | "READY"
  | "PARTIAL"
  | "AUTH_FAILED"
  | "RATE_LIMITED"
  | "UNAVAILABLE";

export type Freshness = "fresh" | "stale";

export type FieldProvenance = {
  source: string;
  asOf?: string;
  retrievedAt?: string;
};

export type SourcedField<T> = {
  value: T | null;
  provenance: FieldProvenance | null;
};

export type TokenRepresentation = {
  cryptoId?: string;
  name?: string;
  symbol?: string;
  network?: string;
};

export type CatalogKind = "curated" | "discovered" | "merged";

export type CatalogAsset = {
  canonicalId: string;
  kind: CatalogKind;
  provider?: DiscoveryProviderId;
  providerAssetId?: string;
  name: string;
  symbol: string | null;
  slug: string | null;
  assetClass: string | null;
  category: string | null;
  description: string | null;
  issuer: { id?: string; name: string } | null;
  tokenRepresentations: TokenRepresentation[];
  priceUsd: number | null;
  tokenizedMarketCapUsd: number | null;
  volume24hUsd: number | null;
  rank: number | null;
  lastUpdated: string | null;
  retrievedAt: string;
  freshness: Freshness;
  sourceReferences: SourceReference[];
  integrationStatus: IntegrationStatus;
  marketProvenance?: string;
  issuerTermsProvenance?: string;
  integrationProvenance?: string;
  href: string;
  curatedSlug?: string;
  yieldDisplay: string;
  settlementSummary: string | null;
};

export type DiscoveredRwaAsset = CatalogAsset & {
  provider: DiscoveryProviderId;
  providerAssetId: string;
};

export type ProviderHealth = {
  status: ProviderHealthStatus;
  message?: string;
  capabilities?: {
    map?: boolean;
    info?: boolean;
    assetsList?: boolean;
    quotes?: boolean;
    issuers?: boolean;
  };
};

export type ProviderListQuery = {
  q?: string;
  assetClass?: string;
  start?: number;
  limit?: number;
};

export type ProviderListResult = {
  items: DiscoveredRwaAsset[];
  total: number;
  hasMore: boolean;
  freshness: Freshness;
  retrievedAt: string;
};

export type DiscoveredIssuer = {
  id: string;
  name: string;
  numTokens: number | null;
  website?: string | null;
};

export type RwaDiscoveryProvider = {
  id: DiscoveryProviderId;
  health(): Promise<ProviderHealth>;
  listAssets(query?: ProviderListQuery): Promise<ProviderListResult>;
  getAsset(id: string): Promise<DiscoveredRwaAsset | null>;
  listIssuers?(start?: number, limit?: number): Promise<{
    items: DiscoveredIssuer[];
    total: number;
    hasMore: boolean;
    notice?: string;
  }>;
};

export type CatalogSort = "name" | "marketCap" | "volume" | "rank";
export type CatalogDir = "asc" | "desc";
export type CatalogIntegration = "all" | "discovered" | "integrated";

export type CatalogQuery = {
  q?: string;
  assetClass?: string;
  issuer?: string;
  sort: CatalogSort;
  dir: CatalogDir;
  integration: CatalogIntegration;
  page: number;
  limit: number;
};

export type CatalogProviderInfo = {
  id: DiscoveryProviderId;
  health: ProviderHealthStatus;
  freshness: Freshness;
  retrievedAt: string;
  stale?: boolean;
};

export type CatalogListResponse = {
  items: CatalogAsset[];
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
  provider: CatalogProviderInfo;
  notice?: string;
};

export type CatalogAssetResponse = {
  item: CatalogAsset;
  provider: CatalogProviderInfo;
  notice?: string;
};
