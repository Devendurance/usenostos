import { describe, expect, it } from "vitest";
import {
  formatWithdrawalUnlockAt,
  isP6PoolUsable,
  mapQuoteTicket,
  resolveLpRedeemAvailability,
} from "@/lib/chain/instant-pool-p6-hooks";

const ALICE = "0x1234567890abcdef1234567890abcdef12345678";
const POOL = "0x0000000000000000000000000000000000000404";

describe("P6 quote and LP helpers", () => {
  it("maps quoteTicket tuples to named fields", () => {
    const quote = mapQuoteTicket([
      BigInt(100_000_000),
      BigInt(98_500_000),
      BigInt(150),
      BigInt(0),
      BigInt(1_000),
      BigInt(998),
    ]);
    expect(quote).toEqual({
      faceValue: BigInt(100_000_000),
      amountOut: BigInt(98_500_000),
      discountBps: BigInt(150),
      utilizationBps: BigInt(0),
      sizeRatioBps: BigInt(1_000),
      postTradeUtilizationBps: BigInt(998),
    });
    expect(mapQuoteTicket(undefined)).toBeUndefined();
  });

  it("formats the real unlock timestamp and does not invent a zero time", () => {
    expect(formatWithdrawalUnlockAt(undefined)).toBeUndefined();
    expect(formatWithdrawalUnlockAt(BigInt(0))).toBeUndefined();
    expect(formatWithdrawalUnlockAt(BigInt(2_000_000_000))).toBe("2033-05-18T03:33:20.000Z");
  });

  it("does not treat missing reads as a withdrawable zero", () => {
    expect(
      resolveLpRedeemAvailability({
        unlockAt: undefined,
        maxRedeem: undefined,
        previewAssets: undefined,
        availableLiquidity: undefined,
        shares: BigInt(1),
      }),
    ).toEqual({ available: false, reason: "unknown" });
  });

  it("blocks redeem during cooldown and when cash is deployed", () => {
    expect(
      resolveLpRedeemAvailability({
        unlockAt: BigInt(2_000_000_000),
        maxRedeem: BigInt(0),
        previewAssets: BigInt(1),
        availableLiquidity: BigInt(1_000),
        shares: BigInt(1),
      }).reason,
    ).toBe("cooldown");
    expect(
      resolveLpRedeemAvailability({
        unlockAt: BigInt(0),
        maxRedeem: BigInt(0),
        previewAssets: BigInt(100),
        availableLiquidity: BigInt(0),
        shares: BigInt(1),
      }).reason,
    ).toBe("no-liquidity");
  });

  it("requires testnet, a wallet, and the P6 pool address", () => {
    expect(isP6PoolUsable(true, ALICE, POOL)).toBe(true);
    expect(isP6PoolUsable(false, ALICE, POOL)).toBe(false);
    expect(isP6PoolUsable(true, undefined, POOL)).toBe(false);
    expect(isP6PoolUsable(true, ALICE, undefined)).toBe(false);
  });
});
