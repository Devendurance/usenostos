import type { RwaOpportunity } from "@/lib/rwa/types";

export const ousgOpportunity: RwaOpportunity = {
  id: "ousg",
  slug: "ousg",
  issuer: "Ondo Finance",
  name: "OUSG",
  symbol: "OUSG",
  category: "Treasuries",
  description:
    "Ondo Short-Term US Government Treasuries (OUSG): tokenized exposure primarily to short-term US Treasuries and GSE securities, with 24/7 tokenized subscription and redemption.",
  networks: {
    value: ["Ethereum", "Polygon", "Solana", "XRP Ledger"],
    source: {
      name: "Ondo smart contract addresses",
      url: "https://docs.ondo.finance/addresses.md",
      type: "issuer_docs",
      retrievedAt: "2026-08-17",
    },
  },
  eligibility: {
    value:
      "Qualified Access: onboarding and KYC required; only investors eligible for Ondo Qualified Access Funds may invest. OUSG is not available from BOT Chain in Nostos.",
    source: {
      name: "Ondo OUSG overview",
      url: "https://docs.ondo.finance/qualified-access-products/ousg/overview",
      type: "issuer_docs",
      retrievedAt: "2026-08-17",
    },
  },
  yield: {
    value: {
      label: "Yield methodology",
      description:
        "NAV per token is updated at the end of each business day based on underlying performance; the OUSG Price Oracle is updated onchain with that NAV. Current yield is not reported by Nostos.",
    },
    source: {
      name: "Ondo OUSG overview",
      url: "https://docs.ondo.finance/qualified-access-products/ousg/overview",
      type: "issuer_docs",
      retrievedAt: "2026-08-17",
    },
  },
  settlement: {
    value: {
      subscription:
        "Instant minting via USDC/PYUSD (24/7) subject to daily limits; non-instant requests supported.",
      redemption:
        "Instant redemption to USDC (24/7) subject to daily limits; non-instant redemption available.",
      processing:
        "Instant transactions settle immediately; NAV updates end of each business day.",
      minimums:
        "Instant: USD 5,000 minimum (mint and redeem). Non-instant: USD 100,000 investment minimum, USD 50,000 redemption minimum.",
    },
    source: {
      name: "Ondo OUSG overview + instant limits",
      url: "https://docs.ondo.finance/qualified-access-products/ousg/instant-limits",
      type: "issuer_docs",
      retrievedAt: "2026-08-17",
    },
  },
  fees: {
    value: {
      management: "0.15% management fee (waived until January 1, 2027).",
      notes:
        "Instant minting/redemption limited to USD 50M global and USD 25M per investor within 24 hours.",
    },
    source: {
      name: "Ondo OUSG overview",
      url: "https://docs.ondo.finance/qualified-access-products/ousg/overview",
      type: "issuer_docs",
      retrievedAt: "2026-08-17",
    },
  },
  backing: {
    value: {
      backing:
        "Short-term US Treasuries, GSE securities, and funds issued by asset managers (e.g., BlackRock, Franklin Templeton, WisdomTree, Fidelity), plus bank deposits and USDC for liquidity.",
      custody: "Coinbase Prime custodian account (OUSG.eth) for USDC flows.",
      rating: undefined,
    },
    source: {
      name: "Ondo OUSG overview + addresses",
      url: "https://docs.ondo.finance/addresses.md",
      type: "issuer_docs",
      retrievedAt: "2026-08-17",
    },
  },
  integrationStatus: "DISCOVERY_ONLY",
};