import type { RwaOpportunity } from "@/lib/rwa/types";

export const tbillOpportunity: RwaOpportunity = {
  id: "tbill",
  slug: "tbill",
  issuer: "OpenEden",
  name: "TBILL",
  symbol: "TBILL",
  category: "Treasuries",
  description:
    "OpenEden TBILL: tokenized exposure to a pool of short-dated US Treasury Bills, backed 1:1 by US T-Bills and a small portion of USD, with on-chain subscription and redemption via the TBILL Vault.",
  networks: {
    value: ["Ethereum", "BNB Smart Chain", "Arbitrum"],
    source: {
      name: "OpenEden smart contract addresses",
      url: "https://docs.openeden.com/tbill/smart-contract-addresses",
      type: "issuer_docs",
      retrievedAt: "2026-08-17",
    },
  },
  eligibility: {
    value:
      "Whitelisted participation: investors must complete onboarding; only whitelisted wallet addresses may subscribe or redeem, and TBILL transfers are limited to whitelisted addresses.",
    source: {
      name: "OpenEden TBILL redemptions",
      url: "https://docs.openeden.com/tbill/redemptions",
      type: "issuer_docs",
      retrievedAt: "2026-08-17",
    },
  },
  yield: {
    value: {
      label: "Yield methodology",
      description:
        "TBILL holders receive returns reflecting the underlying US T-Bills portfolio. Current yield is not reported by Nostos.",
    },
    source: {
      name: "OpenEden TBILL introduction",
      url: "https://docs.openeden.com/tbill/introduction",
      type: "issuer_docs",
      retrievedAt: "2026-08-17",
    },
  },
  settlement: {
    value: {
      subscription:
        "USDC deposit mints TBILL tokens; on-chain instant subscription (24/7).",
      redemption:
        "USDC redemption; requests enter a FIFO redemption queue.",
      processing:
        "Redemptions are typically processed on the next 1 U.S. business day.",
      minimums: "Redemptions must meet a minimum value of USD 1.",
    },
    source: {
      name: "OpenEden TBILL redemptions",
      url: "https://docs.openeden.com/tbill/redemptions",
      type: "issuer_docs",
      retrievedAt: "2026-08-17",
    },
  },
  fees: {
    value: {
      notes:
        "USDC received = TBILL withdrawn x exchange rate - transaction fee; exchange rate and fee are determined when the redemption request is processed.",
    },
    source: {
      name: "OpenEden TBILL redemptions",
      url: "https://docs.openeden.com/tbill/redemptions",
      type: "issuer_docs",
      retrievedAt: "2026-08-17",
    },
  },
  backing: {
    value: {
      backing:
        "Backed 1:1 by short-dated US T-Bills and a small portion of USD; weighted-average maturity of the portfolio is less than 3 months.",
      custody:
        "BNY (US T-Bills custodian); investment management by BNY Mellon Investment Management.",
      rating:
        "Token issuer is a BVI-regulated professional fund; the TBILL Fund holds S&P Global Ratings AA+f/S1+ and was the first tokenized US Treasury fund rated 'A-bf' by Moody's. Nostos does not create its own risk score.",
    },
    source: {
      name: "OpenEden TBILL introduction",
      url: "https://docs.openeden.com/tbill/introduction",
      type: "issuer_docs",
      retrievedAt: "2026-08-17",
    },
  },
  integrationStatus: "DISCOVERY_ONLY",
};