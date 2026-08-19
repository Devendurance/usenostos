import { getCatalog } from "@/lib/rwa/discovery/catalog";
import { parseCatalogQuery } from "@/lib/rwa/discovery/query";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = parseCatalogQuery(url.searchParams);
  if (!parsed.ok) {
    return Response.json({ error: parsed.error }, { status: 400 });
  }
  const result = await getCatalog(parsed.query);
  return Response.json(result);
}
