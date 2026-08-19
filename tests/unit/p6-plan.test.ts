import { describe, expect, it } from "vitest";
import { BOT_TESTNET_SETTLEMENT_TOKEN } from "@/lib/chain/settlement-token";
import {
  buildP6DeployPlan,
  P6_ENABLE_TESTNET_DEPLOY_ENV,
  P6_PROTOCOL_TREASURY_ENV,
} from "@/scripts/registry/p6-plan";

const TESTNET_KEY =
  "0x3333333333333333333333333333333333333333333333333333333333333333";
const P4_VAULT = "0x2b0475ca0b12e3b8f9634c6ac3190e96508385d4";
const TICKET = "0x6666666666666666666666666666666666666666";
const TREASURY = "0x7777777777777777777777777777777777777777";
const ZERO = "0x0000000000000000000000000000000000000000";

const enabledEnv = {
  [P6_ENABLE_TESTNET_DEPLOY_ENV]: "true",
  BOT_TESTNET_PRIVATE_KEY: TESTNET_KEY,
  [P6_PROTOCOL_TREASURY_ENV]: TREASURY,
};

const p4 = { p4: { asyncVault: P4_VAULT, redemptionTicket: TICKET } };

describe("P6 deployment plan", () => {
  it("is disabled without explicit opt-in", () => {
    const plan = buildP6DeployPlan({}, {});
    expect(plan.enabled).toBe(false);
    if (!plan.ok) {
      expect(plan.reason).toContain(`${P6_ENABLE_TESTNET_DEPLOY_ENV}=true`);
    }
  });

  it("fails closed without the Testnet key", () => {
    const plan = buildP6DeployPlan(
      {
        [P6_ENABLE_TESTNET_DEPLOY_ENV]: "true",
        [P6_PROTOCOL_TREASURY_ENV]: TREASURY,
      },
      p4,
    );
    expect(plan.ok).toBe(false);
    if (!plan.ok) {
      expect(plan.reason).toContain("BOT_TESTNET_PRIVATE_KEY");
    }
  });

  it("refuses inconsistent/incomplete P4 records", () => {
    const plan = buildP6DeployPlan(enabledEnv, {
      p4: { asyncVault: P4_VAULT },
    });
    expect(plan.ok).toBe(false);
    if (!plan.ok) {
      expect(plan.reason).toContain("redemptionTicket");
    }
  });

  it("refuses missing, zero, or invalid protocol treasury", () => {
    const missing = buildP6DeployPlan(
      {
        [P6_ENABLE_TESTNET_DEPLOY_ENV]: "true",
        BOT_TESTNET_PRIVATE_KEY: TESTNET_KEY,
      },
      p4,
    );
    expect(missing.ok).toBe(false);
    if (!missing.ok) {
      expect(missing.reason).toContain(P6_PROTOCOL_TREASURY_ENV);
    }

    const zero = buildP6DeployPlan(
      {
        [P6_ENABLE_TESTNET_DEPLOY_ENV]: "true",
        BOT_TESTNET_PRIVATE_KEY: TESTNET_KEY,
        [P6_PROTOCOL_TREASURY_ENV]: ZERO,
      },
      p4,
    );
    expect(zero.ok).toBe(false);
    if (!zero.ok) {
      expect(zero.reason.toLowerCase()).toContain("zero");
    }

    const invalid = buildP6DeployPlan(
      {
        [P6_ENABLE_TESTNET_DEPLOY_ENV]: "true",
        BOT_TESTNET_PRIVATE_KEY: TESTNET_KEY,
        [P6_PROTOCOL_TREASURY_ENV]: "not-an-address",
      },
      p4,
    );
    expect(invalid.ok).toBe(false);
    if (!invalid.ok) {
      expect(invalid.reason.toLowerCase()).toMatch(/valid|invalid/);
    }
  });

  it("targets chain 968, verified Testnet USDT, persisted P4 vault/ticket, and treasury", () => {
    const plan = buildP6DeployPlan(enabledEnv, p4);
    expect(plan.ok).toBe(true);
    if (plan.ok) {
      expect(plan.chainId).toBe(968);
      expect(plan.asset).toBe(BOT_TESTNET_SETTLEMENT_TOKEN.address);
      expect(plan.vault).toBe(P4_VAULT);
      expect(plan.ticket).toBe(TICKET);
      expect(plan.protocolTreasury).toBe(TREASURY);
    }
  });
});
