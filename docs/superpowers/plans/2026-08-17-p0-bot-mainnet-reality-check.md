# P0 BOT Mainnet Reality Check Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish and encode the real BOT Chain Mainnet environment Nostos will build on (chain 677, official RPC/explorer, builder wallet readiness, live RPC capability audit, and an honest investigation of the suspected bridged USDT address) with zero fabricated financial state.

**Architecture:** Add a small server-side "network truth" layer under `lib/chain/` (canonical Viem chain definition, provenance surface, settlement-token gate, server-only builder wallet reader, opt-in write-proof guard), two executable scripts under `scripts/` (read-only doctor + disabled-by-default write-proof), and a deterministic Vitest unit suite. No UI changes, no MockUSDT, no contracts, no database.

**Tech Stack:** Node 24, TypeScript, Next.js 16.3.1 (App Router), Viem (new), Vitest (new), tsx (new), existing npm + ESLint + Playwright.

## Global Constraints

- Do NOT redesign UI; do NOT begin vault/redemption/ERC-7540/registry/pool/keeper/database/RWA API implementation.
- Do NOT create MockUSDT or any fake stablecoin; do NOT replace real unavailable state with fixtures.
- Never print, commit, log, or expose the private key; it must never be referenced by `NEXT_PUBLIC_*`.
- `eth_getLogs` on the official BOT Mainnet RPC is expected to be disabled; the doctor must detect and report this, not crash.
- Chain ID 677 is canonical; the doctor fails loudly on mismatch; the write-proof refuses any non-677 chain.
- Do NOT execute any Mainnet transaction during implementation. The write-proof command stays disabled by default.
- Preserve existing unrelated worktree changes; stage/commit only P0-owned paths.
- Unit tests must not depend on live RPC/Internet. Live checks live only in the doctor script.
- Do not weaken existing tests.

## Ground Truth Values (from BOT Chain official docs)

- Mainnet chain id: `677`
- Native gas token: `BOT`, 18 decimals
- Mainnet RPC: `https://rpc.botchain.ai`
- Mainnet explorer: `https://scan.botchain.ai`
- Candidate bridged USDT address: `0xaBabc7Ddc03e501d190C676BF3d92ef0e6e87a3C` (NOT canonical; must be verified)

---

### Task 1: Dependencies, Scripts, And Env Hygiene

**Files:**
- Modify: `package.json` (add dependencies, scripts)
- Create: `.env.example`
- Modify: `.gitignore` (un-ignore `.env.example`)

**Interfaces:**
- Consumes: current `package.json` scripts (`dev`, `build`, `start`, `lint`, `test:e2e`).
- Produces: `viem` runtime dependency, `vitest` + `tsx` devDependencies, `test`, `test:unit`, `doctor:mainnet`, `write-proof:mainnet` scripts, and a committed-safe `.env.example`.

- [ ] **Step 1: Install dependencies**

Run:

```bash
npm install viem
npm install -D vitest tsx
```

Expected: both commands succeed; `package.json` gains `viem` under `dependencies` and `vitest`/`tsx` under `devDependencies`.

- [ ] **Step 2: Add npm scripts**

In `package.json`, add to `scripts` (keeping existing entries intact):

```json
{
  "test": "vitest run",
  "test:unit": "vitest run",
  "doctor:mainnet": "tsx scripts/doctor-mainnet.ts",
  "write-proof:mainnet": "tsx scripts/mainnet-write-proof.ts"
}
```

- [ ] **Step 3: Create `.env.example`**

```env
# BOT Mainnet P0 configuration.
# Copy this file to `.env` locally and fill in values. Never commit `.env`.

# Builder/deployer wallet private key.
# SERVER-ONLY. Never reference via NEXT_PUBLIC_*. Leave empty for doctor runs
# without a wallet (reports "BUILDER WALLET: NOT CONFIGURED").
BOT_BUILDER_PRIVATE_KEY=

# Optional override of the official Mainnet RPC (defaults to https://rpc.botchain.ai).
BOT_MAINNET_RPC_URL=

# Opt-in Mainnet write proof. Set to "true" ONLY when you explicitly authorize
# a tiny transaction. Default is disabled.
P0_ENABLE_MAINNET_WRITE=false

# Tiny write-proof amount in BOT units (refused if >= 1).
P0_WRITE_AMOUNT=0.0001

# Write-proof token: "BOT" (default) or "USDT" (only allowed if settlement token is VERIFIED).
P0_WRITE_TOKEN=BOT
```

- [ ] **Step 4: Un-ignore `.env.example` in `.gitignore`**

Append after the existing `.env*` line:

```gitignore
!.env.example
```

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json .env.example .gitignore
git commit -m "chore: add viem, vitest, tsx and mainnet doctor scripts"
```

### Task 2: Canonical BOT Mainnet Chain Definition And Provenance

**Files:**
- Create: `lib/chain/bot-mainnet.ts`
- Create: `lib/chain/settlement-token.ts` (shared status type used by provenance)
- Create: `lib/chain/provenance.ts`

**Interfaces:**
- Consumes: `viem` `defineChain`.
- Produces: `botMainnet` (Viem `Chain`), `BOT_CHAIN_ID`, `BOT_CHAIN_RPC_URL`, `BOT_CHAIN_EXPLORER_URL`, `BOT_NATIVE_SYMBOL`, `BOT_NATIVE_DECIMALS`; `TokenVerificationStatus`, `SettlementTokenRecord`, `BOT_USDT`, `isUsableSettlementToken`, `CANDIDATE_BOT_USDT_ADDRESS`; `BOT_MAINNET_PROVENANCE`.

- [ ] **Step 1: Create `lib/chain/bot-mainnet.ts`**

```ts
import { defineChain } from "viem";

