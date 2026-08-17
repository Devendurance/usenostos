import type {
  RwaOpportunity,
  SourcedValue,
  SourceReference,
} from "@/lib/rwa/types";

export const NOT_REPORTED = "Not reported";

export function displaySourced<T>(
  sourced: SourcedValue<T> | undefined | null,
): string {
  if (!sourced) return NOT_REPORTED;
  const value = Array.isArray(sourced.value)
    ? sourced.value.join(", ")
    : String(sourced.value);
  return value;
}

export function sourceAffordance(source: SourceReference): {
  label: string;
  href: string;
  asOf: string | null;
} {
  const asOf = source.asOf ?? source.retrievedAt ?? null;
  return { label: source.name, href: source.url, asOf };
}

export function canDeposit(opportunity: RwaOpportunity): boolean {
  return (
    opportunity.integrationStatus === "DEPOSIT_SUPPORTED" ||
    opportunity.integrationStatus === "PAUSED"
  );
}

export function canRedeem(opportunity: RwaOpportunity): boolean {
  return (
    opportunity.integrationStatus === "REDEMPTION_SUPPORTED" ||
    opportunity.integrationStatus === "INSTANT_LIQUIDITY_SUPPORTED" ||
    opportunity.integrationStatus === "PAUSED"
  );
}

export type SortKey = "name";

export function sortOpportunities<T extends Pick<RwaOpportunity, "name">>(
  list: T[],
  sort: SortKey,
): T[] {
  const copy = [...list];
  if (sort === "name") copy.sort((a, b) => a.name.localeCompare(b.name));
  return copy;
}

export function filterOpportunities(
  list: RwaOpportunity[],
  category: string,
): RwaOpportunity[] {
  if (!category || category === "All") return list;
  return list.filter((o) => o.category === category);
}