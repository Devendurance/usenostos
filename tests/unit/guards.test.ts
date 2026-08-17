import { describe, expect, it } from "vitest";
import {
  assertBotMainnetChain,
  assertBotTestnetChain,
} from "@/lib/chain/guards";
import {
  buildTestnetWriteProofPlan,
  P0_ENABLE_TESTNET_WRITE_ENV,
  P0_TESTNET_WRITE_AMOUNT_ENV,
} from "@/lib/chain/write-proof-testnet";

const TESTNET_KEY =
  "0x2222222222222222222222222222222222222222222222222222222222222222";
const MAINNET_KEY =
  "0x1111111111111111111111111111111111111111111111111111111111111111";

describe("environment guards", () => {
  it("accepts chain 677 only for mainnet and rejects 968", () => {
    expect(() => assertBotMainnetChain(677)).not.toThrow();
    expect(() => assertBotMainnetChain(968)).toThrow();
  });

  it("accepts chain 968 only for testnet and rejects 677", () => {
    expect(() => assertBotTestnetChain(968)).not.toThrow();
    expect(() => assertBotTestnetChain(677)).toThrow();
  });
});

describe("testnet write-proof guards", () => {
  it("requires the explicit testnet opt-in", () => {
    const plan = buildTestnetWriteProofPlan({});
    expect(plan.enabled).toBe(false);
  });

  it("never signs with the mainnet builder key", () => {
    const plan = buildTestnetWriteProofPlan({
      [P0_ENABLE_TESTNET_WRITE_ENV]: "true",
      BOT_BUILDER_PRIVATE_KEY: MAINNET_KEY,
    });
    expect(plan.ok).toBe(false);
    if (!plan.ok) expect(plan.reason).toContain("BOT_TESTNET_PRIVATE_KEY");
  });

  it("builds a tiny tBOT self-transfer plan with the testnet key", () => {
    const plan = buildTestnetWriteProofPlan({
      [P0_ENABLE_TESTNET_WRITE_ENV]: "true",
      BOT_TESTNET_PRIVATE_KEY: TESTNET_KEY,
      [P0_TESTNET_WRITE_AMOUNT_ENV]: "0.0001",
    });
    expect(plan.ok).toBe(true);
    if (plan.ok) {
      expect(plan.chainId).toBe(968);
      expect(plan.token).toBe("tBOT");
      expect(plan.amountUnits).toBeGreaterThan(BigInt(0));
    }
  });
});