export const BOT_CHAIN_ID = 677;
export const BOT_CHAIN_RPC_URL = "https://rpc.botchain.ai";
export const BOT_CHAIN_EXPLORER_URL = "https://scan.botchain.ai";
export const BOT_NATIVE_SYMBOL = "BOT";
export const BOT_NATIVE_DECIMALS = 18;

export const botMainnet = defineChain({
  id: BOT_CHAIN_ID,
  name: "BOT Chain",
  nativeCurrency: {
    name: "BOT",
    symbol: BOT_NATIVE_SYMBOL,
    decimals: BOT_NATIVE_DECIMALS,
  },
  rpcUrls: {
    default: { http: [BOT_CHAIN_RPC_URL] },
  },
  blockExplorers: {
    default: { name: "BOT Scan", url: BOT_CHAIN_EXPLORER_URL },
  },
  testnet: false,
});
```

- [ ] **Step 2: Create `lib/chain/settlement-token.ts`**

```ts
export type TokenVerificationStatus =
  | "VERIFIED"
  | "PROVISIONALLY VERIFIED"
  | "UNRESOLVED"
  | "REJECTED";

export interface SettlementTokenRecord {
  address: `0x${string}` | null;
  symbol: string | null;
  decimals: number | null;
  status: TokenVerificationStatus;
  verifiedAt: string | null;
  evidence: string[];
}

export const CANDIDATE_BOT_USDT_ADDRESS =
  "0xaBabc7Ddc03e501d190C676BF3d92ef0e6e87a3C";

export const BOT_USDT: SettlementTokenRecord = {
  address: CANDIDATE_BOT_USDT_ADDRESS,
  symbol: null,
  decimals: null,
  status: "UNRESOLVED",
  verifiedAt: null,
  evidence: [
    "Candidate address supplied externally; not treated as canonical without on-chain verification.",
  ],
};

export type VerifiedSettlementToken = SettlementTokenRecord & {
  status: "VERIFIED";
  address: `0x${string}`;
  decimals: number;
};

export function isUsableSettlementToken(
  token: SettlementTokenRecord,
): token is VerifiedSettlementToken {
  return token.status === "VERIFIED" && token.address !== null && token.decimals !== null;
}
```

Note: the executor of Task 9 may update `BOT_USDT.symbol`, `decimals`, `verifiedAt`, and `evidence` from live results, and promote `status` to `VERIFIED` ONLY if the live investigation justifies it. It must never be promoted to satisfy a test.

- [ ] **Step 3: Create `lib/chain/provenance.ts`**

```ts
import {
  botMainnet,
  BOT_CHAIN_ID,
  BOT_CHAIN_RPC_URL,
  BOT_CHAIN_EXPLORER_URL,
  BOT_NATIVE_SYMBOL,
  BOT_NATIVE_DECIMALS,
} from "./bot-mainnet";
import { BOT_USDT, type SettlementTokenRecord } from "./settlement-token";

export interface MainnetProvenance {
  chainId: number;
  chainName: string;
  rpcUrl: string;
  explorerUrl: string;
  nativeSymbol: string;
  nativeDecimals: number;
  officialRpcIndexesLogs: false;
  indexingStrategy: string;
  settlementToken: SettlementTokenRecord;
}

export const BOT_MAINNET_PROVENANCE: MainnetProvenance = {
  chainId: BOT_CHAIN_ID,
  chainName: botMainnet.name,
  rpcUrl: BOT_CHAIN_RPC_URL,
  explorerUrl: BOT_CHAIN_EXPLORER_URL,
  nativeSymbol: BOT_NATIVE_SYMBOL,
  nativeDecimals: BOT_NATIVE_DECIMALS,
  officialRpcIndexesLogs: false,
  indexingStrategy:
    "BOT's official Mainnet RPC disables eth_getLogs; historical event indexing requires an approved third-party RPC/WebSocket/indexer/explorer chosen in a later milestone (P7).",
  settlementToken: BOT_USDT,
};
```

- [ ] **Step 4: Verify types**

Run:

```bash
npx tsc --noEmit
```

Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
git add lib/chain/bot-mainnet.ts lib/chain/settlement-token.ts lib/chain/provenance.ts
git commit -m "feat(chain): add canonical BOT mainnet definition and provenance"
```

### Task 3: Server-Only Builder Wallet Reader

**Files:**
- Create: `lib/chain/builder-wallet.ts`

**Interfaces:**
- Consumes: `viem/accounts` `privateKeyToAccount`, `process.env`.
- Produces: `BUILDER_PRIVATE_KEY_ENV`, `getBuilderPrivateKey()`, `getBuilderWallet()` returning `{ configured: boolean; address: \`0x${string}\` | null }`. The module must NEVER export or log the private key.

- [ ] **Step 1: Create `lib/chain/builder-wallet.ts`**

```ts
import { privateKeyToAccount } from "viem/accounts";

export const BUILDER_PRIVATE_KEY_ENV = "BOT_BUILDER_PRIVATE_KEY";

export function getBuilderPrivateKey(env: NodeJS.ProcessEnv = process.env): string | null {
  const raw = env[BUILDER_PRIVATE_KEY_ENV];
  if (!raw) return null;
  const key = raw.startsWith("0x") ? raw : `0x${raw}`;
  return /^0x[0-9a-fA-F]{64}$/.test(key) ? key : null;
}

export interface BuilderWalletState {
  configured: boolean;
  address: `0x${string}` | null;
}

export function getBuilderWallet(env: NodeJS.ProcessEnv = process.env): BuilderWalletState {
  const key = getBuilderPrivateKey(env);
  if (!key) return { configured: false, address: null };
  return { configured: true, address: privateKeyToAccount(key).address };
}
```

