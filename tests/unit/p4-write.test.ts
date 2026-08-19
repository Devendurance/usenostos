import { describe, expect, it } from "vitest";
import {
  assertP4RpcHealth,
  assertSuccessfulReceipt,
} from "@/scripts/registry/p4-write";

describe("P4 transaction safety", () => {
  it("accepts successful receipts", () => {
    expect(() => assertSuccessfulReceipt({ status: "success" }, "settlement")).not.toThrow();
  });

  it("fails closed on reverted receipts", () => {
    expect(() => assertSuccessfulReceipt({ status: "reverted" }, "settlement")).toThrow(
      "P4 settlement transaction reverted",
    );
  });

  it("fails closed on inconsistent nonce or balance samples", () => {
    expect(() =>
      assertP4RpcHealth({
        status: "HEALTHY",
        nonceConsistent: false,
        balanceConsistent: true,
        staleReasons: [],
      }),
    ).toThrow("nonce samples are inconsistent");
    expect(() =>
      assertP4RpcHealth({
        status: "HEALTHY",
        nonceConsistent: true,
        balanceConsistent: false,
        staleReasons: [],
      }),
    ).toThrow("balance samples are inconsistent");
  });
});
