# P2 Real RWA Discovery + Registry Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn Explore + Vault Detail into a truthful, source-backed RWA discovery surface for OUSG (Ondo) and TBILL (OpenEden) — both `DISCOVERY_ONLY` — and add a minimal, auditable Nostos Registry contract on BOT Testnet with deterministic metadata hashes and safe deployment tooling.

**Architecture:** A `lib/rwa/` domain layer holds the normalized model, display rules, and two source-backed records with field-level provenance; the Explore and Vault Detail routes render them with `Not reported` for missing dynamic values. A Foundry `contracts/` workspace adds `NostosRegistry.sol` (OpenZeppelin Ownable2Step) that anchors integration status + metadata hashes only (never financial values). `tsx`+Viem scripts build canonical snapshots, deploy on BOT Testnet 968 only, and register discovery-only records with zero vault. No auto-deploys.

**Tech Stack:** Next.js 16.3.1, TypeScript, Vitest, Playwright, Foundry (forge/anvil), OpenZeppelin v5, Viem.

## Global Constraints

- Do NOT redesign UI; do NOT begin P3.
- OUSG and TBILL are `DISCOVERY_ONLY`; never expose Deposit/Redeem/Approve/Instant Cashout for them.
- Only official issuer sources (Ondo docs/addresses, OpenEden docs) become data authority; no aggregator scrapers; no invented APY/TVL/NAV/risk scores.
- Missing dynamic values render `Not reported`; failed/source-less reads never become zero.
- Registry stores integration status + metadata hash only - never APY/TVL/NAV/health.
- `nostosVault` is zero for discovery-only records.
- Deployment/registration target BOT Testnet 968 only; refuse 677; explicit write opt-in; never print keys; do not auto-deploy.
- Preserve P0/P0.5/P1 behavior and diagnostics. Keep changes uncommitted at the end.

## Official sources used (retrieved 2026-08-17)

- Ondo docs OUSG overview: https://docs.ondo.finance/qualified-access-products/ousg/overview
- Ondo docs OUSG instant limits: https://docs.ondo.finance/qualified-access-products/ousg/instant-limits
- Ondo docs smart contract addresses: https://docs.ondo.finance/addresses.md
- OpenEden docs TBILL introduction: https://docs.openeden.com/tbill/introduction
- OpenEden docs TBILL redemptions: https://docs.openeden.com/tbill/redemptions
- OpenEden docs TBILL smart contract addresses: https://docs.openeden.com/tbill/smart-contract-addresses

---

### Task 1: Initialize The Foundry Workspace

**Files:**
- Create: `contracts/foundry.toml`, `contracts/remappings.txt`, `contracts/src/.gitkeep`, `contracts/test/.gitkeep`
- Create: `contracts/script/DeployNostosRegistry.s.sol`

**Interfaces:**
- Produces: a compile/testable Foundry project inside the repo (no nested git repo), with OpenZeppelin v5.

- [ ] **Step 1: Create `contracts/foundry.toml`**

```toml
[profile.default]
src = "src"
out = "out"
libs = ["lib"]
test = "test"
script = "script"
solc_version = "0.8.24"
evm_version = "paris"
optimizer = true
optimizer_runs = 200
```

- [ ] **Step 2: Install OpenZeppelin**

Run from `contracts/`:

```bash
forge install OpenZeppelin/openzeppelin-contracts@v5.3.0
```

Expected: `contracts/lib/openzeppelin-contracts` exists.

- [ ] **Step 3: Create `contracts/remappings.txt`**

```text
@openzeppelin/contracts/=lib/openzeppelin-contracts/contracts/
```

- [ ] **Step 4: Create `contracts/script/DeployNostosRegistry.s.sol`**

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {NostosRegistry} from "../src/NostosRegistry.sol";

contract DeployNostosRegistry is Script {
    function run() external returns (NostosRegistry registry) {
        address deployer = vm.addr(vm.envUint("BOT_TESTNET_PRIVATE_KEY"));
        vm.startBroadcast();
        registry = new NostosRegistry(deployer);
        vm.stopBroadcast();
        console2.log("registry", address(registry));
    }
}
```

Note: `forge-std` is provided by the Foundry install; if not present, run `forge install foundry-rs/forge-std` first. Implement `NostosRegistry.sol` in Task 7 before compiling.

- [ ] **Step 5: Verify forge is functional**

Run: `forge --version` (from `contracts/`). Expected: version prints.

### Task 2: RWA Domain Model And Display Rules

**Files:**
- Create: `lib/rwa/types.ts`
- Create: `lib/rwa/display.ts`
- Create: `tests/unit/rwa-display.test.ts`

**Interfaces:**
- Produces: `SourceReference`, `SourcedValue<T>`, `IntegrationStatus`, `YieldMetric`, `MoneyMetric`, `SettlementTerms`, `FeeTerms`, `BackingTerms`, `RwaOpportunity`; display helpers `displaySourced(optional)` -> value string, `sourceAffordance(source)` -> `{ label, href, asOf }`, `NOT_REPORTED`, `canDeposit`, `canRedeem`, `sortOpportunities`, `filterOpportunities`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import {
  displaySourced,
  NOT_REPORTED,
  canDeposit,
  canRedeem,
  filterOpportunities,
  sortOpportunities,
} from "@/lib/rwa/display";
import type { RwaOpportunity } from "@/lib/rwa/types";

const opp = {
  id: "tbill",
  slug: "tbill",
  issuer: "OpenEden",
  name: "TBILL",
  category: "Treasuries",
  integrationStatus: "DISCOVERY_ONLY",
  networks: { value: ["Ethereum"], source: { name: "OpenEden docs", url: "https://docs.openeden.com/tbill/smart-contract-addresses", type: "issuer_docs", retrievedAt: "2026-08-17" } },
} as unknown as RwaOpportunity;

describe("rwa display rules", () => {
  it("renders Not reported when a sourced value is absent", () => {
    expect(displaySourced(undefined)).toBe(NOT_REPORTED);
    expect(displaySourced(null)).toBe(NOT_REPORTED);
  });

  it("renders the value when present", () => {
    expect(displaySourced({ value: "0.15%", source: { name: "x", url: "u", type: "issuer" } })).toBe("0.15%");
  });

  it("never shows a missing yield as zero", () => {
    expect(displaySourced(undefined)).not.toBe("0%");
  });

  it("blocks deposit and redeem for discovery-only products", () => {
    expect(canDeposit(opp)).toBe(false);
    expect(canRedeem(opp)).toBe(false);
  });

  it("filters operate on real category fields only", () => {
    expect(filterOpportunities([opp], "Treasuries")).toHaveLength(1);
    expect(filterOpportunities([opp], "Private Credit")).toHaveLength(0);
  });

  it("sorting never orders missing yields as zero", () => {
    const sorted = sortOpportunities([opp, { ...opp, name: "OUSG" }], "name");
    expect(sorted.map((o) => o.name)).toEqual(["OUSG", "TBILL"]);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/unit/rwa-display.test.ts`. Expected: FAIL (modules missing).

- [ ] **Step 3: Implement `lib/rwa/types.ts`**