- [ ] **Step 2: Verify types and lint**

Run: `npx tsc --noEmit` and `npm run lint`. Expected: both exit 0.

- [ ] **Step 3: Commit**

```bash
git add lib/chain/builder-wallet.ts
git commit -m "feat(chain): add server-only builder wallet reader"
```

### Task 4: Opt-In Mainnet Write Proof (Module + Script)

**Files:**
- Create: `lib/chain/write-proof.ts`
- Create: `scripts/mainnet-write-proof.ts`

**Interfaces:**
- Consumes: `botMainnet`, `BOT_CHAIN_ID`, `BOT_NATIVE_SYMBOL`, `BOT_NATIVE_DECIMALS`, `getBuilderPrivateKey`, `BOT_USDT`, `isUsableSettlementToken`.
- Produces: `P0_ENABLE_MAINNET_WRITE_ENV`, `P0_WRITE_AMOUNT_ENV`, `P0_WRITE_TOKEN_ENV`, `assertMainnetChain(chainId)`, `parseWriteAmount(env)`, `buildWriteProofPlan(env, token?)`. `buildWriteProofPlan` returns `{ ok: true, ... }` only when opt-in is enabled, a valid key exists, the chain is 677, and (for USDT) the settlement token is VERIFIED.

- [ ] **Step 1: Create `lib/chain/write-proof.ts`**

```ts
import { parseUnits } from "viem";
import { BOT_CHAIN_ID, BOT_NATIVE_SYMBOL, BOT_NATIVE_DECIMALS } from "./bot-mainnet";
import { getBuilderPrivateKey } from "./builder-wallet";
import { privateKeyToAccount } from "viem/accounts";
import {
  BOT_USDT,
  isUsableSettlementToken,
  type SettlementTokenRecord,
} from "./settlement-token";

export const P0_ENABLE_MAINNET_WRITE_ENV = "P0_ENABLE_MAINNET_WRITE";
export const P0_WRITE_AMOUNT_ENV = "P0_WRITE_AMOUNT";
export const P0_WRITE_TOKEN_ENV = "P0_WRITE_TOKEN";

const DEFAULT_WRITE_AMOUNT = "0.0001";
const MAX_WRITE_AMOUNT = 1;

export function assertMainnetChain(chainId: number | bigint): void {
  if (Number(chainId) !== BOT_CHAIN_ID) {
    throw new Error(`Refusing mainnet operation on chain ${chainId}; only chain ${BOT_CHAIN_ID} is allowed.`);
  }
}

export function parseWriteAmount(env: NodeJS.ProcessEnv = process.env): bigint {
  const raw = env[P0_WRITE_AMOUNT_ENV] ?? DEFAULT_WRITE_AMOUNT;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error(`Invalid ${P0_WRITE_AMOUNT_ENV} value: "${raw}"`);
  }
  if (n >= MAX_WRITE_AMOUNT) {
    throw new Error(`Refusing write-proof amount >= ${MAX_WRITE_AMOUNT} ${BOT_NATIVE_SYMBOL}`);
  }
  return parseUnits(n.toString(), BOT_NATIVE_DECIMALS);
}

export type WriteProofPlan =
  | {
      ok: true;
      enabled: true;
      chainId: number;
      sender: `0x${string}`;
      token: "BOT" | "USDT";
      tokenAddress: `0x${string}` | null;
      amount: string;
      amountUnits: bigint;
    }
  | { ok: false; enabled: false; reason: string }
  | { ok: false; enabled: true; reason: string };

export function buildWriteProofPlan(
  env: NodeJS.ProcessEnv = process.env,
  token: SettlementTokenRecord = BOT_USDT,
): WriteProofPlan {
  const enabled = env[P0_ENABLE_MAINNET_WRITE_ENV] === "true";
  if (!enabled) {
    return {
      ok: false,
      enabled: false,
      reason: `${P0_ENABLE_MAINNET_WRITE_ENV}=true is required to enable the write proof.`,
    };
  }

  const key = getBuilderPrivateKey(env);
  if (!key) {
    return { ok: false, enabled: true, reason: "BOT_BUILDER_PRIVATE_KEY is not configured." };
  }
  const sender = privateKeyToAccount(key).address;

  const choice = (env[P0_WRITE_TOKEN_ENV] ?? "BOT").toUpperCase();
  if (choice === "BOT") {
    const amountUnits = parseWriteAmount(env);
    return {
      ok: true,
      enabled: true,
      chainId: BOT_CHAIN_ID,
      sender,
      token: "BOT",
      tokenAddress: null,
      amount: env[P0_WRITE_AMOUNT_ENV] ?? DEFAULT_WRITE_AMOUNT,
      amountUnits,
    };
  }

  if (choice === "USDT") {
    if (!isUsableSettlementToken(token)) {
      return {
        ok: false,
        enabled: true,
        reason: `USDT settlement token is ${token.status}; a VERIFIED token is required before any USDT write.`,
      };
    }
    const raw = env[P0_WRITE_AMOUNT_ENV] ?? DEFAULT_WRITE_AMOUNT;
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 1) {
      throw new Error(`Invalid ${P0_WRITE_AMOUNT_ENV} for USDT: integer token units required`);
    }
    return {
      ok: true,
      enabled: true,
      chainId: BOT_CHAIN_ID,
      sender,
      token: "USDT",
      tokenAddress: token.address,
      amount: raw,
      amountUnits: BigInt(Math.trunc(n)),
    };
  }

  return { ok: false, enabled: true, reason: `Unsupported ${P0_WRITE_TOKEN_ENV}: "${choice}"` };
}
```

