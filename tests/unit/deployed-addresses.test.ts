import { describe, expect, it } from "vitest";
import {
  mergeDeployedTestnet,
  readE2eP5Fixture,
  readE2eP6Fixture,
  selectInstantPoolSurface,
} from "@/lib/chain/deployed-addresses";

const P5_POOL = "0x0000000000000000000000000000000000000303";
const P6_POOL = "0x0000000000000000000000000000000000000404";
const P4_VAULT = "0x0000000000000000000000000000000000000101";
const P4_TICKET = "0x0000000000000000000000000000000000000202";

describe("P6 deployed address fixtures", () => {
  it("ignores the P6 fixture in production", () => {
    expect(
      readE2eP6Fixture({
        NODE_ENV: "production",
        NEXT_PUBLIC_NOSTOS_E2E: "true",
        NEXT_PUBLIC_NOSTOS_E2E_P6_FIXTURE: JSON.stringify({ instantPool: P6_POOL }),
      }),
    ).toBeUndefined();
  });

  it("ignores the P6 fixture without the E2E flag", () => {
    expect(
      readE2eP6Fixture({
        NODE_ENV: "test",
        NEXT_PUBLIC_NOSTOS_E2E_P6_FIXTURE: JSON.stringify({ instantPool: P6_POOL }),
      }),
    ).toBeUndefined();
  });

  it("merges the P6 fixture independently of P5", () => {
    const persisted = {
      p5: { instantPool: P5_POOL },
    };
    const merged = mergeDeployedTestnet(persisted, {
      p4: { asyncVault: P4_VAULT, redemptionTicket: P4_TICKET },
      p6: { instantPool: P6_POOL },
    });
    expect(merged.p5?.instantPool).toBe(P5_POOL);
    expect(merged.p6?.instantPool).toBe(P6_POOL);
    expect(merged.p4?.asyncVault).toBe(P4_VAULT);
  });

  it("selects P6 over persisted or fixture P5 when both exist", () => {
    expect(
      selectInstantPoolSurface({
        p5: { instantPool: P5_POOL },
        p6: { instantPool: P6_POOL },
      }),
    ).toBe("p6");
    expect(selectInstantPoolSurface({ p5: { instantPool: P5_POOL } })).toBe("p5");
    expect(selectInstantPoolSurface({})).toBe("none");
  });

  it("still reads a P5 fixture when no P6 fixture is present", () => {
    expect(
      readE2eP5Fixture({
        NODE_ENV: "test",
        NEXT_PUBLIC_NOSTOS_E2E: "true",
        NEXT_PUBLIC_NOSTOS_E2E_P5_FIXTURE: JSON.stringify({ instantPool: P5_POOL }),
      })?.instantPool,
    ).toBe(P5_POOL);
  });
});
