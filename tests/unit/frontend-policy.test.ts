import { describe, expect, it } from "vitest";
import {
  FRONTEND_POLICY,
  isFrontendUsableChain,
  resolveFrontendEnvironment,
} from "@/lib/chain/frontend-policy";
import { deriveReadState } from "@/lib/chain/read-state";

describe("frontend environment policy", () => {
  it("requires BOT Testnet chain 968", () => {
    expect(FRONTEND_POLICY.environment).toBe("testnet");
    expect(FRONTEND_POLICY.requiredChainId).toBe(968);
    expect(FRONTEND_POLICY.writesEnabled).toBe(false);
  });

  it("rejects 677 for active P1 use", () => {
    expect(isFrontendUsableChain(677)).toBe(false);
    expect(isFrontendUsableChain(1)).toBe(false);
    expect(isFrontendUsableChain(968)).toBe(true);
  });

  it("never enables mainnet from any env value, including an explicit mainnet value", () => {
    expect(resolveFrontendEnvironment(undefined).environment).toBe("testnet");
    expect(resolveFrontendEnvironment("").environment).toBe("testnet");
    expect(resolveFrontendEnvironment("garbage").environment).toBe("testnet");
    expect(resolveFrontendEnvironment("mainnet").environment).toBe("testnet");
    expect(resolveFrontendEnvironment("testnet").environment).toBe("testnet");
  });
});

describe("read-state derivation", () => {
  it("never turns a failed read into a ready zero", () => {
    expect(deriveReadState({ isError: true, isFetched: true })).toBe(
      "unavailable",
    );
  });

  it("shows loading while pending and not yet fetched", () => {
    expect(deriveReadState({ isPending: true, isFetched: false })).toBe(
      "loading",
    );
  });

  it("is idle when not enabled", () => {
    expect(deriveReadState({ isPending: false, isFetched: false })).toBe(
      "idle",
    );
  });

  it("is ready after a successful fetch (including a real zero result)", () => {
    expect(
      deriveReadState({ isPending: false, isFetched: true, isError: false }),
    ).toBe("ready");
  });
});