```ts
export type SourceReference = {
  name: string;
  url: string;
  type: "issuer" | "issuer_docs" | "onchain" | "oracle" | "aggregator";
  retrievedAt?: string;
  asOf?: string;
};

export type SourcedValue<T> = {
  value: T;
  source: SourceReference;
};

export type IntegrationStatus =
  | "DISCOVERY_ONLY"
  | "DEPOSIT_SUPPORTED"
  | "REDEMPTION_SUPPORTED"
  | "INSTANT_LIQUIDITY_SUPPORTED"
  | "PAUSED";

export type YieldMetric = { label: string; description?: string };
export type MoneyMetric = { value: string; currency: string };

export type SettlementTerms = {
  subscription: string;
  redemption: string;
  processing: string;
  minimums: string;
};

export type FeeTerms = { management?: string; notes?: string };
export type BackingTerms = { backing: string; custody?: string; rating?: string };

export type RwaOpportunity = {
  id: string;
  slug: string;
  issuer: string;
  name: string;
  symbol?: string;
  category: string;
  description?: string;
  networks: SourcedValue<string[]>;
  eligibility: SourcedValue<string>;
  yield?: SourcedValue<YieldMetric>;
  tvlOrAum?: SourcedValue<MoneyMetric>;
  settlement: SourcedValue<SettlementTerms>;
  fees?: SourcedValue<FeeTerms>;
  backing?: SourcedValue<BackingTerms>;
  integrationStatus: IntegrationStatus;
};
```

- [ ] **Step 4: Implement `lib/rwa/display.ts`**

```ts
import type { RwaOpportunity, SourceReference } from "@/lib/rwa/types";

export const NOT_REPORTED = "Not reported";

export function displaySourced<T>(sourced: SourcedValue<T> | undefined | null): string {
  if (!sourced) return NOT_REPORTED;
  const value = Array.isArray(sourced.value) ? sourced.value.join(", ") : String(sourced.value);
  return value;
}

export function sourceAffordance(source: SourceReference): { label: string; href: string; asOf: string | null } {
  const asOf = source.asOf ?? source.retrievedAt ?? null;
  return { label: source.name, href: source.url, asOf };
}

export function canDeposit(opportunity: RwaOpportunity): boolean {
  return (
    opportunity.integrationStatus === "DEPOSIT_SUPPORTED" ||
    opportunity.integrationStatus === "PAUSED"
  );
}

export function canRedeem(opportunity: RwaOpportunity): boolean {
  return (
    opportunity.integrationStatus === "REDEMPTION_SUPPORTED" ||
    opportunity.integrationStatus === "INSTANT_LIQUIDITY_SUPPORTED" ||
    opportunity.integrationStatus === "PAUSED"
  );
}

export type SortKey = "name";

export function sortOpportunities<T extends Pick<RwaOpportunity, "name">>(list: T[], sort: SortKey): T[] {
  const copy = [...list];
  if (sort === "name") copy.sort((a, b) => a.name.localeCompare(b.name));
  return copy;
}

export function filterOpportunities(list: RwaOpportunity[], category: string): RwaOpportunity[] {
  if (!category || category === "All") return list;
  return list.filter((o) => o.category === category);
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run tests/unit/rwa-display.test.ts`. Expected: PASS.

- [ ] **Step 6: Verify types and lint**

Run: `npx tsc --noEmit` and `npm run lint`. Expected: both exit 0.

### Task 3: OUSG And TBILL Source-Backed Records

**Files:**
- Create: `lib/rwa/opportunities/ousg.ts`
- Create: `lib/rwa/opportunities/tbill.ts`
- Create: `lib/rwa/opportunities/index.ts`
- Create: `tests/unit/rwa-opportunities.test.ts`

**Interfaces:**
- Produces: `ousgOpportunity`, `tbillOpportunity`, `listOpportunities()`, `getOpportunityBySlug(slug)`; field-level provenance on every sourced fact.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { listOpportunities, getOpportunityBySlug } from "@/lib/rwa/opportunities";
import type { RwaOpportunity } from "@/lib/rwa/types";

