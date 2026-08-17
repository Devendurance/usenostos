import { describe, expect, it } from "vitest";
import {
  classifyFunds,
  estimateRequiredBalance,
  formatPreflightReport,
  isAlreadyKnownError,
  isInsufficientFundsError,
  MAX_SEND_RETRIES,
  NATIVE_TRANSFER_GAS_LIMIT,
  runIdempotentBroadcast,
} from "@/lib/chain/testnet-write";
import { classifyRpcHealth } from "@/lib/chain/testnet-rpc-health";

const RAW =
  "0x02f87001843b9aca00843b9aca008252089400000000000000000000000000000000000000018080";
const HASH =
  "0x1111111111111111111111111111111111111111111111111111111111111111";

function healthyZero() {
  return classifyRpcHealth([
    { block: 100, balance: BigInt(0), nonce: 0 },
    { block: 101, balance: BigInt(0), nonce: 0 },
    { block: 102, balance: BigInt(0), nonce: 0 },
  ]);
}

function contradictory() {
  return classifyRpcHealth([
    { block: 100, balance: BigInt(0), nonce: 0 },
    { block: 102, balance: BigInt(10), nonce: 0 },
    { block: 99, balance: BigInt(0), nonce: 0 },
  ]);
}

describe("testnet write-proof fund classification", () => {
  it("classifies consistently zero fresh balance as genuine insufficient funds", () => {
    const r = classifyFunds(healthyZero(), BigInt(0), BigInt(1_000_000));
    expect(r.kind).toBe("INSUFFICIENT_FUNDS");
  });

  it("classifies contradictory balance evidence as possible stale backend", () => {
    const r = classifyFunds(contradictory(), BigInt(0), BigInt(1));
    expect(r.kind).toBe("POSSIBLE_STALE_RPC_BACKEND");
  });

  it("classifies sufficient balance as SUFFICIENT", () => {
    const r = classifyFunds(
      healthyZero(),
      BigInt(100_000_000_000_000_000),
      BigInt(1_000_000),
    );
    expect(r.kind).toBe("SUFFICIENT");
  });

  it("computes the maximum required native balance as value plus gas", () => {
    expect(estimateRequiredBalance(BigInt(1_000_000), BigInt(21_000), BigInt(1))).toBe(
      BigInt(1_021_000),
    );
  });
});

describe("testnet write-proof idempotent broadcast", () => {
  it("retries the exact same raw transaction and hash on a retryable error", async () => {
    const seen: Array<{ raw: string; hash: string; attempt: number }> = [];
    let calls = 0;
    const broadcast = async (raw: string, hash: string, attempt: number) => {
      seen.push({ raw, hash, attempt });
      calls++;
      if (calls < 3) throw new Error("insufficient funds");
      return { hash, status: "confirmed" as const };
    };
    const result = await runIdempotentBroadcast({
      raw: RAW,
      hash: HASH,
      broadcast,
      maxAttempts: 5,
      retryDelayMs: 0,
    });
    expect(result.attempts).toBe(3);
    expect(result.result).not.toBeNull();
    expect(seen.length).toBe(3);
    for (const s of seen) {
      expect(s.raw).toBe(RAW);
      expect(s.hash).toBe(HASH);
    }
  });

  it("bounds the retry count", async () => {
    const broadcast = async () => {
      throw new Error("insufficient funds");
    };
    const result = await runIdempotentBroadcast({
      raw: RAW,
      hash: HASH,
      broadcast,
      maxAttempts: 5,
      retryDelayMs: 0,
    });
    expect(result.attempts).toBe(MAX_SEND_RETRIES);
    expect(result.result).toBeNull();
  });

  it("stops immediately on a non-retryable error", async () => {
    let calls = 0;
    const broadcast = async () => {
      calls++;
      throw new Error("execution reverted");
    };
    const result = await runIdempotentBroadcast({
      raw: RAW,
      hash: HASH,
      broadcast,
      maxAttempts: 5,
      retryDelayMs: 0,
    });
    expect(result.attempts).toBe(1);
    expect(calls).toBe(1);
  });
});

describe("testnet write-proof error classification", () => {
  it("recognizes insufficient funds errors", () => {
    expect(
      isInsufficientFundsError(new Error("insufficient funds for gas")),
    ).toBe(true);
  });

  it("recognizes already-known transactions", () => {
    expect(isAlreadyKnownError(new Error("already known"))).toBe(true);
    expect(isAlreadyKnownError(new Error("nonce too low"))).toBe(true);
  });
});

describe("testnet write-proof preflight report", () => {
  it("never includes a private key or raw secret", () => {
    const report = formatPreflightReport({
      chainId: 968,
      sender: "0xAbc",
      latestBlock: 100,
      balance: BigInt(10),
      nonce: 1,
      gasPriceWei: BigInt(1),
      maxFeePerGasWei: BigInt(1),
      value: BigInt(1),
      gasLimit: NATIVE_TRANSFER_GAS_LIMIT,
      required: BigInt(22_000),
    });
    expect(report).not.toContain("private");
    expect(report).not.toContain("secret");
    expect(report).not.toContain("0x1111");
  });
});