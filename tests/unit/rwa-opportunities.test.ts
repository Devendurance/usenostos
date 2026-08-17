import { describe, expect, it } from "vitest";
import {
  listOpportunities,
  getOpportunityBySlug,
} from "@/lib/rwa/opportunities";
import type { RwaOpportunity } from "@/lib/rwa/types";

describe("rwa opportunities", () => {
  it("contains OUSG, TBILL, and the demo vault with the right statuses", () => {
    const list = listOpportunities();
    expect(list.map((o) => o.slug).sort()).toEqual([
      "nostos-async-vault",
      "ousg",
      "tbill",
    ]);
    expect(getOpportunityBySlug("ousg")?.integrationStatus).toBe(
      "DISCOVERY_ONLY",
    );
    expect(getOpportunityBySlug("tbill")?.integrationStatus).toBe(
      "DISCOVERY_ONLY",
    );
    expect(getOpportunityBySlug("nostos-async-vault")?.integrationStatus).toBe(
      "REDEMPTION_SUPPORTED",
    );
  });

  it("resolves by slug", () => {
    expect(getOpportunityBySlug("ousg")?.issuer).toBe("Ondo Finance");
    expect(getOpportunityBySlug("tbill")?.issuer).toBe("OpenEden");
    expect(getOpportunityBySlug("nostos-async-vault")?.name).toContain(
      "Async Settlement Vault",
    );
    expect(getOpportunityBySlug("nope")).toBeUndefined();
  });

  it("never claims yield or RWA backing for the demo vault", () => {
    const demo = getOpportunityBySlug("nostos-async-vault")!;
    expect(demo.yield?.value.label).toContain("0%");
    expect(demo.backing?.value.backing).toContain("no real-world-asset backing");
    expect(demo.description).toContain("0% YIELD");
  });

  it("gives provenance to every sourced factual field", () => {
    const check = (
      o: RwaOpportunity,
      field: string,
      s: { name: string; url: string } | undefined,
    ) => {
      expect(s, `${o.slug}.${field} should have a source`).toBeDefined();
      expect(s?.name?.length, `${o.slug}.${field} source name`).toBeGreaterThan(
        0,
      );
      expect(
        s?.url?.startsWith("https://"),
        `${o.slug}.${field} source url`,
      ).toBe(true);
    };
    for (const o of listOpportunities()) {
      check(o, "networks", o.networks.source);
      check(o, "eligibility", o.eligibility.source);
      check(o, "settlement", o.settlement.source);
      if (o.fees) check(o, "fees", o.fees.source);
      if (o.backing) check(o, "backing", o.backing.source);
    }
  });
});