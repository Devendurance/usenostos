import { describe, expect, it } from "vitest";
import {
  buildVaultDeployPlan,
  buildVaultRegistrationPlan,
  P3_ENABLE_DEPLOY_ENV,
  DEMO_VAULT_SLUG,
  REGISTRY_REDEMPTION_SUPPORTED,
} from "@/scripts/registry/vault-plan";
import { BOT_TESTNET_SETTLEMENT_TOKEN } from "@/lib/chain/settlement-token";
import { integrationIdFor } from "@/lib/rwa/metadata";

const KEY =
  "0x3333333333333333333333333333333333333333333333333333333333333333";
const VAULT =
  "0x4444444444444444444444444444444444444444";

describe("vault deploy plan", () => {
  it("is disabled without the explicit opt-in", () => {
    expect(buildVaultDeployPlan({}).enabled).toBe(false);
  });

  it("targets BOT Testnet 968 and uses the verified Testnet USDT", () => {
    const plan = buildVaultDeployPlan({
      [P3_ENABLE_DEPLOY_ENV]: "true",
      BOT_TESTNET_PRIVATE_KEY: KEY,
    });
    expect(plan.ok).toBe(true);
    if (plan.ok) {
      expect(plan.chainId).toBe(968);
      expect(plan.asset).toBe(BOT_TESTNET_SETTLEMENT_TOKEN.address);
    }
  });

  it("never signs without a testnet key", () => {
    const plan = buildVaultDeployPlan({ [P3_ENABLE_DEPLOY_ENV]: "true" });
    expect(plan.ok).toBe(false);
  });
});

describe("vault registration plan", () => {
  it("registers the demo vault as REDEMPTION_SUPPORTED with the vault address", () => {
    const plan = buildVaultRegistrationPlan(
      {
        [P3_ENABLE_DEPLOY_ENV]: "true",
        BOT_TESTNET_PRIVATE_KEY: KEY,
      },
      VAULT,
    );
    expect(plan.ok).toBe(true);
    if (plan.ok) {
      expect(plan.integrationId).toBe(integrationIdFor(DEMO_VAULT_SLUG));
      expect(plan.nostosVault).toBe(VAULT);
      expect(plan.status).toBe(REGISTRY_REDEMPTION_SUPPORTED);
      expect(plan.metadataHash).toMatch(/^0x[0-9a-f]{64}$/);
    }
  });
});