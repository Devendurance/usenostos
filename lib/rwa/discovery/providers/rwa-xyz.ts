import type {
  DiscoveredRwaAsset,
  ProviderHealth,
  ProviderListResult,
  RwaDiscoveryProvider,
} from "../types";

const NOTICE = "RWA.xyz discovery is not implemented.";

export const rwaXyzProvider: RwaDiscoveryProvider = {
  id: "rwa.xyz",
  async health(): Promise<ProviderHealth> {
    return { status: "UNAVAILABLE", message: NOTICE };
  },
  async listAssets(): Promise<ProviderListResult> {
    return {
      items: [],
      total: 0,
      hasMore: false,
      freshness: "fresh",
      retrievedAt: new Date().toISOString(),
    };
  },
  async getAsset(): Promise<DiscoveredRwaAsset | null> {
    return null;
  },
  async listIssuers() {
    return { items: [], total: 0, hasMore: false, notice: NOTICE };
  },
};
