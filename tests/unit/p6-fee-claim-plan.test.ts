import { describe, expect, it } from "vitest";
import { privateKeyToAccount } from "viem/accounts";
import { BOT_TESTNET_SETTLEMENT_TOKEN } from "@/lib/chain/settlement-token";
import {
  BOT_TESTNET_PRIVATE_KEY_ENV,
  BOT_TESTNET_TREASURY_PRIVATE_KEY_ENV,
  BUILDER_PRIVATE_KEY_ENV,
  getTestnetTreasuryPrivateKey,
} from "@/lib/chain/builder-wallet";
import {
  buildP6FeeClaimPlan,
  P6_ENABLE_TESTNET_DEPLOY_ENV,
  P6_PROTOCOL_TREASURY_ENV,
  requireP6AccruedFees,
  resolveP6InstantPool,
} from "@/scripts/registry/p6-plan";

const DEPLOYER_KEY = `0x${"33".repeat(32)}`;
const TREASURY_KEY = `0x${"44".repeat(32)}`;
const MAINNET_KEY = `0x${"11".repeat(32)}`;
const TREASURY = privateKeyToAccount(TREASURY_KEY as `0x${string}`).address;
const P4_VAULT = "0xd6333420629dcd2f9bce31ef12c8a95e5e13fdac";
const P4_TICKET = "0x59b2580c5bdbcfb32066ed013f9ff0f7a812fd7f";
const P5_POOL = "0x2f18e935ca51729777503d4dba866a339f284472";
const P6_POOL = "0x0dcf185ab13144652c822b255d7155ebb8b64eb3";
const CONFIGURED_TREASURY = "0xC44685b7c78cC9C9b7f6623d7697Ac30ab0D6Dc9";

const enabledEnv = {
  [P6_ENABLE_TESTNET_DEPLOY_ENV]: "true",
  [P6_PROTOCOL_TREASURY_ENV]: TREASURY,
  [BOT_TESTNET_TREASURY_PRIVATE_KEY_ENV]: TREASURY_KEY,
  [BOT_TESTNET_PRIVATE_KEY_ENV]: DEPLOYER_KEY,
};

const addresses = {
  p4: { asyncVault: P4_VAULT, redemptionTicket: P4_TICKET },
  p5: { instantPool: P5_POOL },
  p6: { instantPool: P6_POOL, protocolTreasury: TREASURY },
};

describe("P6 protocol fee claim plan", () => {
  it("is disabled without explicit opt-in", () => {
    const plan = buildP6FeeClaimPlan({}, addresses);
    expect(plan.enabled).toBe(false);
    expect(plan.ok).toBe(false);
    if (!plan.ok) {
      expect(plan.reason).toContain(`${P6_ENABLE_TESTNET_DEPLOY_ENV}=true`);
    }
  });

  it("resolves p6.instantPool and never the P5 pool", () => {
    const plan = buildP6FeeClaimPlan(enabledEnv, addresses);
    expect(plan.ok).toBe(true);
    if (plan.ok) {
      expect(plan.pool).toBe(P6_POOL);
      expect(plan.pool.toLowerCase()).not.toBe(P5_POOL.toLowerCase());
      expect(plan.chainId).toBe(968);
      expect(plan.asset).toBe(BOT_TESTNET_SETTLEMENT_TOKEN.address);
      expect(plan.vault).toBe(P4_VAULT);
      expect(plan.ticket).toBe(P4_TICKET);
      expect(plan.signer.toLowerCase()).toBe(TREASURY.toLowerCase());
      expect(plan.protocolTreasury.toLowerCase()).toBe(TREASURY.toLowerCase());
    }
    const missingP6 = resolveP6InstantPool({ p5: { instantPool: P5_POOL } });
    expect(missingP6.ok).toBe(false);
  });

  it("refuses when p6.instantPool is missing even if p5.instantPool exists", () => {
    const plan = buildP6FeeClaimPlan(enabledEnv, {
      p4: addresses.p4,
      p5: { instantPool: P5_POOL },
    });
    expect(plan.ok).toBe(false);
    if (!plan.ok) {
      expect(plan.reason).toContain("p6.instantPool");
    }
  });

  it("fails closed when the treasury key is missing", () => {
    const plan = buildP6FeeClaimPlan(
      {
        [P6_ENABLE_TESTNET_DEPLOY_ENV]: "true",
        [P6_PROTOCOL_TREASURY_ENV]: TREASURY,
        [BOT_TESTNET_PRIVATE_KEY_ENV]: DEPLOYER_KEY,
      },
      addresses,
    );
    expect(plan.ok).toBe(false);
    if (!plan.ok) {
      expect(plan.reason).toContain(BOT_TESTNET_TREASURY_PRIVATE_KEY_ENV);
    }
  });

  it("fails closed when the treasury signer does not match protocolTreasury", () => {
    const plan = buildP6FeeClaimPlan(
      {
        [P6_ENABLE_TESTNET_DEPLOY_ENV]: "true",
        [P6_PROTOCOL_TREASURY_ENV]: CONFIGURED_TREASURY,
        [BOT_TESTNET_TREASURY_PRIVATE_KEY_ENV]: TREASURY_KEY,
      },
      {
        ...addresses,
        p6: { instantPool: P6_POOL, protocolTreasury: CONFIGURED_TREASURY },
      },
    );
    expect(plan.ok).toBe(false);
    if (!plan.ok) {
      expect(plan.reason.toLowerCase()).toContain("signer");
    }
  });

  it("does not let the deployer key substitute for the treasury signer", () => {
    expect(
      getTestnetTreasuryPrivateKey({
        [BOT_TESTNET_PRIVATE_KEY_ENV]: DEPLOYER_KEY,
        [BUILDER_PRIVATE_KEY_ENV]: MAINNET_KEY,
      }),
    ).toBeNull();
    const plan = buildP6FeeClaimPlan(
      {
        [P6_ENABLE_TESTNET_DEPLOY_ENV]: "true",
        [P6_PROTOCOL_TREASURY_ENV]: TREASURY,
        [BOT_TESTNET_PRIVATE_KEY_ENV]: TREASURY_KEY,
      },
      addresses,
    );
    expect(plan.ok).toBe(false);
    if (!plan.ok) {
      expect(plan.reason).toContain(BOT_TESTNET_TREASURY_PRIVATE_KEY_ENV);
      expect(plan.reason).not.toContain("BOT_TESTNET_PRIVATE_KEY is not configured");
    }
  });

  it("refuses a zero accrued-fee snapshot before broadcasting", () => {
    const zero = requireP6AccruedFees(BigInt(0));
    expect(zero.ok).toBe(false);
    if (!zero.ok) {
      expect(zero.reason).toContain("accruedProtocolFees");
    }
    expect(requireP6AccruedFees(BigInt(1250)).ok).toBe(true);
  });
});
