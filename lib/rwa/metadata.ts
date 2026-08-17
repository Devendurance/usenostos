import { keccak256, toBytes } from "viem";
import type { RwaOpportunity } from "@/lib/rwa/types";

export const INTEGRATION_ID_PREFIX = "nostos-rwa-v1:";

export function integrationIdFor(slug: string): `0x${string}` {
  return keccak256(toBytes(`${INTEGRATION_ID_PREFIX}${slug}`));
}

// Canonical serialization: stable key order, no whitespace.
export function canonicalSnapshotJson(opportunity: RwaOpportunity): string {
  return JSON.stringify(opportunity, Object.keys(opportunity).sort());
}

export function metadataHashFor(opportunity: RwaOpportunity): `0x${string}` {
  return keccak256(toBytes(canonicalSnapshotJson(opportunity)));
}

export type MetadataSnapshot = {
  slug: string;
  integrationId: `0x${string}`;
  metadataHash: `0x${string}`;
};