- [ ] **Step 2: Create `scripts/mainnet-write-proof.ts`**

```ts
import {
  createPublicClient,
  createWalletClient,
  erc20Abi,
  formatUnits,
  http,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { existsSync } from "node:fs";
import {
  botMainnet,
  BOT_CHAIN_RPC_URL,
  BOT_CHAIN_EXPLORER_URL,
  BOT_NATIVE_SYMBOL,
  BOT_NATIVE_DECIMALS,
} from "../lib/chain/bot-mainnet";
import { getBuilderPrivateKey } from "../lib/chain/builder-wallet";
import {
  assertMainnetChain,
  buildWriteProofPlan,
  P0_ENABLE_MAINNET_WRITE_ENV,
} from "../lib/chain/write-proof";
import { BOT_USDT, isUsableSettlementToken } from "../lib/chain/settlement-token";

for (const file of [".env", ".env.local"]) {
  if (existsSync(file)) {
    try {
      process.loadEnvFile(file);
    } catch {
      /* ignore invalid env files */
    }
  }
}

const rpcUrl = process.env.BOT_MAINNET_RPC_URL ?? BOT_CHAIN_RPC_URL;

async function main() {
  const plan = buildWriteProofPlan();
  if (!plan.enabled) {
    console.log(`WRITE PROOF DISABLED: ${plan.reason}`);
    console.log(`Set ${P0_ENABLE_MAINNET_WRITE_ENV}=true only when you explicitly authorize a tiny transaction.`);
    process.exit(0);
  }
  if (!plan.ok) {
    console.error(`WRITE PROOF REFUSED: ${plan.reason}`);
    process.exit(1);
  }

  console.log("MAINNET WRITE PROOF REQUESTED");
  console.log(`  chain: ${plan.chainId} (BOT Chain Mainnet)`);
  console.log(`  sender: ${plan.sender}`);
  console.log(`  token: ${plan.token}`);
  console.log(`  token address: ${plan.tokenAddress ?? "native (BOT)"}`);
  console.log(
    `  amount: ${plan.amount} ${plan.token} (${formatUnits(plan.amountUnits, plan.token === "USDT" ? (isUsableSettlementToken(BOT_USDT) ? BOT_USDT.decimals : 6) : BOT_NATIVE_DECIMALS)} raw units)`,
  );

  const publicClient = createPublicClient({
    chain: botMainnet,
    transport: http(rpcUrl, { timeout: 15_000 }),
  });

  const liveChainId = await publicClient.getChainId();
  try {
    assertMainnetChain(liveChainId);
  } catch (err) {
    console.error(`ABORT: ${err instanceof Error ? err.message : err}`);
    process.exit(1);
  }

  const account = privateKeyToAccount(getBuilderPrivateKey()!);
  const walletClient = createWalletClient({
    chain: botMainnet,
    transport: http(rpcUrl, { timeout: 15_000 }),
    account,
  });

  let hash: `0x${string}`;
  if (plan.token === "USDT" && plan.tokenAddress) {
    hash = await walletClient.writeContract({
      address: plan.tokenAddress,
      abi: erc20Abi,
      functionName: "transfer",
      args: [plan.sender, plan.amountUnits],
      chain: botMainnet,
    });
  } else {
    hash = await walletClient.sendTransaction({
      to: plan.sender,
      value: plan.amountUnits,
      chain: botMainnet,
    });
  }

  console.log(`  transaction sent: ${hash}`);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log(`  status: ${receipt.status}`);
  console.log(`  explorer: ${BOT_CHAIN_EXPLORER_URL}/tx/${hash}`);
}

main().catch((err) => {
  console.error("WRITE PROOF FAILED:", err instanceof Error ? err.message : err);
  process.exit(1);
});
```

- [ ] **Step 3: Verify types and lint**

Run: `npx tsc --noEmit` and `npm run lint`. Expected: both exit 0.

- [ ] **Step 4: Verify the command is inert without opt-in**

Run: `npm run write-proof:mainnet`. Expected: exits 0 with `WRITE PROOF DISABLED: ...` and no transaction.

- [ ] **Step 5: Commit**

```bash
git add lib/chain/write-proof.ts scripts/mainnet-write-proof.ts
git commit -m "feat(chain): add opt-in mainnet write proof"
```

### Task 5: P0 Mainnet Doctor

**Files:**
- Create: `scripts/doctor-mainnet.ts`

**Interfaces:**
- Consumes: `botMainnet`, chain constants, `BOT_USDT`, `CANDIDATE_BOT_USDT_ADDRESS`, `getBuilderWallet`.
- Produces: a read-only structured report with network identity, RPC capability audit (including the expected `eth_getLogs` limitation), builder wallet readiness, and USDT on-chain investigation. Fails loudly (exit 1) if the live chain id is not 677.

- [ ] **Step 1: Create `scripts/doctor-mainnet.ts`**

