import type { RwaOpportunity } from "@/lib/rwa/types";

export const demoVaultOpportunity: RwaOpportunity = {
  id: "nostos-async-vault",
  slug: "nostos-async-vault",
  issuer: "Nostos (testnet demonstration)",
  name: "Nostos Async Settlement Vault",
  symbol: "NOS-VAULT",
  category: "Testnet Demo",
  description:
    "BOT TESTNET · 0% YIELD · REDEMPTION SUPPORTED. Testnet infrastructure demonstration. This vault does not represent an RWA investment and does not earn yield.",
  networks: {
    value: ["BOT Testnet (968)"],
    source: {
      name: "Nostos network provenance",
      url: "https://docs.botchain.ai",
      type: "issuer_docs",
      retrievedAt: "2026-08-17",
    },
  },
  eligibility: {
    value:
      "Open testnet demonstration. Any wallet on BOT Testnet (968) may participate. Not an investment product.",
    source: {
      name: "Nostos demo vault metadata",
      url: "https://docs.botchain.ai",
      type: "issuer_docs",
      retrievedAt: "2026-08-17",
    },
  },
  yield: {
    value: {
      label: "0% yield",
      description:
        "This demonstration vault accrues no yield and pays no interest. Deposits are held as settlement liquidity only.",
    },
    source: {
      name: "Nostos demo vault metadata",
      url: "https://docs.botchain.ai",
      type: "issuer_docs",
      retrievedAt: "2026-08-17",
    },
  },
  settlement: {
    value: {
      subscription: "Synchronous deposit: approve Testnet USDT, then deposit for vault shares (1 USDT = 1 share).",
      redemption:
        "Asynchronous redemption: requestRedeem locks shares (Pending); a Nostos settler transitions to Claimable against reserved real USDT; redeem/withdraw claims USDT.",
      processing: "Settlement is demonstrated by Nostos admin tooling, never by a timer.",
      minimums: "None; any positive amount.",
    },
    source: {
      name: "Nostos demo vault metadata",
      url: "https://docs.botchain.ai",
      type: "issuer_docs",
      retrievedAt: "2026-08-17",
    },
  },
  fees: {
    value: {
      notes: "No management or performance fees. No yield is generated.",
    },
    source: {
      name: "Nostos demo vault metadata",
      url: "https://docs.botchain.ai",
      type: "issuer_docs",
      retrievedAt: "2026-08-17",
    },
  },
  backing: {
    value: {
      backing:
        "No OUSG/TBILL backing and no real-world-asset backing claim. The vault holds the deposited Testnet USDT as real settlement liquidity.",
      custody: "Held in the NostosAsyncVault contract on BOT Testnet.",
      rating: undefined,
    },
    source: {
      name: "Nostos demo vault metadata",
      url: "https://docs.botchain.ai",
      type: "issuer_docs",
      retrievedAt: "2026-08-17",
    },
  },
  integrationStatus: "REDEMPTION_SUPPORTED",
};

export const p4DemoVaultOpportunity: RwaOpportunity = {
  ...demoVaultOpportunity,
  description:
    "BOT TESTNET · 0% YIELD · REDEMPTION SUPPORTED. Testnet settlement infrastructure demonstration with asynchronous redemption and TRANSFERABLE ERC-721 CLAIM TICKETS. This vault does not represent an RWA investment and does not earn yield.",
  settlement: {
    ...demoVaultOpportunity.settlement,
    value: {
      ...demoVaultOpportunity.settlement.value,
      redemption:
        "Asynchronous redemption: requestRedeem locks shares (Pending), mints a transferable ERC-721 redemption claim ticket to the controller, and a Nostos settler transitions the request to Claimable against reserved real USDT. The current ticket owner claims the settlement proceeds.",
      processing:
        "Settlement is demonstrated by Nostos admin tooling, never by a timer. Transferring the ticket transfers the right to claim the request's settlement proceeds.",
    },
  },
  backing: {
    ...demoVaultOpportunity.backing!,
    value: {
      ...demoVaultOpportunity.backing!.value,
      custody: "Held in the NostosAsyncVaultP4 contract on BOT Testnet.",
    },
  },
};
