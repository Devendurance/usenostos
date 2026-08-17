import { describe, expect, it } from "vitest";
import {
  integrationIdFor,
  metadataHashFor,
  canonicalSnapshotJson,
} from "@/lib/rwa/metadata";
import { listOpportunities } from "@/lib/rwa/opportunities";

describe("rwa metadata snapshots", () => {
  it("produces deterministic hashes for the same input", () => {
    const ousg = listOpportunities().find((o) => o.slug === "ousg")!;
    const a = metadataHashFor(ousg);
    const b = metadataHashFor(ousg);
    expect(a).toBe(b);
    expect(a).toMatch(/^0x[0-9a-f]{64}$/);
  });

  it("changes when a field changes", () => {
    const tbill = listOpportunities().find((o) => o.slug === "tbill")!;
    const before = metadataHashFor(tbill);
    const changed = { ...tbill, description: `${tbill.description} (edited)` };
    expect(metadataHashFor(changed)).not.toBe(before);
  });

  it("computes integration ids deterministically from slugs", () => {
    expect(integrationIdFor("ousg")).toBe(integrationIdFor("ousg"));
    expect(integrationIdFor("ousg")).not.toBe(integrationIdFor("tbill"));
  });

  it("serializes canonical JSON with deterministic key order", () => {
    const ousg = listOpportunities().find((o) => o.slug === "ousg")!;
    const json = canonicalSnapshotJson(ousg);
    expect(json.startsWith("{")).toBe(true);
    expect(metadataHashFor(ousg)).toBe(
      metadataHashFor(JSON.parse(json) as typeof ousg),
    );
  });
});