```ts
import { createPublicClient, erc20Abi, formatUnits, http } from "viem";
import { existsSync } from "node:fs";
import {
  botMainnet,
  BOT_CHAIN_ID,
  BOT_CHAIN_RPC_URL,
  BOT_CHAIN_EXPLORER_URL,
  BOT_NATIVE_SYMBOL,
  BOT_NATIVE_DECIMALS,
} from "../lib/chain/bot-mainnet";
import {
  BOT_USDT,
  CANDIDATE_BOT_USDT_ADDRESS,
} from "../lib/chain/settlement-token";
import { getBuilderWallet } from "../lib/chain/builder-wallet";

for (const file of [".env", ".env.local"]) {
  if (existsSync(file)) {
    try {
      process.loadEnvFile(file);
    } catch {
      /* ignore invalid env files */
    }
  }
}

const rpcUrl = process.env.BOT_MAINNET_RPC_URL ?? BOT_CHAIN_RPC_URL;

const publicClient = createPublicClient({
  chain: botMainnet,
  transport: http(rpcUrl, { timeout: 15_000, retryCount: 0 }),
});

function section(title: string) {
  console.log(`\n== ${title} ==`);
}

function line(label: string, value: string) {
  console.log(`  ${label}: ${value}`);
}

async function probe(label: string, fn: () => Promise<unknown>) {
  try {
    const value = await fn();
    console.log(`  [${label}] OK`);
    return { ok: true as const, value };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.log(`  [${label}] ERROR ${message}`);
    return { ok: false as const, error: message };
  }
}

async function main() {
  section("NETWORK");
  line("expected chain id", String(BOT_CHAIN_ID));
  line("rpc", rpcUrl);
  line("explorer base url", BOT_CHAIN_EXPLORER_URL);
  line("native currency", `${BOT_NATIVE_SYMBOL} / ${BOT_NATIVE_DECIMALS} decimals`);

  const chainIdProbe = await probe("eth_chainId", () => publicClient.getChainId());
  line("RPC reachable", chainIdProbe.ok ? "YES" : "NO");
  if (!chainIdProbe.ok) {
    console.error("\nFATAL: RPC unreachable; cannot verify BOT Mainnet identity.");
    process.exit(1);
  }
  const chainId = Number(chainIdProbe.value);
  line("returned chain id", String(chainId));
  if (chainId !== BOT_CHAIN_ID) {
    console.error(`\nFATAL: RPC returned chain id ${chainId}, expected ${BOT_CHAIN_ID}. Refusing to continue.`);
    process.exit(1);
  }
  line("chain id check", "PASS (677)");

  const block = await probe("latest block", () => publicClient.getBlockNumber());
  if (block.ok) line("latest block number", block.value.toString());

  section("RPC CAPABILITY AUDIT");
  await probe("eth_getBalance", () =>
    publicClient.getBalance({ address: "0x0000000000000000000000000000000000000000" }),
  );
  await probe("eth_call (erc20 name on candidate)", () =>
    publicClient.readContract({
      address: CANDIDATE_BOT_USDT_ADDRESS,
      abi: erc20Abi,
      functionName: "name",
    }),
  );
  await probe("eth_getCode (candidate)", () =>
    publicClient.getCode({ address: CANDIDATE_BOT_USDT_ADDRESS }),
  );

  const logs = await probe("eth_getLogs", () =>
    publicClient.request({
      method: "eth_getLogs",
      params: [{ fromBlock: "latest", toBlock: "latest", address: CANDIDATE_BOT_USDT_ADDRESS }],
    }),
  );
  if (logs.ok) {
    line("HISTORICAL LOG INDEXING VIA OFFICIAL RPC", "SUPPORTED");
  } else {
    line("HISTORICAL LOG INDEXING VIA OFFICIAL RPC", "UNSUPPORTED");
    console.log("  implication: historical event indexing requires an approved third-party RPC/WebSocket/indexer/explorer (P7).");
  }

  section("BUILDER WALLET");
  const wallet = getBuilderWallet();
  if (!wallet.configured || !wallet.address) {
    line("BUILDER WALLET", "NOT CONFIGURED");
  } else {
    const bal = await probe("eth_getBalance (builder)", () =>
      publicClient.getBalance({ address: wallet.address as `0x${string}` }),
    );
    line("BUILDER WALLET", "CONFIGURED");
    line("  address", wallet.address);
    if (bal.ok) {
      const wei = BigInt(bal.value as bigint);
      line("  BOT balance", `${formatUnits(wei, BOT_NATIVE_DECIMALS)} BOT`);
      line("  balance non-zero", wei > 0n ? "YES" : "NO");
      line("  readiness (tiny tx)", wei > 0n ? "READY" : "INSUFFICIENT");
    }
  }

  section("USDT INVESTIGATION");
  line("candidate address", CANDIDATE_BOT_USDT_ADDRESS);

  const code = await probe("eth_getCode", () =>
    publicClient.getCode({ address: CANDIDATE_BOT_USDT_ADDRESS }),
  );
  const codeHex = code.ok ? String(code.value) : "";
  const hasCode = codeHex.length > 2;
  line("  code present", hasCode ? "YES" : "NO");

  if (hasCode) {
    const name = await probe("name()", () =>
      publicClient.readContract({ address: CANDIDATE_BOT_USDT_ADDRESS, abi: erc20Abi, functionName: "name" }),
    );
    const symbol = await probe("symbol()", () =>
      publicClient.readContract({ address: CANDIDATE_BOT_USDT_ADDRESS, abi: erc20Abi, functionName: "symbol" }),
    );
    const decimals = await probe("decimals()", () =>
      publicClient.readContract({ address: CANDIDATE_BOT_USDT_ADDRESS, abi: erc20Abi, functionName: "decimals" }),
    );
    const total = await probe("totalSupply()", () =>
      publicClient.readContract({ address: CANDIDATE_BOT_USDT_ADDRESS, abi: erc20Abi, functionName: "totalSupply" }),
    );
    if (name.ok) line("  name", String(name.value));
    if (symbol.ok) line("  symbol", String(symbol.value));
    if (decimals.ok) line("  decimals", String(decimals.value));
    if (total.ok) {
      const dec = decimals.ok ? Number(decimals.value) : 6;
      line("  total supply", `${formatUnits(BigInt(total.value as bigint), dec)}`);
    }
    if (wallet.configured && wallet.address) {
      const bal = await probe("balanceOf(builder)", () =>
        publicClient.readContract({
          address: CANDIDATE_BOT_USDT_ADDRESS,
          abi: erc20Abi,
          functionName: "balanceOf",
          args: [wallet.address],
        }),
      );
      if (bal.ok) {
        const dec = decimals.ok ? Number(decimals.value) : 6;
        line("  builder balance", `${formatUnits(BigInt(bal.value as bigint), dec)}`);
      }
    }
  }

  section("SETTLEMENT TOKEN STATUS");
  line("status", BOT_USDT.status);
  console.log("  note: final VERIFIED/PROVISIONALLY VERIFIED/UNRESOLVED/REJECTED decision is recorded in lib/chain/settlement-token.ts after all evidence is reviewed.");
}

main().catch((err) => {
  console.error("DOCTOR FAILED:", err instanceof Error ? err.message : err);
  process.exit(1);
});
```

