import { describe, expect, it } from "vitest";
import {
  buildDeployPlan,
  buildRegistrationPlan,
  P2_ENABLE_DEPLOY_ENV,
} from "@/scripts/registry/plan";
import { integrationIdFor } from "@/lib/rwa/metadata";

const KEY =
  "0x3333333333333333333333333333333333333333333333333333333333333333";

describe("testnet registry deploy/register plans", () => {
  it("is disabled without the explicit opt-in", () => {
    const plan = buildDeployPlan({});
    expect(plan.enabled).toBe(false);
  });

  it("targets BOT Testnet 968 and refuses mainnet in the guard", () => {
    const plan = buildDeployPlan({
      [P2_ENABLE_DEPLOY_ENV]: "true",
      BOT_TESTNET_PRIVATE_KEY: KEY,
    });
    expect(plan.ok).toBe(true);
    if (plan.ok) expect(plan.chainId).toBe(968);
  });

  it("never signs without a testnet key", () => {
    const plan = buildDeployPlan({ [P2_ENABLE_DEPLOY_ENV]: "true" });
    expect(plan.ok).toBe(false);
    if (!plan.ok) expect(plan.reason).toContain("BOT_TESTNET_PRIVATE_KEY");
  });

  it("builds a discovery-only registration with a zero vault", () => {
    const plan = buildRegistrationPlan(
      {
        [P2_ENABLE_DEPLOY_ENV]: "true",
        BOT_TESTNET_PRIVATE_KEY: KEY,
      },
      "ousg",
    );
    expect(plan.ok).toBe(true);
    if (plan.ok) {
      expect(plan.nostosVault).toBe(
        "0x0000000000000000000000000000000000000000",
      );
      expect(plan.integrationId).toBe(integrationIdFor("ousg"));
    }
  });
});