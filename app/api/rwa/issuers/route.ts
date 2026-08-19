import { getCatalogIssuers } from "@/lib/rwa/discovery/catalog";

export const dynamic = "force-dynamic";

export async function GET() {
  const result = await getCatalogIssuers();
  return Response.json(result);
}
