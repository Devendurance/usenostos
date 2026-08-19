import type {
  CatalogDir,
  CatalogIntegration,
  CatalogQuery,
  CatalogSort,
} from "./types";

const SORTS: CatalogSort[] = ["name", "marketCap", "volume", "rank"];
const DIRS: CatalogDir[] = ["asc", "desc"];
const INTEGRATIONS: CatalogIntegration[] = ["all", "discovered", "integrated"];

export const DEFAULT_CATALOG_LIMIT = 20;
export const MAX_CATALOG_LIMIT = 50;

export type ParsedQuery =
  | { ok: true; query: CatalogQuery }
  | { ok: false; error: string };

function isPositiveIntString(raw: string): boolean {
  return /^[1-9]\d*$/.test(raw);
}

function readOptionalString(value: string | null): string | undefined {
  if (value == null) return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function parseCatalogQuery(
  searchParams: URLSearchParams,
): ParsedQuery {
  const q = readOptionalString(searchParams.get("q"));
  const assetClass = readOptionalString(searchParams.get("assetClass"));
  const issuer = readOptionalString(searchParams.get("issuer"));

  const sortRaw = searchParams.get("sort");
  if (sortRaw != null && sortRaw !== "" && !SORTS.includes(sortRaw as CatalogSort)) {
    return { ok: false, error: "Invalid sort" };
  }
  const sort = (sortRaw as CatalogSort | null) || "name";

  const dirRaw = searchParams.get("dir");
  if (dirRaw != null && dirRaw !== "" && !DIRS.includes(dirRaw as CatalogDir)) {
    return { ok: false, error: "Invalid dir" };
  }
  const dir = (dirRaw as CatalogDir | null) || "asc";

  const integrationRaw = searchParams.get("integration");
  if (
    integrationRaw != null &&
    integrationRaw !== "" &&
    !INTEGRATIONS.includes(integrationRaw as CatalogIntegration)
  ) {
    return { ok: false, error: "Invalid integration" };
  }
  const integration =
    (integrationRaw as CatalogIntegration | null) || "all";

  const pageRaw = searchParams.get("page");
  if (pageRaw != null && pageRaw !== "" && !isPositiveIntString(pageRaw)) {
    return { ok: false, error: "Invalid page" };
  }
  const page = pageRaw ? Number(pageRaw) : 1;

  const limitRaw = searchParams.get("limit");
  if (limitRaw != null && limitRaw !== "" && !isPositiveIntString(limitRaw)) {
    return { ok: false, error: "Invalid limit" };
  }
  const requestedLimit = limitRaw ? Number(limitRaw) : DEFAULT_CATALOG_LIMIT;
  const limit = Math.min(requestedLimit, MAX_CATALOG_LIMIT);

  return {
    ok: true,
    query: { q, assetClass, issuer, sort, dir, integration, page, limit },
  };
}

export function matchesSearch(haystacks: Array<string | null | undefined>, q?: string): boolean {
  if (!q) return true;
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  return haystacks.some((value) => (value ?? "").toLowerCase().includes(needle));
}
