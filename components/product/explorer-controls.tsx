"use client";

import { useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import type { RwaOpportunity } from "@/lib/rwa/types";
import { filterOpportunities, sortOpportunities } from "@/lib/rwa/display";
import { OpportunityCard } from "@/components/product/opportunity-card";

const categories = ["All", "Treasuries"] as const;
const sorts = ["name"] as const;

export function ExplorerControls({
  opportunities,
}: {
  opportunities: RwaOpportunity[];
}) {
  const [category, setCategory] =
    useState<(typeof categories)[number]>("All");
  const [sort, setSort] = useState<(typeof sorts)[number]>("name");
  const filtered = filterOpportunities(opportunities, category);
  const sorted = sortOpportunities(filtered, sort);

  return (
    <div>
      <div className="flex flex-col gap-4 border-y border-[var(--line)] py-5 lg:flex-row lg:items-end lg:justify-between">
        <fieldset>
          <legend className="eyebrow mb-3 text-muted-foreground">
            Asset category
          </legend>
          <div className="flex flex-wrap gap-2">
            {categories.map((item) => (
              <button
                key={item}
                type="button"
                aria-pressed={category === item}
                onClick={() => setCategory(item)}
                className={`min-h-11 rounded-full border px-4 text-sm font-semibold transition-colors ${
                  category === item
                    ? "border-[var(--ink)] bg-[var(--ink)] text-white"
                    : "border-[var(--line-strong)] bg-white hover:border-[var(--ink)]"
                }`}
              >
                {item}
              </button>
            ))}
          </div>
        </fieldset>
        <label className="flex min-w-56 flex-col gap-2 text-sm font-semibold">
          Sort by
          <select
            value={sort}
            onChange={(event) =>
              setSort(event.target.value as (typeof sorts)[number])
            }
            className="min-h-12 rounded-control border border-[var(--ink)] bg-white px-4 text-sm focus-visible:ring-2 focus-visible:ring-[var(--lilac)]"
          >
            {sorts.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="pt-6" aria-live="polite">
        <p className="mb-4 text-xs text-muted-foreground">
          Showing {category.toLowerCase()} · ordered by {sort.toLowerCase()}
        </p>
        {sorted.length === 0 ? (
          <div className="rounded-control border border-[var(--line)] p-8 text-center text-sm text-muted-foreground">
            <SlidersHorizontal
              size={18}
              className="mx-auto mb-2"
              aria-hidden="true"
            />
            No opportunities match this filter.
          </div>
        ) : (
          <div className="grid gap-5 md:grid-cols-2">
            {sorted.map((opportunity) => (
              <OpportunityCard
                key={opportunity.id}
                opportunity={opportunity}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}