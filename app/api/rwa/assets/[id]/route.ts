import { getCatalogAsset } from "@/lib/rwa/discovery/catalog";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const result = await getCatalogAsset(id);
  if (!result) {
    return Response.json({ error: "Asset not found" }, { status: 404 });
  }
  return Response.json(result);
}