- [ ] **Step 2: Verify types and lint**

Run: `npx tsc --noEmit` and `npm run lint`. Expected: both exit 0.

- [ ] **Step 3: Commit**

```bash
git add scripts/doctor-mainnet.ts
git commit -m "feat(scripts): add read-only mainnet doctor"
```

### Task 6: Deterministic Unit Tests

**Files:**
- Create: `vitest.config.ts`
- Create: `tests/unit/chain-config.test.ts`
- Create: `tests/unit/settlement-token.test.ts`
- Create: `tests/unit/write-proof.test.ts`
- Create: `tests/unit/env-safety.test.ts`

**Interfaces:**
- Consumes: `botMainnet`, chain constants, `BOT_USDT`, `isUsableSettlementToken`, `assertMainnetChain`, `parseWriteAmount`, `buildWriteProofPlan`, `BUILDER_PRIVATE_KEY_ENV`, `getBuilderWallet`.
- Produces: a deterministic unit suite that never touches the network.

- [ ] **Step 1: Create `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
    },
  },
  test: {
    include: ["tests/unit/**/*.test.ts"],
    environment: "node",
  },
});
```

- [ ] **Step 2: Create `tests/unit/chain-config.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import {
  botMainnet,
  BOT_CHAIN_ID,
  BOT_CHAIN_RPC_URL,
  BOT_CHAIN_EXPLORER_URL,
  BOT_NATIVE_SYMBOL,
  BOT_NATIVE_DECIMALS,
} from "@/lib/chain/bot-mainnet";
import { BOT_MAINNET_PROVENANCE } from "@/lib/chain/provenance";

describe("canonical BOT mainnet chain", () => {
  it("has chain id 677", () => {
    expect(botMainnet.id).toBe(677);
    expect(BOT_CHAIN_ID).toBe(677);
  });

  it("uses the BOT mainnet explorer", () => {
    expect(BOT_CHAIN_EXPLORER_URL).toBe("https://scan.botchain.ai");
    expect(botMainnet.blockExplorers?.default.url).toBe("https://scan.botchain.ai");
  });

  it("uses BOT with 18 decimals as native currency", () => {
    expect(BOT_NATIVE_SYMBOL).toBe("BOT");
    expect(BOT_NATIVE_DECIMALS).toBe(18);
    expect(botMainnet.nativeCurrency.symbol).toBe("BOT");
    expect(botMainnet.nativeCurrency.decimals).toBe(18);
  });

  it("is not a testnet", () => {
    expect(botMainnet.testnet).toBe(false);
  });

  it("does not claim official RPC log indexing", () => {
    expect(BOT_MAINNET_PROVENANCE.officialRpcIndexesLogs).toBe(false);
  });

  it("keeps the RPC URL consistent", () => {
    expect(BOT_MAINNET_PROVENANCE.rpcUrl).toBe(BOT_CHAIN_RPC_URL);
  });
});
```

- [ ] **Step 3: Create `tests/unit/settlement-token.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import {
  BOT_USDT,
  isUsableSettlementToken,
  type SettlementTokenRecord,
} from "@/lib/chain/settlement-token";

const VALID_STATUSES = ["VERIFIED", "PROVISIONALLY VERIFIED", "UNRESOLVED", "REJECTED"];

function record(status: SettlementTokenRecord["status"], overrides: Partial<SettlementTokenRecord> = {}): SettlementTokenRecord {
  return { address: "0x0000000000000000000000000000000000000001", symbol: "USDT", decimals: 6, status, verifiedAt: null, evidence: [], ...overrides };
}

describe("settlement token provenance", () => {
  it("records only one of the four valid statuses", () => {
    expect(VALID_STATUSES).toContain(BOT_USDT.status);
  });

  it("cannot treat an unresolved token as usable", () => {
    expect(isUsableSettlementToken(record("UNRESOLVED"))).toBe(false);
  });

  it("cannot treat a provisionally verified or rejected token as usable", () => {
    expect(isUsableSettlementToken(record("PROVISIONALLY VERIFIED"))).toBe(false);
    expect(isUsableSettlementToken(record("REJECTED"))).toBe(false);
  });

  it("treats only a fully verified token with address and decimals as usable", () => {
    expect(isUsableSettlementToken(record("VERIFIED"))).toBe(true);
    expect(isUsableSettlementToken(record("VERIFIED", { address: null }))).toBe(false);
    expect(isUsableSettlementToken(record("VERIFIED", { decimals: null }))).toBe(false);
  });

  it("does not silently treat the candidate as canonical", () => {
    if (BOT_USDT.status !== "VERIFIED") {
      expect(isUsableSettlementToken(BOT_USDT)).toBe(false);
    }
  });
});
```

