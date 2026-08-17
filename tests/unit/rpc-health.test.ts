import { describe, expect, it } from "vitest";
import { classifyRpcHealth } from "@/lib/chain/testnet-rpc-health";

const B = (block: number, balance?: bigint, nonce?: number) => ({
  block,
  balance: balance ?? null,
  nonce: nonce ?? null,
});

describe("classifyRpcHealth", () => {
  it("classifies synchronized ascending samples as HEALTHY", () => {
    const r = classifyRpcHealth([
      B(100, BigInt(10), 1),
      B(101, BigInt(10), 1),
      B(102, BigInt(10), 1),
      B(103, BigInt(10), 1),
      B(104, BigInt(10), 1),
    ]);
    expect(r.status).toBe("HEALTHY");
    expect(r.balanceConsistent).toBe(true);
  });

  it("classifies small normal block variation as HEALTHY", () => {
    const r = classifyRpcHealth([B(100), B(101), B(102), B(101), B(103)]);
    expect(r.status).toBe("HEALTHY");
  });

  it("classifies a large backward regression as STALE_BACKENDS_DETECTED", () => {
    const r = classifyRpcHealth([B(100), B(200), B(90)]);
    expect(r.status).toBe("STALE_BACKENDS_DETECTED");
    expect(r.staleReasons.length).toBeGreaterThan(0);
  });

  it("classifies a 10 -> 0 -> 10 balance regression with a stale block as STALE_BACKENDS_DETECTED", () => {
    const r = classifyRpcHealth([
      B(20184835, BigInt(10), 1),
      B(20184907, BigInt(0), 1),
      B(20183835, BigInt(10), 1),
    ]);
    expect(r.status).toBe("STALE_BACKENDS_DETECTED");
  });

  it("reports an impossible nonce regression as stale", () => {
    const r = classifyRpcHealth([B(100, BigInt(10), 2), B(101, BigInt(10), 1)]);
    expect(r.status).toBe("STALE_BACKENDS_DETECTED");
  });

  it("flags an excessive block spread as stale", () => {
    const r = classifyRpcHealth([B(100), B(160)]);
    expect(r.status).toBe("STALE_BACKENDS_DETECTED");
  });

  it("classifies a moderate spread with no regression as DEGRADED", () => {
    const r = classifyRpcHealth([B(100), B(140)]);
    expect(r.status).toBe("DEGRADED");
  });

  it("reports consistent zero balance samples as HEALTHY (no contradiction)", () => {
    const r = classifyRpcHealth([
      B(100, BigInt(0), 0),
      B(101, BigInt(0), 0),
      B(102, BigInt(0), 0),
      B(103, BigInt(0), 0),
    ]);
    expect(r.status).toBe("HEALTHY");
    expect(r.balanceConsistent).toBe(true);
  });
});