import { describe, expect, it } from "vitest";
import { deriveEnabledReadState } from "@/lib/chain/read-state";
import { parseChainId } from "@/lib/chain/use-actual-wallet-chain";

describe("parseChainId", () => {
  it("parses hex chain ids from EIP-1193 providers", () => {
    expect(parseChainId("0x3c8")).toBe(968);
    expect(parseChainId("0x2a5")).toBe(677);
    expect(parseChainId("0x1a4")).toBe(420);
  });

  it("accepts numeric chain ids", () => {
    expect(parseChainId(968)).toBe(968);
    expect(parseChainId(42220)).toBe(42220);
  });

  it("returns null for missing or malformed values", () => {
    expect(parseChainId(undefined)).toBeNull();
    expect(parseChainId(null)).toBeNull();
    expect(parseChainId("garbage")).toBeNull();
    expect(parseChainId("0xZZZ")).toBeNull();
  });
});

describe("deriveEnabledReadState", () => {
  it("never exposes a previously cached balance while disabled (stale cache suppressed)", () => {
    expect(
      deriveEnabledReadState(false, { isFetched: true, isError: false }),
    ).toBe("idle");
  });

  it("keeps failed reads unavailable even when enabled", () => {
    expect(
      deriveEnabledReadState(true, { isError: true, isFetched: true }),
    ).toBe("unavailable");
  });

  it("shows loading while pending", () => {
    expect(
      deriveEnabledReadState(true, { isPending: true, isFetched: false }),
    ).toBe("loading");
  });

  it("is ready after a successful enabled fetch", () => {
    expect(
      deriveEnabledReadState(true, { isFetched: true, isError: false }),
    ).toBe("ready");
  });
});