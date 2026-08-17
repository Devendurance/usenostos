import type { RwaOpportunity } from "@/lib/rwa/types";
import { ousgOpportunity } from "./ousg";
import { tbillOpportunity } from "./tbill";
import { demoVaultOpportunity } from "./demo-vault";

const OPPORTUNITIES: RwaOpportunity[] = [
  ousgOpportunity,
  tbillOpportunity,
  demoVaultOpportunity,
];

export function listOpportunities(): RwaOpportunity[] {
  return OPPORTUNITIES;
}

export function getOpportunityBySlug(
  slug: string,
): RwaOpportunity | undefined {
  return OPPORTUNITIES.find((o) => o.slug === slug);
}

export { demoVaultOpportunity };