- [ ] **Step 4: Create `tests/unit/write-proof.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import {
  assertMainnetChain,
  buildWriteProofPlan,
  parseWriteAmount,
  P0_ENABLE_MAINNET_WRITE_ENV,
  P0_WRITE_AMOUNT_ENV,
  P0_WRITE_TOKEN_ENV,
} from "@/lib/chain/write-proof";
import {
  BOT_USDT,
  type SettlementTokenRecord,
} from "@/lib/chain/settlement-token";

const KEY = "0x1111111111111111111111111111111111111111111111111111111111111111";

function unresolved(): SettlementTokenRecord {
  return { ...BOT_USDT, status: "UNRESOLVED" };
}

describe("write-proof guards", () => {
  it("refuses any chain other than 677", () => {
    expect(() => assertMainnetChain(1)).toThrow();
    expect(() => assertMainnetChain(0)).toThrow();
    expect(() => assertMainnetChain(677)).not.toThrow();
  });

  it("is disabled without the explicit opt-in", () => {
    const plan = buildWriteProofPlan({}, unresolved());
    expect(plan.enabled).toBe(false);
  });

  it("is disabled when opt-in is not 'true'", () => {
    const plan = buildWriteProofPlan({ [P0_ENABLE_MAINNET_WRITE_ENV]: "false" }, unresolved());
    expect(plan.enabled).toBe(false);
  });

  it("refuses an unresolved settlement token for USDT writes", () => {
    const plan = buildWriteProofPlan(
      { [P0_ENABLE_MAINNET_WRITE_ENV]: "true", [P0_WRITE_TOKEN_ENV]: "USDT", BOT_BUILDER_PRIVATE_KEY: KEY },
      unresolved(),
    );
    expect(plan.ok).toBe(false);
    if (!plan.ok) expect(plan.reason).toContain("VERIFIED");
  });

  it("refuses a rejected settlement token for USDT writes", () => {
    const rejected: SettlementTokenRecord = { ...BOT_USDT, status: "REJECTED" };
    const plan = buildWriteProofPlan(
      { [P0_ENABLE_MAINNET_WRITE_ENV]: "true", [P0_WRITE_TOKEN_ENV]: "USDT", BOT_BUILDER_PRIVATE_KEY: KEY },
      rejected,
    );
    expect(plan.ok).toBe(false);
  });

  it("allows a BOT self-transfer plan with a verified key and opt-in", () => {
    const plan = buildWriteProofPlan(
      { [P0_ENABLE_MAINNET_WRITE_ENV]: "true", BOT_BUILDER_PRIVATE_KEY: KEY, [P0_WRITE_AMOUNT_ENV]: "0.0001" },
      unresolved(),
    );
    expect(plan.ok).toBe(true);
    if (plan.ok) {
      expect(plan.chainId).toBe(677);
      expect(plan.token).toBe("BOT");
      expect(plan.amountUnits).toBeGreaterThan(0n);
    }
  });

  it("uses a small configurable amount and refuses large amounts", () => {
    const small = parseWriteAmount({ [P0_WRITE_AMOUNT_ENV]: "0.0001" });
    expect(small).toBeGreaterThan(0n);
    expect(() => parseWriteAmount({ [P0_WRITE_AMOUNT_ENV]: "5" })).toThrow();
  });

  it("never sends the full balance by design (no balance is read or used)", () => {
    expect(parseWriteAmount({ [P0_WRITE_AMOUNT_ENV]: "0.0001" })).toBe(100000000000000n);
  });
});
```

Note: `BOT_BUILDER_PRIVATE_KEY` is referenced as a string literal in the test env object; this is test-only and never read from a real secret.

