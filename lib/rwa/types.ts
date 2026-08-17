export type SourceReference = {
  name: string;
  url: string;
  type: "issuer" | "issuer_docs" | "onchain" | "oracle" | "aggregator";
  retrievedAt?: string;
  asOf?: string;
};

export type SourcedValue<T> = {
  value: T;
  source: SourceReference;
};

export type IntegrationStatus =
  | "DISCOVERY_ONLY"
  | "DEPOSIT_SUPPORTED"
  | "REDEMPTION_SUPPORTED"
  | "INSTANT_LIQUIDITY_SUPPORTED"
  | "PAUSED";

export type YieldMetric = { label: string; description?: string };
export type MoneyMetric = { value: string; currency: string };

export type SettlementTerms = {
  subscription: string;
  redemption: string;
  processing: string;
  minimums: string;
};

export type FeeTerms = { management?: string; notes?: string };
export type BackingTerms = {
  backing: string;
  custody?: string;
  rating?: string;
};

export type RwaOpportunity = {
  id: string;
  slug: string;
  issuer: string;
  name: string;
  symbol?: string;
  category: string;
  description?: string;
  networks: SourcedValue<string[]>;
  eligibility: SourcedValue<string>;
  yield?: SourcedValue<YieldMetric>;
  tvlOrAum?: SourcedValue<MoneyMetric>;
  settlement: SourcedValue<SettlementTerms>;
  fees?: SourcedValue<FeeTerms>;
  backing?: SourcedValue<BackingTerms>;
  integrationStatus: IntegrationStatus;
};