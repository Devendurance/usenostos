import type { RwaOpportunity } from "@/lib/rwa/types";
import { ousgOpportunity } from "./ousg";
import { tbillOpportunity } from "./tbill";

const OPPORTUNITIES: RwaOpportunity[] = [ousgOpportunity, tbillOpportunity];

export function listOpportunities(): RwaOpportunity[] {
  return OPPORTUNITIES;
}

export function getOpportunityBySlug(
  slug: string,
): RwaOpportunity | undefined {
  return OPPORTUNITIES.find((o) => o.slug === slug);
}