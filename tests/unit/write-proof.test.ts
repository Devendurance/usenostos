import { describe, expect, it } from "vitest";
import {
  assertMainnetChain,
  buildWriteProofPlan,
  parseWriteAmount,
  P0_ENABLE_MAINNET_WRITE_ENV,
  P0_WRITE_AMOUNT_ENV,
  P0_WRITE_TOKEN_ENV,
} from "@/lib/chain/write-proof";
import {
  BOT_USDT,
  type SettlementTokenRecord,
} from "@/lib/chain/settlement-token";

const KEY = "0x1111111111111111111111111111111111111111111111111111111111111111";

function unresolved(): SettlementTokenRecord {
  return { ...BOT_USDT, status: "UNRESOLVED" };
}

describe("write-proof guards", () => {
  it("refuses any chain other than 677", () => {
    expect(() => assertMainnetChain(1)).toThrow();
    expect(() => assertMainnetChain(0)).toThrow();
    expect(() => assertMainnetChain(677)).not.toThrow();
  });

  it("is disabled without the explicit opt-in", () => {
    const plan = buildWriteProofPlan({}, unresolved());
    expect(plan.enabled).toBe(false);
  });

  it("is disabled when opt-in is not 'true'", () => {
    const plan = buildWriteProofPlan(
      { [P0_ENABLE_MAINNET_WRITE_ENV]: "false" },
      unresolved(),
    );
    expect(plan.enabled).toBe(false);
  });

  it("refuses an unresolved settlement token for USDT writes", () => {
    const plan = buildWriteProofPlan(
      {
        [P0_ENABLE_MAINNET_WRITE_ENV]: "true",
        [P0_WRITE_TOKEN_ENV]: "USDT",
        BOT_BUILDER_PRIVATE_KEY: KEY,
      },
      unresolved(),
    );
    expect(plan.ok).toBe(false);
    if (!plan.ok) expect(plan.reason).toContain("VERIFIED");
  });

  it("refuses a rejected settlement token for USDT writes", () => {
    const rejected: SettlementTokenRecord = { ...BOT_USDT, status: "REJECTED" };
    const plan = buildWriteProofPlan(
      {
        [P0_ENABLE_MAINNET_WRITE_ENV]: "true",
        [P0_WRITE_TOKEN_ENV]: "USDT",
        BOT_BUILDER_PRIVATE_KEY: KEY,
      },
      rejected,
    );
    expect(plan.ok).toBe(false);
  });

  it("allows a BOT self-transfer plan with a verified key and opt-in", () => {
    const plan = buildWriteProofPlan(
      {
        [P0_ENABLE_MAINNET_WRITE_ENV]: "true",
        BOT_BUILDER_PRIVATE_KEY: KEY,
        [P0_WRITE_AMOUNT_ENV]: "0.0001",
      },
      unresolved(),
    );
    expect(plan.ok).toBe(true);
    if (plan.ok) {
      expect(plan.chainId).toBe(677);
      expect(plan.token).toBe("BOT");
      expect(plan.amountUnits).toBeGreaterThan(BigInt(0));
    }
  });

  it("uses a small configurable amount and refuses large amounts", () => {
    const small = parseWriteAmount({ [P0_WRITE_AMOUNT_ENV]: "0.0001" });
    expect(small).toBeGreaterThan(BigInt(0));
    expect(() => parseWriteAmount({ [P0_WRITE_AMOUNT_ENV]: "5" })).toThrow();
  });

  it("never sends the full balance by design (no balance is read or used)", () => {
    expect(parseWriteAmount({ [P0_WRITE_AMOUNT_ENV]: "0.0001" })).toBe(
      BigInt("100000000000000"),
    );
  });
});