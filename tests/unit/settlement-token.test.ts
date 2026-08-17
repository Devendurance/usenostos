import { describe, expect, it } from "vitest";
import {
  BOT_USDT,
  isUsableSettlementToken,
  type SettlementTokenRecord,
} from "@/lib/chain/settlement-token";

const VALID_STATUSES = [
  "VERIFIED",
  "PROVISIONALLY VERIFIED",
  "UNRESOLVED",
  "REJECTED",
];

function record(
  status: SettlementTokenRecord["status"],
  overrides: Partial<SettlementTokenRecord> = {},
): SettlementTokenRecord {
  return {
    address: "0x0000000000000000000000000000000000000001",
    symbol: "USDT",
    decimals: 6,
    status,
    verifiedAt: null,
    evidence: [],
    ...overrides,
  };
}

describe("settlement token provenance", () => {
  it("records only one of the four valid statuses", () => {
    expect(VALID_STATUSES).toContain(BOT_USDT.status);
  });

  it("cannot treat an unresolved token as usable", () => {
    expect(isUsableSettlementToken(record("UNRESOLVED"))).toBe(false);
  });

  it("cannot treat a provisionally verified or rejected token as usable", () => {
    expect(isUsableSettlementToken(record("PROVISIONALLY VERIFIED"))).toBe(
      false,
    );
    expect(isUsableSettlementToken(record("REJECTED"))).toBe(false);
  });

  it("treats only a fully verified token with address and decimals as usable", () => {
    expect(isUsableSettlementToken(record("VERIFIED"))).toBe(true);
    expect(isUsableSettlementToken(record("VERIFIED", { address: null }))).toBe(
      false,
    );
    expect(
      isUsableSettlementToken(record("VERIFIED", { decimals: null })),
    ).toBe(false);
  });

  it("does not silently treat the candidate as canonical", () => {
    if (BOT_USDT.status !== "VERIFIED") {
      expect(isUsableSettlementToken(BOT_USDT)).toBe(false);
    }
  });
});