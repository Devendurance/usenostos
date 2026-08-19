export type CuratedMapping = {
  slug: "ousg" | "tbill";
  slugs: string[];
  issuerNameNeedles: string[];
  rwaIds: string[];
};

export const CURATED_MAPPINGS: CuratedMapping[] = [
  {
    slug: "ousg",
    slugs: ["ousg"],
    issuerNameNeedles: ["Ondo"],
    rwaIds: [],
  },
  {
    slug: "tbill",
    slugs: ["tbill"],
    issuerNameNeedles: ["OpenEden"],
    rwaIds: [],
  },
];

export function matchCuratedMapping(input: {
  providerAssetId?: string | null;
  slug?: string | null;
  symbol?: string | null;
  issuerName?: string | null;
}): CuratedMapping | null {
  for (const mapping of CURATED_MAPPINGS) {
    const id = input.providerAssetId ? String(input.providerAssetId) : null;
    if (id && mapping.rwaIds.includes(id)) return mapping;

    const slug = (input.slug ?? "").toLowerCase();
    const slugMatches = mapping.slugs.some((value) => value.toLowerCase() === slug);
    const issuerName = input.issuerName ?? "";
    const issuerMatches = mapping.issuerNameNeedles.some((needle) =>
      issuerName.toLowerCase().includes(needle.toLowerCase()),
    );
    if (slugMatches && issuerMatches) return mapping;
  }
  return null;
}
