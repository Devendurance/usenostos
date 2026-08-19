import { describe, expect, it } from "vitest";
import { BOT_TESTNET_SETTLEMENT_TOKEN } from "@/lib/chain/settlement-token";
import {
  buildP6HarvestPlan,
  P6_ENABLE_TESTNET_DEPLOY_ENV,
  P6_PROTOCOL_TREASURY_ENV,
  parseP6HarvestTicketId,
  resolveP6InstantPool,
} from "@/scripts/registry/p6-plan";

const TESTNET_KEY =
  "0x3333333333333333333333333333333333333333333333333333333333333333";
const P4_VAULT = "0xd6333420629dcd2f9bce31ef12c8a95e5e13fdac";
const P4_TICKET = "0x59b2580c5bdbcfb32066ed013f9ff0f7a812fd7f";
const P5_POOL = "0x2f18e935ca51729777503d4dba866a339f284472";
const P6_POOL = "0x0dcf185ab13144652c822b255d7155ebb8b64eb3";
const TREASURY = "0xC44685b7c78cC9C9b7f6623d7697Ac30ab0D6Dc9";

const enabledEnv = {
  [P6_ENABLE_TESTNET_DEPLOY_ENV]: "true",
  BOT_TESTNET_PRIVATE_KEY: TESTNET_KEY,
  [P6_PROTOCOL_TREASURY_ENV]: TREASURY,
};

const addresses = {
  p4: { asyncVault: P4_VAULT, redemptionTicket: P4_TICKET },
  p5: { instantPool: P5_POOL },
  p6: { instantPool: P6_POOL, protocolTreasury: TREASURY },
};

describe("P6 harvest plan", () => {
  it("is disabled without explicit opt-in and does not send a harvest plan", () => {
    const plan = buildP6HarvestPlan({}, addresses, "3");
    expect(plan.enabled).toBe(false);
    expect(plan.ok).toBe(false);
    if (!plan.ok) {
      expect(plan.reason).toContain(`${P6_ENABLE_TESTNET_DEPLOY_ENV}=true`);
    }
  });

  it("refuses when p6.instantPool is missing even if p5.instantPool exists", () => {
    const plan = buildP6HarvestPlan(enabledEnv, {
      p4: addresses.p4,
      p5: { instantPool: P5_POOL },
    }, "3");
    expect(plan.ok).toBe(false);
    if (!plan.ok) {
      expect(plan.reason).toContain("p6.instantPool");
      expect(plan.reason.toLowerCase()).not.toContain("p5.instantpool is required");
    }
    const resolved = resolveP6InstantPool({ p5: { instantPool: P5_POOL } });
    expect(resolved.ok).toBe(false);
  });

  it("resolves p6.instantPool and never the P5 pool", () => {
    const plan = buildP6HarvestPlan(enabledEnv, addresses, "3");
    expect(plan.ok).toBe(true);
    if (plan.ok) {
      expect(plan.pool).toBe(P6_POOL);
      expect(plan.pool.toLowerCase()).not.toBe(P5_POOL.toLowerCase());
      expect(plan.ticketId).toBe(BigInt(3));
      expect(plan.chainId).toBe(968);
      expect(plan.asset).toBe(BOT_TESTNET_SETTLEMENT_TOKEN.address);
      expect(plan.vault).toBe(P4_VAULT);
      expect(plan.ticket).toBe(P4_TICKET);
      expect(plan.protocolTreasury.toLowerCase()).toBe(TREASURY.toLowerCase());
    }
  });

  it("refuses incomplete P4 bindings and treasury mismatches", () => {
    const missingTicket = buildP6HarvestPlan(
      enabledEnv,
      {
        p4: { asyncVault: P4_VAULT },
        p6: { instantPool: P6_POOL, protocolTreasury: TREASURY },
      },
      "3",
    );
    expect(missingTicket.ok).toBe(false);
    if (!missingTicket.ok) {
      expect(missingTicket.reason).toContain("redemptionTicket");
    }

    const treasuryMismatch = buildP6HarvestPlan(enabledEnv, {
      ...addresses,
      p6: {
        instantPool: P6_POOL,
        protocolTreasury: "0x0000000000000000000000000000000000000001",
      },
    }, "3");
    expect(treasuryMismatch.ok).toBe(false);
    if (!treasuryMismatch.ok) {
      expect(treasuryMismatch.reason).toContain("protocolTreasury");
    }
  });

  it("rejects a non-positive ticket id before any pool resolution", () => {
    expect(parseP6HarvestTicketId(undefined).ok).toBe(false);
    expect(parseP6HarvestTicketId("0").ok).toBe(false);
    expect(parseP6HarvestTicketId("3").ok).toBe(true);
    const zero = buildP6HarvestPlan(enabledEnv, addresses, "0");
    expect(zero.ok).toBe(false);
    if (!zero.ok) {
      expect(zero.reason).toContain("positive integer");
    }
  });
});
