import { describe, expect, it } from "vitest";
import { BOT_TESTNET_SETTLEMENT_TOKEN } from "@/lib/chain/settlement-token";
import {
  buildP5DeployPlan,
  P5_ENABLE_TESTNET_DEPLOY_ENV,
} from "@/scripts/registry/p5-plan";

const TESTNET_KEY =
  "0x3333333333333333333333333333333333333333333333333333333333333333";
const P4_VAULT = "0x2b0475ca0b12e3b8f9634c6ac3190e96508385d4";
const TICKET = "0x6666666666666666666666666666666666666666";

describe("P5 deployment plan", () => {
  it("is disabled without explicit opt-in", () => {
    const plan = buildP5DeployPlan({}, {});
    expect(plan.enabled).toBe(false);
    if (!plan.ok) {
      expect(plan.reason).toContain(`${P5_ENABLE_TESTNET_DEPLOY_ENV}=true`);
    }
  });

  it("fails closed without the Testnet key", () => {
    const plan = buildP5DeployPlan(
      { [P5_ENABLE_TESTNET_DEPLOY_ENV]: "true" },
      { p4: { asyncVault: P4_VAULT, redemptionTicket: TICKET } },
    );
    expect(plan.ok).toBe(false);
    if (!plan.ok) {
      expect(plan.reason).toContain("BOT_TESTNET_PRIVATE_KEY");
    }
  });

  it("refuses inconsistent/incomplete P4 records", () => {
    const plan = buildP5DeployPlan(
      {
        [P5_ENABLE_TESTNET_DEPLOY_ENV]: "true",
        BOT_TESTNET_PRIVATE_KEY: TESTNET_KEY,
      },
      { p4: { asyncVault: P4_VAULT } },
    );
    expect(plan.ok).toBe(false);
    if (!plan.ok) {
      expect(plan.reason).toContain("redemptionTicket");
    }
  });

  it("targets chain 968, verified Testnet USDT, and the persisted P4 vault/ticket", () => {
    const plan = buildP5DeployPlan(
      {
        [P5_ENABLE_TESTNET_DEPLOY_ENV]: "true",
        BOT_TESTNET_PRIVATE_KEY: TESTNET_KEY,
      },
      { p4: { asyncVault: P4_VAULT, redemptionTicket: TICKET } },
    );
    expect(plan.ok).toBe(true);
    if (plan.ok) {
      expect(plan.chainId).toBe(968);
      expect(plan.asset).toBe(BOT_TESTNET_SETTLEMENT_TOKEN.address);
      expect(plan.vault).toBe(P4_VAULT);
      expect(plan.ticket).toBe(TICKET);
    }
  });
});
