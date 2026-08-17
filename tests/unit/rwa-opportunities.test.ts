import { describe, expect, it } from "vitest";
import {
  listOpportunities,
  getOpportunityBySlug,
} from "@/lib/rwa/opportunities";
import type { RwaOpportunity } from "@/lib/rwa/types";

describe("rwa opportunities", () => {
  it("contains exactly OUSG and TBILL, both DISCOVERY_ONLY", () => {
    const list = listOpportunities();
    expect(list.map((o) => o.slug).sort()).toEqual(["ousg", "tbill"]);
    for (const o of list) expect(o.integrationStatus).toBe("DISCOVERY_ONLY");
  });

  it("resolves by slug", () => {
    expect(getOpportunityBySlug("ousg")?.issuer).toBe("Ondo Finance");
    expect(getOpportunityBySlug("tbill")?.issuer).toBe("OpenEden");
    expect(getOpportunityBySlug("nope")).toBeUndefined();
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