describe("rwa opportunities", () => {
  it("contains exactly OUSG and TBILL, both DISCOVERY_ONLY", () => {
    const list = listOpportunities();
    expect(list.map((o) => o.slug).sort()).toEqual(["ousg", "tbill"]);
    for (const o of list) expect(o.integrationStatus).toBe("DISCOVERY_ONLY");
  });

  it("resolves by slug", () => {
    expect(getOpportunityBySlug("ousg")?.issuer).toBe("Ondo Finance");
    expect(getOpportunityBySlug("tbill")?.issuer).toBe("OpenEden");
    expect(getOpportunityBySlug("nope")).toBeUndefined();
  });

  it("gives provenance to every sourced factual field", () => {
    const check = (o: RwaOpportunity, field: string, s: { name: string; url: string } | undefined) => {
      expect(s, `${o.slug}.${field} should have a source`).toBeDefined();
      expect(s?.name?.length, `${o.slug}.${field} source name`).toBeGreaterThan(0);
      expect(s?.url?.startsWith("https://"), `${o.slug}.${field} source url`).toBe(true);
    };
    for (const o of listOpportunities()) {
      check(o, "networks", o.networks.source);
      check(o, "eligibility", o.eligibility.source);
      check(o, "settlement", o.settlement.source);
      if (o.fees) check(o, "fees", o.fees.source);
      if (o.backing) check(o, "backing", o.backing.source);
    }
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/unit/rwa-opportunities.test.ts`. Expected: FAIL.

- [ ] **Step 3: Create `lib/rwa/opportunities/ousg.ts`**

```ts
import type { RwaOpportunity } from "@/lib/rwa/types";

export const ousgOpportunity: RwaOpportunity = {
  id: "ousg",
  slug: "ousg",
  issuer: "Ondo Finance",
  name: "OUSG",
  symbol: "OUSG",
  category: "Treasuries",
  description:
    "Ondo Short-Term US Government Treasuries (OUSG): tokenized exposure primarily to short-term US Treasuries and GSE securities, with 24/7 tokenized subscription and redemption.",
  networks: {
    value: ["Ethereum", "Polygon", "Solana", "XRP Ledger"],
    source: {
      name: "Ondo smart contract addresses",
      url: "https://docs.ondo.finance/addresses.md",
      type: "issuer_docs",
      retrievedAt: "2026-08-17",
    },
  },
  eligibility: {
    value:
      "Qualified Access: onboarding and KYC required; only investors eligible for Ondo Qualified Access Funds may invest. OUSG is not available from BOT Chain in Nostos.",
    source: {
      name: "Ondo OUSG overview",
      url: "https://docs.ondo.finance/qualified-access-products/ousg/overview",
      type: "issuer_docs",
      retrievedAt: "2026-08-17",
    },
  },
  yield: {
    value: {
      label: "Yield methodology",
      description:
        "NAV per token is updated at the end of each business day based on underlying performance; the OUSG Price Oracle is updated onchain with that NAV. Current yield is not reported by Nostos.",
    },
    source: {
      name: "Ondo OUSG overview",
      url: "https://docs.ondo.finance/qualified-access-products/ousg/overview",
      type: "issuer_docs",
      retrievedAt: "2026-08-17",
    },
  },
  settlement: {
    value: {
      subscription: "Instant minting via USDC/PYUSD (24/7) subject to daily limits; non-instant requests supported.",
      redemption: "Instant redemption to USDC (24/7) subject to daily limits; non-instant redemption available.",
      processing: "Instant transactions settle immediately; NAV updates end of each business day.",
      minimums:
        "Instant: USD 5,000 minimum (mint and redeem). Non-instant: USD 100,000 investment minimum, USD 50,000 redemption minimum.",
    },
    source: {
      name: "Ondo OUSG overview + instant limits",
      url: "https://docs.ondo.finance/qualified-access-products/ousg/instant-limits",
      type: "issuer_docs",
      retrievedAt: "2026-08-17",
    },
  },
  fees: {
    value: {
      management: "0.15% management fee (waived until January 1, 2027).",
      notes: "Instant minting/redemption limited to USD 50M global and USD 25M per investor within 24 hours.",
    },
    source: {
      name: "Ondo OUSG overview",
      url: "https://docs.ondo.finance/qualified-access-products/ousg/overview",
      type: "issuer_docs",
      retrievedAt: "2026-08-17",
    },
  },
  backing: {
    value: {
      backing:
        "Short-term US Treasuries, GSE securities, and funds issued by asset managers (e.g., BlackRock, Franklin Templeton, WisdomTree, Fidelity), plus bank deposits and USDC for liquidity.",
      custody: "Coinbase Prime custodian account (OUSG.eth) for USDC flows.",
      rating: undefined,
    },
    source: {
      name: "Ondo OUSG overview + addresses",
      url: "https://docs.ondo.finance/addresses.md",
      type: "issuer_docs",
      retrievedAt: "2026-08-17",
    },
  },
  integrationStatus: "DISCOVERY_ONLY",
};
```

- [ ] **Step 4: Create `lib/rwa/opportunities/tbill.ts`**

```ts
import type { RwaOpportunity } from "@/lib/rwa/types";

export const tbillOpportunity: RwaOpportunity = {
  id: "tbill",
  slug: "tbill",
  issuer: "OpenEden",
  name: "TBILL",
  symbol: "TBILL",
  category: "Treasuries",
  description:
    "OpenEden TBILL: tokenized exposure to a pool of short-dated US Treasury Bills, backed 1:1 by US T-Bills and a small portion of USD, with on-chain subscription and redemption via the TBILL Vault.",
  networks: {
    value: ["Ethereum", "BNB Smart Chain", "Arbitrum"],
    source: {
      name: "OpenEden smart contract addresses",
      url: "https://docs.openeden.com/tbill/smart-contract-addresses",
      type: "issuer_docs",
      retrievedAt: "2026-08-17",
    },
  },
  eligibility: {
    value:
      "Whitelisted participation: investors must complete onboarding; only whitelisted wallet addresses may subscribe or redeem, and TBILL transfers are limited to whitelisted addresses.",
    source: {
      name: "OpenEden TBILL redemptions",
      url: "https://docs.openeden.com/tbill/redemptions",
      type: "issuer_docs",
      retrievedAt: "2026-08-17",
    },
  },
  yield: {
    value: {
      label: "Yield methodology",
      description:
        "TBILL holders receive returns reflecting the underlying US T-Bills portfolio. Current yield is not reported by Nostos.",
    },
    source: {
      name: "OpenEden TBILL introduction",
      url: "https://docs.openeden.com/tbill/introduction",
      type: "issuer_docs",
      retrievedAt: "2026-08-17",
    },
  },
  settlement: {
    value: {
      subscription: "USDC deposit mints TBILL tokens; on-chain instant subscription (24/7).",
      redemption: "USDC redemption; requests enter a FIFO redemption queue.",
      processing: "Redemptions are typically processed on the next 1 U.S. business day.",
      minimums: "Redemptions must meet a minimum value of USD 1.",
    },
    source: {
      name: "OpenEden TBILL redemptions",
      url: "https://docs.openeden.com/tbill/redemptions",
      type: "issuer_docs",
      retrievedAt: "2026-08-17",
    },
  },
  fees: {
    value: {
      notes: "USDC received = TBILL withdrawn x exchange rate - transaction fee; exchange rate and fee are determined when the redemption request is processed.",
    },
    source: {
      name: "OpenEden TBILL redemptions",
      url: "https://docs.openeden.com/tbill/redemptions",
      type: "issuer_docs",
      retrievedAt: "2026-08-17",
    },
  },
  backing: {
    value: {
      backing:
        "Backed 1:1 by short-dated US T-Bills and a small portion of USD; weighted-average maturity of the portfolio is less than 3 months.",
      custody: "BNY (US T-Bills custodian); investment management by BNY Mellon Investment Management.",
      rating:
        "Token issuer is a BVI-regulated professional fund; the TBILL Fund holds S&P Global Ratings AA+f/S1+ and was the first tokenized US Treasury fund rated 'A-bf' by Moody's. Nostos does not create its own risk score.",
    },
    source: {
      name: "OpenEden TBILL introduction",
      url: "https://docs.openeden.com/tbill/introduction",
      type: "issuer_docs",
      retrievedAt: "2026-08-17",
    },
  },
  integrationStatus: "DISCOVERY_ONLY",
};
```

- [ ] **Step 5: Create `lib/rwa/opportunities/index.ts`**

```ts
import type { RwaOpportunity } from "@/lib/rwa/types";
import { ousgOpportunity } from "./ousg";
import { tbillOpportunity } from "./tbill";

const OPPORTUNITIES: RwaOpportunity[] = [ousgOpportunity, tbillOpportunity];

export function listOpportunities(): RwaOpportunity[] {
  return OPPORTUNITIES;
}

export function getOpportunityBySlug(slug: string): RwaOpportunity | undefined {
  return OPPORTUNITIES.find((o) => o.slug === slug);
}
```

- [ ] **Step 6: Run tests to verify pass**

Run: `npx vitest run tests/unit/rwa-opportunities.test.ts`. Expected: PASS.

- [ ] **Step 7: Verify types and lint**

Run: `npx tsc --noEmit` and `npm run lint`. Expected: both exit 0.

### Task 4: Canonical Metadata Snapshots And Hashing

**Files:**
- Create: `lib/rwa/metadata.ts`
- Create: `scripts/metadata-snapshot.ts`
- Create: `tests/unit/rwa-metadata.test.ts`

**Interfaces:**
- Produces: `INTEGRATION_ID_PREFIX = "nostos-rwa-v1:"`, `integrationIdFor(slug)`, `canonicalSnapshotJson(opportunity)`, `metadataHashFor(opportunity)`, `MetadataSnapshot` type; a script that prints integration id + hash for each product and can (opt-in) write snapshot JSON files.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { integrationIdFor, metadataHashFor, canonicalSnapshotJson } from "@/lib/rwa/metadata";
import { listOpportunities } from "@/lib/rwa/opportunities";

describe("rwa metadata snapshots", () => {
  it("produces deterministic hashes for the same input", () => {
    const ousg = listOpportunities().find((o) => o.slug === "ousg")!;
    const a = metadataHashFor(ousg);
    const b = metadataHashFor(ousg);
    expect(a).toBe(b);
    expect(a).toMatch(/^0x[0-9a-f]{64}$/);
  });

  it("changes when a field changes", () => {
    const tbill = listOpportunities().find((o) => o.slug === "tbill")!;
    const before = metadataHashFor(tbill);
    const changed = { ...tbill, description: `${tbill.description} (edited)` };
    expect(metadataHashFor(changed)).not.toBe(before);
  });

  it("computes integration ids deterministically from slugs", () => {
    expect(integrationIdFor("ousg")).toBe(integrationIdFor("ousg"));
    expect(integrationIdFor("ousg")).not.toBe(integrationIdFor("tbill"));
  });

  it("serializes canonical JSON with deterministic key order", () => {
    const ousg = listOpportunities().find((o) => o.slug === "ousg")!;
    const json = canonicalSnapshotJson(ousg);
    expect(json.startsWith("{")).toBe(true);
    expect(metadataHashFor(ousg)).toBe(metadataHashFor(JSON.parse(json) as typeof ousg));
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/unit/rwa-metadata.test.ts`. Expected: FAIL.

- [ ] **Step 3: Implement `lib/rwa/metadata.ts`**

```ts
import { keccak256, toBytes } from "viem";
import type { RwaOpportunity } from "@/lib/rwa/types";

export const INTEGRATION_ID_PREFIX = "nostos-rwa-v1:";

export function integrationIdFor(slug: string): `0x${string}` {
  return keccak256(toBytes(`${INTEGRATION_ID_PREFIX}${slug}`));
}

// Canonical serialization: stable key order, no whitespace.
export function canonicalSnapshotJson(opportunity: RwaOpportunity): string {
  return JSON.stringify(opportunity, Object.keys(opportunity).sort());
}

export function metadataHashFor(opportunity: RwaOpportunity): `0x${string}` {
  return keccak256(toBytes(canonicalSnapshotJson(opportunity)));
}

export type MetadataSnapshot = {
  slug: string;
  integrationId: `0x${string}`;
  metadataHash: `0x${string}`;
};
```

Note: `JSON.stringify(value, replacerArray)` with an array of keys uses that key order; combined with a sorted array this yields deterministic output. Arrays inside (e.g., `networks.value`) keep insertion order, which is fixed in the curated records.

- [ ] **Step 4: Create `scripts/metadata-snapshot.ts`**

```ts
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { listOpportunities } from "../lib/rwa/opportunities";
import { canonicalSnapshotJson, integrationIdFor, metadataHashFor } from "../lib/rwa/metadata";

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
  console.log("\nSnapshots hash-ancbhor only. Register on BOT Testnet 968 with the deploy/register scripts when explicitly authorized.");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
```

- [ ] **Step 5: Run tests, types, and the script**

Run: `npx vitest run tests/unit/rwa-metadata.test.ts`, `npx tsc --noEmit`, `npm run lint`, then `npx tsx scripts/metadata-snapshot.ts`. Expected: all pass; the script prints integration ids and metadata hashes.

- [ ] **Step 6: Add npm scripts**

Add to `package.json`:

```json
"snapshot:rwa": "tsx scripts/metadata-snapshot.ts"
```

### Task 5: Populate Explore With Real Opportunities

**Files:**
- Modify: `app/(product)/explore/page.tsx`
- Modify: `components/product/explorer-controls.tsx`
- Create: `components/product/opportunity-card.tsx`

**Interfaces:**
- Consumes: `listOpportunities`, `displaySourced`, `sourceAffordance`, `canDeposit`/`canRedeem`, `filterOpportunities`, `sortOpportunities`.
- Produces: a real Explore surface with OUSG + TBILL cards, real-field filters/sorts, `DISCOVERY_ONLY` badges, and `Not reported` for missing dynamics.

- [ ] **Step 1: Create `components/product/opportunity-card.tsx`**

```tsx
import Link from "next/link";
import { ExternalLink, ArrowUpRight } from "lucide-react";
import type { RwaOpportunity } from "@/lib/rwa/types";
import { displaySourced, sourceAffordance } from "@/lib/rwa/display";
import { StatusBadge } from "@/components/ui/status-badge";

export function OpportunityCard({ opportunity }: { opportunity: RwaOpportunity }) {
  const yieldAff = opportunity.yield ? sourceAffordance(opportunity.yield.source) : null;
  return (
    <article className="flex flex-col gap-4 rounded-card border border-[var(--line)] bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="display text-xl font-semibold tracking-[-.02em]">{opportunity.name}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{opportunity.issuer}</p>
        </div>
        <StatusBadge label="DISCOVERY ONLY" tone="neutral" />
      </div>
      <p className="text-sm leading-6 text-muted-foreground">{opportunity.description}</p>
      <dl className="grid grid-cols-2 gap-3 text-sm">
        <div><dt className="eyebrow text-muted-foreground">Category</dt><dd className="mt-1 font-semibold">{opportunity.category}</dd></div>
        <div><dt className="eyebrow text-muted-foreground">Networks</dt><dd className="mt-1 font-semibold">{displaySourced(opportunity.networks)}</dd></div>
        <div><dt className="eyebrow text-muted-foreground">Yield</dt><dd className="mt-1 font-semibold">{displaySourced(opportunity.yield) === "Not reported" ? "Not reported" : opportunity.yield ? "See issuer" : "Not reported"}</dd></div>
        <div><dt className="eyebrow text-muted-foreground">Settlement</dt><dd className="mt-1 font-semibold">{opportunity.settlement.value.redemption}</dd></div>
      </dl>
      <div className="mt-auto flex items-center justify-between gap-3">
        <Link href={`/vaults/${opportunity.slug}`} className="inline-flex min-h-11 items-center gap-2 rounded-control border border-[var(--ink)] px-4 text-sm font-semibold hover:bg-black/[.04]">
          View details <ArrowUpRight size={16} aria-hidden="true" />
        </Link>
        {yieldAff && (
          <a href={yieldAff.href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-[var(--ink)]">
            <ExternalLink size={13} aria-hidden="true" /> {yieldAff.label}{yieldAff.asOf ? ` · as of ${yieldAff.asOf}` : ""}
          </a>
        )}
      </div>
    </article>
  );
}
```

- [ ] **Step 2: Rewrite `components/product/explorer-controls.tsx`**

Client component that receives opportunities and renders real-field controls:

```tsx
"use client";

import { useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import type { RwaOpportunity } from "@/lib/rwa/types";
import { filterOpportunities, sortOpportunities } from "@/lib/rwa/display";
import { OpportunityCard } from "@/components/product/opportunity-card";

const categories = ["All", "Treasuries"] as const;
const sorts = ["name"] as const;

export function ExplorerControls({ opportunities }: { opportunities: RwaOpportunity[] }) {
  const [category, setCategory] = useState<(typeof categories)[number]>("All");
  const [sort, setSort] = useState<(typeof sorts)[number]>("name");
  const filtered = filterOpportunities(opportunities, category);
  const sorted = sortOpportunities(filtered, sort);

  return (
    <div>
      <div className="flex flex-col gap-4 border-y border-[var(--line)] py-5 lg:flex-row lg:items-end lg:justify-between">
        <fieldset>
          <legend className="eyebrow mb-3 text-muted-foreground">Asset category</legend>
          <div className="flex flex-wrap gap-2">
            {categories.map((item) => (
              <button key={item} type="button" aria-pressed={category === item} onClick={() => setCategory(item)} className={`min-h-11 rounded-full border px-4 text-sm font-semibold transition-colors ${category === item ? "border-[var(--ink)] bg-[var(--ink)] text-white" : "border-[var(--line-strong)] bg-white hover:border-[var(--ink)]"}`}>{item}</button>
            ))}
          </div>
        </fieldset>
        <label className="flex min-w-56 flex-col gap-2 text-sm font-semibold">Sort by<select value={sort} onChange={(event) => setSort(event.target.value as (typeof sorts)[number])} className="min-h-12 rounded-control border border-[var(--ink)] bg-white px-4 text-sm focus-visible:ring-2 focus-visible:ring-[var(--lilac)]">{sorts.map((item) => <option key={item}>{item}</option>)}</select></label>
      </div>
      <div className="pt-6" aria-live="polite">
        <p className="mb-4 text-xs text-muted-foreground">Showing {category.toLowerCase()} · ordered by {sort.toLowerCase()}</p>
        {sorted.length === 0 ? (
          <div className="rounded-control border border-[var(--line)] p-8 text-center text-sm text-muted-foreground"><SlidersHorizontal size={18} className="mx-auto mb-2" aria-hidden="true" />No opportunities match this filter.</div>
        ) : (
          <div className="grid gap-5 md:grid-cols-2">
            {sorted.map((opportunity) => <OpportunityCard key={opportunity.id} opportunity={opportunity} />)}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Rewrite `app/(product)/explore/page.tsx`**

```tsx
import type { Metadata } from "next";
import { Compass } from "lucide-react";
import { ExplorerControls } from "@/components/product/explorer-controls";
import { ProductPage, StateNotice } from "@/components/product/product-primitives";
import { PageHeading } from "@/components/ui/page-heading";
import { StatusBadge } from "@/components/ui/status-badge";
import { listOpportunities } from "@/lib/rwa/opportunities";

export const metadata: Metadata = { title: "Explore vaults", description: "Compare selected RWA opportunities and their source-backed terms through the Nostos Gateway." };

export default function ExplorePage() {
  const opportunities = listOpportunities();
  return <ProductPage><PageHeading eyebrow="Nostos Gateway" title="See the yield. Know the exit." description="Compare selected RWA opportunities by their source-backed terms and integration status. Current APY, TVL, and NAV are shown only when a live source is available." actions={<StatusBadge label={`${opportunities.length} in discovery`} tone="pending" icon={<Compass size={14} aria-hidden="true" />} />} /><div className="mt-8"><StateNotice title="Discovery only" message="OUSG and TBILL are real issuer products surfaced for research. They are not BOT Chain-native Nostos vaults yet, so no deposit or redemption is available through Nostos." /></div><div className="mt-6"><ExplorerControls opportunities={opportunities} /></div></ProductPage>;
}
```

- [ ] **Step 4: Verify types, lint, build**

Run: `npx tsc --noEmit`, `npm run lint`, `npm run build`. Expected: all pass.

### Task 6: Vault Detail Resolves Opportunities (DISCOVERY ONLY)

**Files:**
- Modify: `app/(product)/vaults/[address]/page.tsx`

**Interfaces:**
- Consumes: `getOpportunityBySlug`, `displaySourced`, `sourceAffordance`, `canDeposit`, `canRedeem`.
- Produces: slug-based opportunity details with a clear `DISCOVERY ONLY` state and no functional deposit/redeem actions.

- [ ] **Step 1: Rewrite `app/(product)/vaults/[address]/page.tsx`**

```tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Landmark, ExternalLink } from "lucide-react";
import { DataPanel, DefinitionRows, ProductGrid, ProductPage, StateNotice } from "@/components/product/product-primitives";
import { PageHeading } from "@/components/ui/page-heading";
import { StatusBadge } from "@/components/ui/status-badge";
import { AmountForm } from "@/components/product/amount-form";
import { getOpportunityBySlug } from "@/lib/rwa/opportunities";
import { canDeposit, canRedeem, displaySourced, sourceAffordance } from "@/lib/rwa/display";

export const metadata: Metadata = { title: "Vault details", description: "Review an RWA opportunity's source-backed terms and Nostos integration status." };
const evmAddress = /^0x[a-fA-F0-9]{40}$/;
function shorten(address: string) { return `${address.slice(0, 8)}…${address.slice(-6)}`; }

export default async function VaultPage({ params }: { params: Promise<{ address: string }> }) {
  const { address } = await params;
  const opportunity = getOpportunityBySlug(address);

  if (opportunity) {
    const depositEnabled = canDeposit(opportunity);
    const redeemEnabled = canRedeem(opportunity);
    const source = (s: { source: { name: string; url: string; retrievedAt?: string } }) => {
      const a = sourceAffordance(s.source);
      return <a href={a.href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-[var(--ink)]"><ExternalLink size={12} aria-hidden="true" />{a.label}{a.asOf ? ` · ${a.asOf}` : ""}</a>;
    };
    return (
      <ProductPage>
        <PageHeading eyebrow="Nostos Gateway" title={opportunity.name} description={opportunity.description} actions={<StatusBadge label="DISCOVERY ONLY" tone="neutral" icon={<Landmark size={14} aria-hidden="true" />} />} />
        <div className="mt-8"><StateNotice title="DISCOVERY ONLY" message="This asset can be researched through Nostos, but direct BOT Chain entry is not yet integrated." tone="warning" /></div>
        <ProductGrid className="mt-6">
          <DataPanel title="Product" description="Source-backed issuer metadata.">
            <DefinitionRows rows={[
              { label: "Issuer", value: opportunity.issuer },
              { label: "Category", value: opportunity.category },
              { label: "Networks", value: displaySourced(opportunity.networks) },
              { label: "Networks source", value: source(opportunity.networks) },
              { label: "Eligibility", value: displaySourced(opportunity.eligibility) },
              { label: "Eligibility source", value: source(opportunity.eligibility) },
              { label: "Yield", value: opportunity.yield ? displaySourced(opportunity.yield) : "Not reported" },
            ]} />
          </DataPanel>
          <DataPanel title="Settlement" description="Issuer-described entry and exit terms.">
            <DefinitionRows rows={[
              { label: "Subscription", value: opportunity.settlement.value.subscription },
              { label: "Redemption", value: opportunity.settlement.value.redemption },
              { label: "Processing", value: opportunity.settlement.value.processing },
              { label: "Minimums", value: opportunity.settlement.value.minimums },
              { label: "Settlement source", value: source(opportunity.settlement) },
              ...(opportunity.fees ? [{ label: "Fees", value: `${opportunity.fees.value.management ?? ""} ${opportunity.fees.value.notes ?? ""}`.trim() }, { label: "Fees source", value: source(opportunity.fees) }] : []),
              ...(opportunity.backing ? [{ label: "Backing", value: opportunity.backing.value.backing }, { label: "Custody", value: opportunity.backing.value.custody ?? "Not reported" }, ...(opportunity.backing.value.rating ? [{ label: "Ratings", value: opportunity.backing.value.rating }] : []), { label: "Backing source", value: source(opportunity.backing) }] : []),
            ]} />
          </DataPanel>
        </ProductGrid>
        <div className="mt-6 grid gap-6 xl:grid-cols-[1.1fr_.9fr]">
          <DataPanel title="Nostos integration" description="Direct BOT Chain entry is not integrated for this asset.">
            <StateNotice title="Deposit unavailable" message="This product is DISCOVERY ONLY in Nostos. Approvals, deposits, redemptions, and instant cashouts are not available." />
          </DataPanel>
          <DataPanel title="Deposit" description="Disabled for discovery-only assets.">
            <AmountForm purpose="vault-deposit" actionLabel="Deposit unavailable" disabled={!depositEnabled} />
            <div className="mt-5"><StateNotice title="Redemption disabled" message={redeemEnabled ? "Redemption is available in Nostos for this asset." : "Redemption is not available for this DISCOVERY ONLY asset."} /></div>
          </DataPanel>
        </div>
      </ProductPage>
    );
  }

  if (!evmAddress.test(address)) notFound();
  return (
    <ProductPage>
      <PageHeading eyebrow="Nostos Vaults" title={`Vault ${shorten(address)}`} description="This address came from the route. No registry record has verified its issuer, asset, yield, eligibility, or settlement terms." actions={<StatusBadge label="Vault unavailable" tone="neutral" icon={<Landmark size={14} aria-hidden="true" />} />} />
      <div className="mt-8"><StateNotice title="Vault integration pending" message="This valid-shaped address is not yet backed by a connected registry record." tone="warning" /></div>
    </ProductPage>
  );
}
```

Note: `AmountForm` must accept a `disabled` prop; update `components/product/amount-form.tsx` to pass it through to the input/button if not already present. If `AmountForm` has no disabled prop, wrap the panel instead (set `actionLabel="Deposit unavailable"` and keep the submit disabled via the existing mechanism).

- [ ] **Step 2: Verify types, lint, build**

Run: `npx tsc --noEmit`, `npm run lint`, `npm run build`. Expected: all pass.

### Task 7: Nostos Registry Contract + Foundry Tests

**Files:**
- Create: `contracts/src/NostosRegistry.sol`
- Create: `contracts/test/NostosRegistry.t.sol`

**Interfaces:**
- Produces: `NostosRegistry` with `register`, `update`, `getIntegration`, `integrationCount`, events, duplicate protection, owner-only mutation (OpenZeppelin Ownable2Step), and zero-address/discovery-only guards.

- [ ] **Step 1: Write the failing contract test**

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console2} from "forge-std/Test.sol";
import {NostosRegistry} from "../src/NostosRegistry.sol";

contract NostosRegistryTest is Test {
    NostosRegistry registry;
    address deployer = address(0xA11CE);
    address stranger = address(0xB0B);

    bytes32 ousgId = keccak256("nostos-rwa-v1:ousg");
    bytes32 tbillId = keccak256("nostos-rwa-v1:tbill");
    bytes32 hashA = keccak256("snapshot-a");
    bytes32 hashB = keccak256("snapshot-b");

    function setUp() public {
        vm.prank(deployer);
        registry = new NostosRegistry(deployer);
    }

    function test_RegisterDiscoveryOnlyWithZeroVault() public {
        vm.prank(deployer);
        NostosRegistry.Integration memory it = registry.register(ousgId, address(0), hashA, NostosRegistry.IntegrationStatus.DiscoveryOnly);
        assertEq(it.status, NostosRegistry.IntegrationStatus.DiscoveryOnly);
        assertEq(it.nostosVault, address(0));
        assertEq(registry.integrationCount(), 1);
    }

    function test_DuplicateRegistrationRejected() public {
        vm.startPrank(deployer);
        registry.register(ousgId, address(0), hashA, NostosRegistry.IntegrationStatus.DiscoveryOnly);
        vm.expectRevert(bytes("NostosRegistry: already registered"));
        registry.register(ousgId, address(0), hashB, NostosRegistry.IntegrationStatus.DiscoveryOnly);
        vm.stopPrank();
    }

    function test_OnlyOwnerCanMutate() public {
        vm.prank(deployer);
        registry.register(ousgId, address(0), hashA, NostosRegistry.IntegrationStatus.DiscoveryOnly);
        vm.startPrank(stranger);
        vm.expectRevert();
        registry.update(ousgId, address(0), hashB, NostosRegistry.IntegrationStatus.DiscoveryOnly);
        vm.stopPrank();
    }

    function test_DiscoveryOnlyRequiresZeroVault() public {
        vm.startPrank(deployer);
        vm.expectRevert(bytes("NostosRegistry: discovery-only requires zero vault"));
        registry.register(ousgId, address(1), hashA, NostosRegistry.IntegrationStatus.DiscoveryOnly);
        vm.stopPrank();
    }

    function test_NonDiscoveryRequiresVault() public {
        vm.startPrank(deployer);
        vm.expectRevert(bytes("NostosRegistry: non-discovery requires vault"));
        registry.register(ousgId, address(0), hashA, NostosRegistry.IntegrationStatus.DepositSupported);
        vm.stopPrank();
    }

    function test_StoresOnlyStatusAndHash() public view {
        vm.prank(deployer);
        registry.register(tbillId, address(0), hashB, NostosRegistry.IntegrationStatus.DiscoveryOnly);
        NostosRegistry.Integration memory it = registry.getIntegration(tbillId);
        assertEq(it.metadataHash, hashB);
        assertEq(uint256(it.status), uint256(NostosRegistry.IntegrationStatus.DiscoveryOnly));
        // No APY/TVL/risk fields exist on the struct; this asserts the shape is minimal.
        assertEq(uint256(it.nostosVault), 0);
    }

    function test_ZeroIntegrationIdRejected() public {
        vm.prank(deployer);
        vm.expectRevert(bytes("NostosRegistry: zero integration id"));
        registry.register(bytes32(0), address(0), hashA, NostosRegistry.IntegrationStatus.DiscoveryOnly);
    }

    function test_UpdateChangesStatusAndHash() public {
        vm.startPrank(deployer);
        registry.register(ousgId, address(0), hashA, NostosRegistry.IntegrationStatus.DiscoveryOnly);
        registry.update(ousgId, address(0), hashB, NostosRegistry.IntegrationStatus.DiscoveryOnly);
        NostosRegistry.Integration memory it = registry.getIntegration(ousgId);
        assertEq(it.metadataHash, hashB);
        vm.stopPrank();
    }
}
```

- [ ] **Step 2: Run to verify it fails**

Run from `contracts/`: `forge test`. Expected: FAIL (contract missing).

- [ ] **Step 3: Implement `contracts/src/NostosRegistry.sol`**

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";

/// @notice Nostos integration-status registry. Anchors integration status and
/// metadata hashes ONLY - it never stores APY, TVL/NAV, or risk scores.
contract NostosRegistry is Ownable2Step {
    enum IntegrationStatus {
        DiscoveryOnly,
        DepositSupported,
        RedemptionSupported,
        InstantLiquiditySupported,
        Paused
    }

    struct Integration {
        bytes32 integrationId;
        address nostosVault;
        bytes32 metadataHash;
        IntegrationStatus status;
        uint64 registeredAt;
        uint64 updatedAt;
    }

    mapping(bytes32 => Integration) public integrations;
    mapping(bytes32 => bool) public exists;
    bytes32[] public integrationIds;

    event IntegrationRegistered(
        bytes32 indexed integrationId,
        address nostosVault,
        bytes32 metadataHash,
        IntegrationStatus status,
        uint64 registeredAt
    );

    event IntegrationUpdated(
        bytes32 indexed integrationId,
        address nostosVault,
        bytes32 metadataHash,
        IntegrationStatus status,
        uint64 updatedAt
    );

    error ZeroIntegrationId();
    error AlreadyRegistered(bytes32 integrationId);
    error NotRegistered(bytes32 integrationId);
    error DiscoveryOnlyRequiresZeroVault();
    error NonDiscoveryRequiresVault();

    constructor(address initialOwner) Ownable2Step(initialOwner) {}

    function register(
        bytes32 integrationId_,
        address nostosVault_,
        bytes32 metadataHash_,
        IntegrationStatus status_
    ) external onlyOwner returns (Integration memory) {
        if (integrationId_ == bytes32(0)) revert ZeroIntegrationId();
        if (exists[integrationId_]) revert AlreadyRegistered(integrationId_);
        _validateVault(status_, nostosVault_);

        uint64 timestamp = uint64(block.timestamp);
        Integration memory integration = Integration({
            integrationId: integrationId_,
            nostosVault: nostosVault_,
            metadataHash: metadataHash_,
            status: status_,
            registeredAt: timestamp,
            updatedAt: timestamp
        });
        integrations[integrationId_] = integration;
        exists[integrationId_] = true;
        integrationIds.push(integrationId_);
        emit IntegrationRegistered(integrationId_, nostosVault_, metadataHash_, status_, timestamp);
        return integration;
    }

    function update(
        bytes32 integrationId_,
        address nostosVault_,
        bytes32 metadataHash_,
        IntegrationStatus status_
    ) external onlyOwner returns (Integration memory) {
        if (!exists[integrationId_]) revert NotRegistered(integrationId_);
        _validateVault(status_, nostosVault_);

        Integration storage integration = integrations[integrationId_];
        integration.nostosVault = nostosVault_;
        integration.metadataHash = metadataHash_;
        integration.status = status_;
        integration.updatedAt = uint64(block.timestamp);
        emit IntegrationUpdated(integrationId_, nostosVault_, metadataHash_, status_, integration.updatedAt);
        return integration;
    }

    function getIntegration(bytes32 integrationId_) external view returns (Integration memory) {
        return integrations[integrationId_];
    }

    function integrationCount() external view returns (uint256) {
        return integrationIds.length;
    }

    function _validateVault(IntegrationStatus status_, address nostosVault_) internal pure {
        if (status_ == IntegrationStatus.DiscoveryOnly) {
            if (nostosVault_ != address(0)) revert DiscoveryOnlyRequiresZeroVault();
        } else {
            if (nostosVault_ == address(0)) revert NonDiscoveryRequiresVault();
        }
    }
}
```

- [ ] **Step 4: Run contract tests**

Run from `contracts/`: `forge test`. Expected: PASS.

- [ ] **Step 5: Compile with warnings as errors**

Run from `contracts/`: `forge build`. Expected: clean.

### Task 8: Testnet Deployment And Registration Tooling

**Files:**
- Create: `scripts/registry/deploy.ts`
- Create: `scripts/registry/register.ts`
- Create: `contracts/addresses/bot-testnet.json` (initial placeholder committed with empty registry)
- Create: `tests/unit/registry-plan.test.ts`

**Interfaces:**
- Consumes: `botTestnet`, `BOT_TESTNET_RPC_URL`, `BOT_TESTNET_EXPLORER_URL`, `assertBotTestnetChain`, `getTestnetPrivateKey`, `BOT_TESTNET_SETTLEMENT_TOKEN` (unused here), `integrationIdFor`, `metadataHashFor`, `listOpportunities`.
- Produces: `buildDeployPlan(env)` and `buildRegistrationPlan(env, slug)` (pure, opt-in + guard testable), plus live deploy/register scripts that refuse 677 and never print keys.

- [ ] **Step 1: Write the failing unit test**

```ts
import { describe, expect, it } from "vitest";
import { buildDeployPlan, buildRegistrationPlan, P2_ENABLE_DEPLOY_ENV } from "@/scripts/registry/plan";
import { integrationIdFor } from "@/lib/rwa/metadata";

const KEY = "0x3333333333333333333333333333333333333333333333333333333333333333";

describe("testnet registry deploy/register plans", () => {
  it("is disabled without the explicit opt-in", () => {
    const plan = buildDeployPlan({});
    expect(plan.enabled).toBe(false);
  });

  it("targets BOT Testnet 968 and refuses mainnet in the guard", () => {
    const plan = buildDeployPlan({ [P2_ENABLE_DEPLOY_ENV]: "true", BOT_TESTNET_PRIVATE_KEY: KEY });
    expect(plan.ok).toBe(true);
    if (plan.ok) expect(plan.chainId).toBe(968);
  });

  it("never signs without a testnet key", () => {
    const plan = buildDeployPlan({ [P2_ENABLE_DEPLOY_ENV]: "true" });
    expect(plan.ok).toBe(false);
  });

  it("builds a discovery-only registration with a zero vault", () => {
    const plan = buildRegistrationPlan({ [P2_ENABLE_DEPLOY_ENV]: "true", BOT_TESTNET_PRIVATE_KEY: KEY }, "ousg");
    expect(plan.ok).toBe(true);
    if (plan.ok) {
      expect(plan.nostosVault).toBe("0x0000000000000000000000000000000000000000");
      expect(plan.integrationId).toBe(integrationIdFor("ousg"));
    }
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/unit/registry-plan.test.ts`. Expected: FAIL.

- [ ] **Step 3: Implement `scripts/registry/plan.ts`**

```ts
import { getTestnetPrivateKey } from "@/lib/chain/builder-wallet";
import { BOT_TESTNET_CHAIN_ID } from "@/lib/chain/bot-testnet";
import { assertBotTestnetChain } from "@/lib/chain/guards";
import { privateKeyToAccount } from "viem/accounts";
import { getOpportunityBySlug } from "@/lib/rwa/opportunities";
import { integrationIdFor, metadataHashFor } from "@/lib/rwa/metadata";

export const P2_ENABLE_DEPLOY_ENV = "P2_ENABLE_TESTNET_DEPLOY";
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

export type DeployPlan =
  | { ok: true; enabled: true; chainId: number; deployer: `0x${string}` }
  | { ok: false; enabled: false; reason: string }
  | { ok: false; enabled: true; reason: string };

export function buildDeployPlan(env: Record<string, string | undefined> = process.env): DeployPlan {
  if (env[P2_ENABLE_DEPLOY_ENV] !== "true") {
    return { ok: false, enabled: false, reason: `${P2_ENABLE_DEPLOY_ENV}=true is required.` };
  }
  const key = getTestnetPrivateKey(env);
  if (!key) return { ok: false, enabled: true, reason: "BOT_TESTNET_PRIVATE_KEY is not configured." };
  return { ok: true, enabled: true, chainId: BOT_TESTNET_CHAIN_ID, deployer: privateKeyToAccount(key as `0x${string}`).address };
}

export type RegistrationPlan =
  | DeployPlan & { slug: string; integrationId: `0x${string}`; metadataHash: `0x${string}`; nostosVault: `0x${string}` }
  | { ok: false; enabled: boolean; reason: string };

export function buildRegistrationPlan(env: Record<string, string | undefined> = process.env, slug: string): RegistrationPlan {
  const base = buildDeployPlan(env);
  if (!base.ok) return base;
  const opportunity = getOpportunityBySlug(slug);
  if (!opportunity) return { ok: false, enabled: true, reason: `Unknown slug: ${slug}` };
  return {
    ok: true,
    enabled: true,
    chainId: base.chainId,
    deployer: base.deployer,
    slug,
    integrationId: integrationIdFor(slug),
    metadataHash: metadataHashFor(opportunity),
    nostosVault: ZERO_ADDRESS,
  };
}

// Re-exported guard for the live scripts.
export { assertBotTestnetChain };
```

- [ ] **Step 4: Create `scripts/registry/deploy.ts`**

```ts
import { createPublicClient, createWalletClient, http, getContract } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { readFileSync, writeFileSync } from "node:fs";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { botTestnet, BOT_TESTNET_RPC_URL, BOT_TESTNET_EXPLORER_URL } from "@/lib/chain/bot-testnet";
import { getTestnetPrivateKey } from "@/lib/chain/builder-wallet";
import { assertBotTestnetChain, P2_ENABLE_DEPLOY_ENV } from "@/scripts/registry/plan";
import { buildDeployPlan } from "@/scripts/registry/plan";
import { nostosRegistryAbi } from "@/lib/contracts/nostos-registry-abi";

async function main() {
  const plan = buildDeployPlan();
  if (!plan.enabled) { console.log(`DEPLOY DISABLED: ${plan.reason}`); process.exit(0); }
  if (!plan.ok) { console.error(`DEPLOY REFUSED: ${plan.reason}`); process.exit(1); }

  const publicClient = createPublicClient({ chain: botTestnet, transport: http(BOT_TESTNET_RPC_URL, { timeout: 15000 }) });
  const liveChainId = await publicClient.getChainId();
  try { assertBotTestnetChain(liveChainId); } catch (err) { console.error(`ABORT: ${err instanceof Error ? err.message : err}`); process.exit(1); }

  const account = privateKeyToAccount(getTestnetPrivateKey() as `0x${string}`);
  const walletClient = createWalletClient({ chain: botTestnet, transport: http(BOT_TESTNET_RPC_URL), account });

  // Bytecode is embedded by build; see register note below.
  const bytecode = readFileSync(join(process.cwd(), "contracts", "out", "NostosRegistry.sol", "NostosRegistry.json"), "utf8");
  const artifact = JSON.parse(bytecode) as { bytecode?: { object?: string }; abi?: unknown[] };

  console.log("DEPLOYING NostosRegistry");
  console.log(`  chain: ${plan.chainId} (BOT Testnet)`);
  console.log(`  deployer: ${plan.deployer}`);
  const hash = await walletClient.deployContract({
    abi: nostosRegistryAbi,
    bytecode: artifact.bytecode?.object as `0x${string}`,
    args: [plan.deployer],
    chain: botTestnet,
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  const registryAddress = receipt.contractAddress;
  console.log(`  tx: ${hash}`);
  console.log(`  block: ${receipt.blockNumber}`);
  console.log(`  registry: ${registryAddress}`);
  console.log(`  explorer: ${BOT_TESTNET_EXPLORER_URL}/tx/${hash}`);

  const file = join(process.cwd(), "contracts", "addresses", "bot-testnet.json");
  const current = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) as Record<string, unknown> : {};
  writeFileSync(file, JSON.stringify({ ...current, registry: registryAddress, registryTx: hash, registryBlock: String(receipt.blockNumber), deployedAt: new Date().toISOString() }, null, 2));
  console.log(`  persisted to ${file}`);
}

main().catch((err) => { console.error("DEPLOY FAILED:", err instanceof Error ? err.message : err); process.exit(1); });
```

Note: define `lib/contracts/nostros-registry-abi.ts` exporting the ABI as a typed constant (subset: `register`, `update`, `getIntegration`, `integrationCount`, `integrations`, `exists`, `integrationIds`, `owner`, events). The register script reads the same artifact for bytecode/ABI where needed.

- [ ] **Step 5: Create `scripts/registry/register.ts`**

Mirrors deploy.ts: builds a registration plan for each slug passed as argv, refuses non-968 via `assertBotTestnetChain`, requires `P2_ENABLE_TESTNET_DEPLOY=true` and `BOT_TESTNET_PRIVATE_KEY`, calls `registry.register(integrationId, ZERO_ADDRESS, metadataHash, 0 /* DiscoveryOnly */)` via `writeContract` on the deployed registry address from `contracts/addresses/bot-testnet.json`, waits for receipt, prints tx + explorer URL. No private key output.

- [ ] **Step 6: Verify types, lint, and unit tests**

Run: `npx tsc --noEmit`, `npm run lint`, `npx vitest run tests/unit/registry-plan.test.ts`. Expected: all pass.

- [ ] **Step 7: Add npm scripts**

Add to `package.json`:

```json
"deploy:registry:testnet": "tsx scripts/registry/deploy.ts",
"register:rwa:testnet": "tsx scripts/registry/register.ts",
"contract:test": "forge test --root contracts"
```

### Task 9: E2E And Full Gate

**Files:**
- Modify: `tests/e2e/nostos.spec.ts` (explore test)

**Interfaces:**
- Produces: updated Explore e2e asserting real cards and no fabricated financial values.

- [ ] **Step 1: Replace the explore e2e test**

Replace `explorer filters are local controls with no fabricated rows` with:

```ts
test("explore shows real discovery cards with no fabricated financial values", async ({ page }) => {
  await page.goto("/explore");
  await expect(page.getByText(/OUSG/i)).toBeVisible();
  await expect(page.getByText(/TBILL/i)).toBeVisible();
  await expect(page.getByText(/DISCOVERY ONLY/i).first()).toBeVisible();
  await expect(page.getByText(/Not reported/i).first()).toBeVisible();
  await expect(page.locator("main")).not.toContainText(/\d+(\.\d+)?%|APY|TVL|AUM/i);
});
```

Also update any route-shell test that asserted `vault data is not connected` (no longer present) and add a detail check:

```ts
test("vault detail resolves a discovery-only opportunity without financial actions", async ({ page }) => {
  await page.goto("/vaults/tbill");
  await expect(page.getByRole("heading", { name: "TBILL" })).toBeVisible();
  await expect(page.getByText(/DISCOVERY ONLY/i).first()).toBeVisible();
  await expect(page.getByRole("button", { name: /deposit unavailable/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /redeem|approve|instant cashout/i })).toHaveCount(0);
});
```

- [ ] **Step 2: Run the full repo gate**

Run: `npm test`, `npx tsc --noEmit`, `npm run lint`, `npm run build`, `npm run test:e2e`, and from `contracts/` `forge test`. Expected: all green.

### Task 10: Manual Verification Script, State, And Report

**Files:**
- Modify: `.agent-state/project-state.md`, `.agent-state/memory.md`, `.agent-state/left-off.md`
- Create: `docs/nostos-rwa-discovery.md` (optional, source list + verification commands)

**Interfaces:**
- Produces: updated agent state and the P2 completion report including exact deployment/registration commands (NOT executed).

- [ ] **Step 1: Update agent state files**

Record P2 facts: discovery-only OUSG/TBILL, field provenance, metadata hashes, Registry contract, testnet deploy tooling, gate results.

- [ ] **Step 2: Compile the completion report**

Include the 12 required items and the manual browser verification instructions.

- [ ] **Step 3: Do NOT commit**

Leave all P2 changes uncommitted per instruction. Do not run any deploy/register write.