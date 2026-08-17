import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { listOpportunities } from "../lib/rwa/opportunities";
import {
  canonicalSnapshotJson,
  integrationIdFor,
  metadataHashFor,
} from "../lib/rwa/metadata";
import { loadScriptEnv } from "./load-script-env";

loadScriptEnv();

const outDir = join(process.cwd(), "contracts", "addresses", "snapshots");

async function main() {
  mkdirSync(outDir, { recursive: true });
  for (const opportunity of listOpportunities()) {
    const integrationId = integrationIdFor(opportunity.slug);
    const metadataHash = metadataHashFor(opportunity);
    console.log(`[${opportunity.slug}]`);
    console.log(`  integrationId: ${integrationId}`);
    console.log(`  metadataHash:  ${metadataHash}`);
    if (process.env.P2_WRITE_SNAPSHOTS === "true") {
      const file = join(outDir, `${opportunity.slug}.json`);
      writeFileSync(file, canonicalSnapshotJson(opportunity));
      console.log(`  wrote ${file}`);
    }
  }
  console.log(
    "\nSnapshots hash-anchor only. Register on BOT Testnet 968 with the deploy/register scripts when explicitly authorized.",
  );
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});