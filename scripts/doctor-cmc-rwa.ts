import { loadScriptEnv } from "./load-script-env";
import {
  CmcClientError,
  cmcGet,
  getCoinMarketCapApiKey,
} from "../lib/rwa/discovery/providers/cmc-client";
import { asString, extractIssuers, extractRwaAssets } from "../lib/rwa/discovery/normalize";

loadScriptEnv();

type ProbeStatus = "AVAILABLE" | "PLAN_RESTRICTED" | "AUTH_FAILED" | "RATE_LIMITED" | "ERROR";

function classify(error: unknown): ProbeStatus {
  if (error instanceof CmcClientError) {
    if (error.code === "AUTH_FAILED") return "AUTH_FAILED";
    if (error.code === "RATE_LIMITED") return "RATE_LIMITED";
    if (error.code === "PLAN_RESTRICTED") return "PLAN_RESTRICTED";
  }
  return "ERROR";
}

function pad(label: string): string {
  return label.padEnd(22, " ");
}

async function probe(
  label: string,
  path: string,
  params: Record<string, string | number | undefined>,
): Promise<{ status: ProbeStatus; data?: unknown }> {
  try {
    const result = await cmcGet(path, params);
    console.log(`${pad(label)}AVAILABLE`);
    return { status: "AVAILABLE", data: result.data };
  } catch (error) {
    const status = classify(error);
    console.log(`${pad(label)}${status}`);
    return { status };
  }
}

async function main() {
  console.log("CMC RWA PROVIDER");
  const key = getCoinMarketCapApiKey();
  if (!key) {
    console.log("Provider: UNAVAILABLE");
    console.log("reason: API key is not configured");
    process.exit(1);
  }

  const map = await probe("map", "/v5/real-world-assets/map", { limit: 1 });
  const firstId = asString(extractRwaAssets(map.data)[0]?.rwa_id);

  const list = await probe("assets/list", "/v5/real-world-assets/assets/list", { limit: 1 });
  const info = firstId
    ? await probe("info", "/v5/real-world-assets/info", { rwa_id: firstId })
    : { status: "ERROR" as const };
  const quotes = firstId
    ? await probe("quotes/latest", "/v5/real-world-assets/quotes/latest", { rwa_id: firstId })
    : { status: "ERROR" as const };

  const issuersList = await probe("issuers/list", "/v5/real-world-assets/issuers/list", {
    limit: 1,
  });
  const issuerId = asString(extractIssuers(issuersList.data)[0]?.issuer_id);
  if (issuerId) {
    await probe("issuers", "/v5/real-world-assets/issuers", { issuer_id: issuerId, limit: 1 });
  }
  await probe("market-pairs/list (optional)", "/v5/real-world-assets/market-pairs/list", {
    rwa_id: firstId ?? "1",
    limit: 1,
  });

  const statuses = [map.status, list.status, info.status, quotes.status, issuersList.status];
  if (statuses.includes("AUTH_FAILED")) {
    console.log("\nProvider: AUTH_FAILED");
    process.exit(1);
  }
  if (statuses.includes("RATE_LIMITED") && map.status !== "AVAILABLE") {
    console.log("\nProvider: RATE_LIMITED");
    process.exit(1);
  }

  const requiredMap = map.status === "AVAILABLE";
  const requiredMeta = list.status === "AVAILABLE" || info.status === "AVAILABLE";
  const quotesOk = quotes.status === "AVAILABLE";
  if (requiredMap && requiredMeta && quotesOk) {
    console.log("\nProvider: READY");
    process.exit(0);
  }
  if (requiredMap || requiredMeta) {
    console.log("\nProvider: PARTIAL");
    process.exit(0);
  }
  console.log("\nProvider: UNAVAILABLE");
  process.exit(1);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.log("OVERALL: ERROR");
  console.log(message);
  process.exit(1);
});
