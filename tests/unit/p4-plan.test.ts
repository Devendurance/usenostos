import { describe, expect, it } from "vitest";
import { metadataHashFor, integrationIdFor } from "@/lib/rwa/metadata";
import { p4DemoVaultOpportunity } from "@/lib/rwa/opportunities/demo-vault";
import { BOT_TESTNET_SETTLEMENT_TOKEN } from "@/lib/chain/settlement-token";
import type { DeployedTestnetAddresses } from "@/lib/chain/deployed-addresses";
import {
  buildP4DeployPlan,
  buildP4RegistrationPlan,
  buildP4SettlementPlan,
  P4_ENABLE_TESTNET_DEPLOY_ENV,
  REGISTRY_REDEMPTION_SUPPORTED,
} from "@/scripts/registry/p4-plan";

const TESTNET_KEY =
  "0x3333333333333333333333333333333333333333333333333333333333333333";
const P3_VAULT = "0x2b0475ca0b12e3b8f9634c6ac3190e96508385d4" as const;
const P4_VAULT = "0x4444444444444444444444444444444444444444" as const;
const TICKET = "0x5555555555555555555555555555555555555555" as const;

describe("P4 deployment plan", () => {
  it("is disabled without explicit opt-in", () => {
    const plan = buildP4DeployPlan({});
    expect(plan.enabled).toBe(false);
    if (!plan.ok) {
      expect(plan.reason).toContain(`${P4_ENABLE_TESTNET_DEPLOY_ENV}=true`);
    }
  });

  it("fails closed without the server-only Testnet key", () => {
    const plan = buildP4DeployPlan({
      [P4_ENABLE_TESTNET_DEPLOY_ENV]: "true",
    });
    expect(plan.ok).toBe(false);
    if (!plan.ok) {
      expect(plan.reason).toContain("BOT_TESTNET_PRIVATE_KEY");
    }
  });

  it("targets BOT Testnet 968 and verified Testnet USDT", () => {
    const plan = buildP4DeployPlan({
      [P4_ENABLE_TESTNET_DEPLOY_ENV]: "true",
      BOT_TESTNET_PRIVATE_KEY: TESTNET_KEY,
    });
    expect(plan.ok).toBe(true);
    if (plan.ok) {
      expect(plan.chainId).toBe(968);
      expect(plan.asset).toBe(BOT_TESTNET_SETTLEMENT_TOKEN.address);
    }
  });
});

describe("P4 registration plan", () => {
  it("refuses registration without a usable P4 vault address", () => {
    const plan = buildP4RegistrationPlan(
      {
        [P4_ENABLE_TESTNET_DEPLOY_ENV]: "true",
        BOT_TESTNET_PRIVATE_KEY: TESTNET_KEY,
      },
      "not-an-address",
    );
    expect(plan.ok).toBe(false);
    if (!plan.ok) expect(plan.reason).toContain("Invalid P4 vault address");
  });

    it("uses the supplied P4 vault and ticketed metadata", () => {
    const plan = buildP4RegistrationPlan(
      {
        [P4_ENABLE_TESTNET_DEPLOY_ENV]: "true",
        BOT_TESTNET_PRIVATE_KEY: TESTNET_KEY,
      },
      P4_VAULT,
    );
    expect(plan.ok).toBe(true);
    if (plan.ok) {
      expect(plan.integrationId).toBe(integrationIdFor(p4DemoVaultOpportunity.slug));
      expect(plan.metadataHash).toBe(metadataHashFor(p4DemoVaultOpportunity));
      expect(plan.nostosVault).toBe(P4_VAULT);
      expect(plan.status).toBe(REGISTRY_REDEMPTION_SUPPORTED);
    }
  });
});

describe("P4 settlement plan", () => {
  it("requires explicit opt-in, a P4 vault, and its ticket", () => {
    const disabled = buildP4SettlementPlan({}, P4_VAULT, TICKET, BigInt(7));
    expect(disabled.enabled).toBe(false);

    const missingTicket = buildP4SettlementPlan(
      {
        [P4_ENABLE_TESTNET_DEPLOY_ENV]: "true",
        BOT_TESTNET_PRIVATE_KEY: TESTNET_KEY,
      },
      P4_VAULT,
      undefined,
      BigInt(7),
    );
    expect(missingTicket.ok).toBe(false);
    if (!missingTicket.ok) expect(missingTicket.reason).toContain("ticket");
  });

  it("returns the P4 vault, ticket, and request id for a guarded read", () => {
    const plan = buildP4SettlementPlan(
      {
        [P4_ENABLE_TESTNET_DEPLOY_ENV]: "true",
        BOT_TESTNET_PRIVATE_KEY: TESTNET_KEY,
      },
      P4_VAULT,
      TICKET,
      BigInt(7),
    );
    expect(plan.ok).toBe(true);
    if (plan.ok) {
      expect(plan.p4Vault).toBe(P4_VAULT);
      expect(plan.ticket).toBe(TICKET);
      expect(plan.requestId).toBe(BigInt(7));
    }
  });
});

describe("P3/P4 address provenance", () => {
  it("preserves the P3 address while reading nested P4 addresses independently", () => {
    const addresses: DeployedTestnetAddresses = {
      asyncVault: P3_VAULT,
      p4: {
        asyncVault: P4_VAULT,
        redemptionTicket: TICKET,
      },
    };
    expect(addresses.asyncVault).toBe(P3_VAULT);
    expect(addresses.p4?.asyncVault).toBe(P4_VAULT);
    expect(addresses.p4?.redemptionTicket).toBe(TICKET);
  });
});
