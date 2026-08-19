import type { RwaDiscoveryProvider } from "./types";
import { createCoinMarketCapProvider } from "./providers/coinmarketcap";
import { rwaXyzProvider } from "./providers/rwa-xyz";

let defaultProvider: RwaDiscoveryProvider | null = null;

export function getCoinMarketCapDiscoveryProvider(): RwaDiscoveryProvider {
  if (!defaultProvider) {
    defaultProvider = createCoinMarketCapProvider();
  }
  return defaultProvider;
}

export function getRwaXyzDiscoveryProvider(): RwaDiscoveryProvider {
  return rwaXyzProvider;
}

export function resetDiscoveryProviders(): void {
  defaultProvider = null;
}