- [ ] **Step 5: Create `tests/unit/env-safety.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  BUILDER_PRIVATE_KEY_ENV,
  getBuilderWallet,
} from "@/lib/chain/builder-wallet";
import { P0_ENABLE_MAINNET_WRITE_ENV, P0_WRITE_TOKEN_ENV } from "@/lib/chain/write-proof";

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) walk(full, out);
    else if (/\.(ts|tsx|js|mjs|mts)$/.test(entry)) out.push(full);
  }
  return out;
}

describe("env and secret safety", () => {
  it("does not expose the private key env var through NEXT_PUBLIC_*", () => {
    expect(BUILDER_PRIVATE_KEY_ENV.startsWith("NEXT_PUBLIC_")).toBe(false);
  });

  it("keeps server-only env names out of client code", () => {
    const secretNames = [BUILDER_PRIVATE_KEY_ENV, P0_ENABLE_MAINNET_WRITE_ENV, P0_WRITE_TOKEN_ENV];
    const clientDirs = ["app", "components", "public"];
    const offenders: string[] = [];
    for (const dir of clientDirs) {
      for (const file of walk(join(process.cwd(), dir))) {
        const content = readFileSync(file, "utf8");
        for (const name of secretNames) {
          if (content.includes(name)) offenders.push(`${file} -> ${name}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("returns an unconfigured wallet when no private key is present", () => {
    const wallet = getBuilderWallet({});
    expect(wallet.configured).toBe(false);
    expect(wallet.address).toBeNull();
  });

  it("does not export the raw private key from the wallet module", async () => {
    const mod = (await import("@/lib/chain/builder-wallet")) as Record<string, unknown>;
    const exported = Object.keys(mod);
    expect(exported).not.toContain("privateKey");
    expect(exported).not.toContain("key");
  });
});
```

- [ ] **Step 6: Run the new unit suite**

Run: `npm test`. Expected: all tests pass. Fix any failure before continuing. `getBuilderWallet` must be called with a clean env in the test process; if a real `.env` exists locally it must NOT define `BOT_BUILDER_PRIVATE_KEY`.

- [ ] **Step 7: Commit**

```bash
git add vitest.config.ts tests/unit
git commit -m "test(chain): add deterministic mainnet config and security tests"
```

### Task 7: Static Verification (No Network)

**Files:**
- Verify: all P0-created files.

**Interfaces:**
- Consumes: completed tasks 1-6.
- Produces: green unit tests, typecheck, lint, and production build.

- [ ] **Step 1: Run the full deterministic gate**

Run:

```bash
npm test
npx tsc --noEmit
npm run lint
```

Expected: all pass with exit 0.

- [ ] **Step 2: Run the production build**

Run: `npm run build`. Expected: exit 0 and all 14 routes build.

- [ ] **Step 3: Confirm no secrets are tracked**

Run: `git status --short` and `git check-ignore .env`. Expected: `.env` is ignored and no `.env*` file is staged.

- [ ] **Step 4: Commit any fixes**

If any file changed, stage and commit with a `fix(...)` message.

### Task 8: Live P0 Investigation And Token Decision

**Files:**
- Modify (as justified): `lib/chain/settlement-token.ts` (`BOT_USDT` symbol/decimals/status/verifiedAt/evidence)

**Interfaces:**
- Consumes: live BOT Mainnet RPC, public BOT Chain docs/BOT Scan evidence.
- Produces: a finalized `BOT_USDT` status decision and a completed live-doctor run.

- [ ] **Step 1: Run the live doctor**

Run: `npm run doctor:mainnet`. Record the full output. Expected (per BOT docs): RPC reachable, chain id 677, latest block number, and `HISTORICAL LOG INDEXING VIA OFFICIAL RPC: UNSUPPORTED`. If the RPC is unreachable from this environment, record that fact and keep `BOT_USDT` at `UNRESOLVED`; do not invent results.

- [ ] **Step 2: Gather authoritative ecosystem evidence for the candidate USDT address**

Use the repository's available tools to fetch and record, in order of authority:

1. BOT Chain official documentation (search for bridged USDT / canonical token list).
2. BOT Scan token page for `0xaBabc7Ddc03e501d190C676BF3d92ef0e6e87a3C` (note: expected to expose conflicting metadata).
3. BOT Bridge documentation.
4. BDEX/token-pair references.
5. Reputable external registries (only after the above).

Record every source URL and what it states. Do not infer canonical status solely from the `USDT` ticker.

- [ ] **Step 3: Decide and encode the status**

- If on-chain metadata (name/symbol/decimals) plus authoritative ecosystem evidence agree: set `BOT_USDT.symbol`, `decimals`, `status: "VERIFIED"`, `verifiedAt` (ISO date), and append evidence entries.
- If evidence is strong but not conclusive: `PROVISIONALLY VERIFIED`.
- If contradictory (expected per the brief: BOT Scan conflicting metadata vs external market association): keep `UNRESOLVED` and append the exact contradictions to `evidence`.
- If on-chain reads prove it is not USDT (e.g., wrong symbol, no code): `REJECTED`.

Never promote to `VERIFIED` purely to satisfy a test.

- [ ] **Step 4: Re-run the deterministic suite and doctor**

Run: `npm test`, `npx tsc --noEmit`, `npm run lint`, and `npm run doctor:mainnet` again. Expected: unit suite still passes (gate tests inject their own records), static checks pass, doctor prints the finalized status.

- [ ] **Step 5: Commit the finalized token decision**

```bash
git add lib/chain/settlement-token.ts
git commit -m "chore(chain): finalize P0 BOT mainnet USDT investigation"
```

### Task 9: Final Verification, State Update, And Completion Report

**Files:**
- Modify: `.agent-state/project-state.md`, `.agent-state/memory.md`, `.agent-state/left-off.md`

**Interfaces:**
- Consumes: all completed tasks.
- Produces: updated agent state and the P0 completion report.

- [ ] **Step 1: Run the full gate one final time**

Run: `npm test`, `npx tsc --noEmit`, `npm run lint`, `npm run build`. Record exact results.

- [ ] **Step 2: Re-run the doctor and capture the final report**

Run: `npm run doctor:mainnet`. Save the output for the completion report.

- [ ] **Step 3: Update agent state files**

Refresh `.agent-state/project-state.md`, `.agent-state/memory.md`, and `.agent-state/left-off.md` with: the P0 network-truth layer, the live RPC results, the USDT status decision, the write-proof opt-in requirement, and the next milestone (P1) note. Mark the `eth_getLogs` limitation as a known issue. Do not record secrets.

- [ ] **Step 4: Compile the completion report**

Report the 12 required items (files changed/created, findings, config installed, live RPC results, capability audit, wallet address + BOT balance if configured (never the key), USDT investigation details, contradictions, mock/fake-data inventory, the exact write-proof command prepared but not executed, test/typecheck/lint/build results, and manual steps for the user).

- [ ] **Step 5: Commit state updates**

```bash
git add .agent-state
git commit -m "docs(agent-state): record P0 mainnet reality check"
```