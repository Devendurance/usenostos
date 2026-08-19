import type { Metadata } from "next";
import { ProductPage } from "@/components/product/product-primitives";
import { DiscoveredAssetDetail } from "@/components/product/discovered-asset-detail";

export const metadata: Metadata = {
  title: "Discovered asset",
  description:
    "Review CoinMarketCap discovery data for an RWA that is not yet integrated with Nostos.",
};

export default async function DiscoveredAssetPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <ProductPage>
      <DiscoveredAssetDetail key={id} id={id} />
    </ProductPage>
  );
}
