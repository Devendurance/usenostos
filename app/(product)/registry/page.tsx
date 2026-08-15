import type { Metadata } from "next";
import { RegistrySearch } from "@/components/product/registry-search";
import { DataPanel, ProductPage, TableEmpty } from "@/components/product/product-primitives";
import { PageHeading } from "@/components/ui/page-heading";

export const metadata: Metadata = { title: "Registry", description: "Look up public Nostos vault, redemption, and settlement records." };

export default function RegistryPage() {
  return <ProductPage><PageHeading eyebrow="Nostos Registry" title="Settlement should leave a record." description="Search the future public record layer for vaults, requests, claims, and cashouts without relying on a private status page." /><DataPanel className="mt-8" title="Search public records" description="No chain or indexer request is made in this UI phase."><RegistrySearch /></DataPanel><DataPanel className="mt-6" title="Recent records" description="Only verified records from the registry will appear in this table."><TableEmpty columns={["Record", "Vault", "Path", "State", "Transaction"]} title="No records loaded" message="The registry adapter is pending. The interface does not create sample settlement records." /></DataPanel></ProductPage>;
}
