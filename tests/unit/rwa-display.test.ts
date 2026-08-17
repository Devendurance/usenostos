import { describe, expect, it } from "vitest";
import {
  displaySourced,
  NOT_REPORTED,
  canDeposit,
  canRedeem,
  filterOpportunities,
  sortOpportunities,
} from "@/lib/rwa/display";
import type { RwaOpportunity } from "@/lib/rwa/types";

const opp = {
  id: "tbill",
  slug: "tbill",
  issuer: "OpenEden",
  name: "TBILL",
  category: "Treasuries",
  integrationStatus: "DISCOVERY_ONLY",
  networks: {
    value: ["Ethereum"],
    source: {
      name: "OpenEden docs",
      url: "https://docs.openeden.com/tbill/smart-contract-addresses",
      type: "issuer_docs",
      retrievedAt: "2026-08-17",
    },
  },
} as unknown as RwaOpportunity;

describe("rwa display rules", () => {
  it("renders Not reported when a sourced value is absent", () => {
    expect(displaySourced(undefined)).toBe(NOT_REPORTED);
    expect(displaySourced(null)).toBe(NOT_REPORTED);
  });

  it("renders the value when present", () => {
    expect(
      displaySourced({
        value: "0.15%",
        source: { name: "x", url: "u", type: "issuer" },
      }),
    ).toBe("0.15%");
  });

  it("never shows a missing yield as zero", () => {
    expect(displaySourced(undefined)).not.toBe("0%");
  });

  it("blocks deposit and redeem for discovery-only products", () => {
    expect(canDeposit(opp)).toBe(false);
    expect(canRedeem(opp)).toBe(false);
  });

  it("filters operate on real category fields only", () => {
    expect(filterOpportunities([opp], "Treasuries")).toHaveLength(1);
    expect(filterOpportunities([opp], "Private Credit")).toHaveLength(0);
  });

  it("sorting never orders missing yields as zero", () => {
    const sorted = sortOpportunities(
      [opp, { ...opp, name: "OUSG" }],
      "name",
    );
    expect(sorted.map((o) => o.name)).toEqual(["OUSG", "TBILL"]);
  });
});