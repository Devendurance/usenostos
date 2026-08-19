import {
  createPublicClient,
  createWalletClient,
  encodeFunctionData,
  erc20Abi,
  formatUnits,
  http,
  type Abi,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  botTestnet,
  BOT_TESTNET_EXPLORER_URL,
  BOT_TESTNET_RPC_URL,
} from "@/lib/chain/bot-testnet";
import { getTestnetTreasuryPrivateKey } from "@/lib/chain/builder-wallet";
import { assertBotTestnetChain } from "@/lib/chain/guards";
import { nostosInstantPoolP6Abi } from "@/lib/contracts/nostos-instant-pool-p6-abi";
import {
  buildP6FeeClaimPlan,
  requireP6AccruedFees,
} from "@/scripts/registry/p6-plan";
import { sendP4Transaction, waitForP4Receipt } from "@/scripts/registry/p4-write";
import { loadScriptEnv } from "../load-script-env";

loadScriptEnv();

const ADDRESS_FILE = join(
  process.cwd(),
  "contracts",
  "addresses",
  "bot-testnet.json",
);
const USDT_DECIMALS = 6;

function readAddresses(): {
  p4?: { asyncVault?: string | null; redemptionTicket?: string | null };
  p5?: { instantPool?: string | null };
  p6?: { instantPool?: string | null; protocolTreasury?: string | null };
} {
  if (!existsSync(ADDRESS_FILE)) return {};
  return JSON.parse(readFileSync(ADDRESS_FILE, "utf8")) as never;
}

function asAddress(value: unknown): `0x${string}` {
  return String(value) as `0x${string}`;
}

function sameAddress(left: string, right: string): boolean {
  return left.toLowerCase() === right.toLowerCase();
}

function fmtUsdt(value: bigint): string {
  return `${formatUnits(value, USDT_DECIMALS)} USDT`;
}

async function main() {
  const addresses = readAddresses();
  const plan = buildP6FeeClaimPlan(process.env, addresses);
  if (!plan.enabled) {
    console.log(`P6 FEE CLAIM DISABLED: ${plan.reason}`);
    process.exit(0);
  }
  if (!plan.ok) {
    console.error(`P6 FEE CLAIM REFUSED: ${plan.reason}`);
    process.exit(1);
  }

  const publicClient = createPublicClient({
    chain: botTestnet,
    transport: http(BOT_TESTNET_RPC_URL, { timeout: 15_000 }),
  });
  assertBotTestnetChain(await publicClient.getChainId());

  const code = await publicClient.getBytecode({ address: plan.pool });
  if (!code || code === "0x") {
    throw new Error("P6 FEE CLAIM REFUSED: persisted p6.instantPool has no code.");
  }

  const [asset, vault, ticket, protocolTreasury] = await Promise.all([
    publicClient.readContract({
      address: plan.pool,
      abi: nostosInstantPoolP6Abi,
      functionName: "asset",
    }),
    publicClient.readContract({
      address: plan.pool,
      abi: nostosInstantPoolP6Abi,
      functionName: "vault",
    }),
    publicClient.readContract({
      address: plan.pool,
      abi: nostosInstantPoolP6Abi,
      functionName: "ticket",
    }),
    publicClient.readContract({
      address: plan.pool,
      abi: nostosInstantPoolP6Abi,
      functionName: "protocolTreasury",
    }),
  ]);
  if (!sameAddress(asAddress(asset), plan.asset)) {
    throw new Error(
      `P6 FEE CLAIM REFUSED: pool.asset() is ${String(asset)}, expected ${plan.asset}.`,
    );
  }
  if (!sameAddress(asAddress(vault), plan.vault)) {
    throw new Error(
      `P6 FEE CLAIM REFUSED: pool.vault() is ${String(vault)}, expected ${plan.vault}.`,
    );
  }
  if (!sameAddress(asAddress(ticket), plan.ticket)) {
    throw new Error(
      `P6 FEE CLAIM REFUSED: pool.ticket() is ${String(ticket)}, expected ${plan.ticket}.`,
    );
  }
  if (!sameAddress(asAddress(protocolTreasury), plan.protocolTreasury)) {
    throw new Error(
      `P6 FEE CLAIM REFUSED: pool.protocolTreasury() is ${String(protocolTreasury)}, expected ${plan.protocolTreasury}.`,
    );
  }

  const treasuryKey = getTestnetTreasuryPrivateKey();
  if (!treasuryKey) {
    throw new Error(
      "P6 FEE CLAIM REFUSED: treasury key disappeared after planning.",
    );
  }
  const account = privateKeyToAccount(treasuryKey as `0x${string}`);
  if (!sameAddress(account.address, plan.protocolTreasury)) {
    throw new Error(
      "P6 FEE CLAIM REFUSED: treasury signer does not match protocolTreasury().",
    );
  }
  if (!sameAddress(account.address, asAddress(protocolTreasury))) {
    throw new Error(
      "P6 FEE CLAIM REFUSED: treasury signer does not match on-chain protocolTreasury().",
    );
  }

  const [
    accruedBefore,
    lpNavBefore,
    availableBefore,
    cumulativeBefore,
    poolUsdtBefore,
    treasuryUsdtBefore,
  ] = await Promise.all([
    publicClient.readContract({
      address: plan.pool,
      abi: nostosInstantPoolP6Abi,
      functionName: "accruedProtocolFees",
    }),
    publicClient.readContract({
      address: plan.pool,
      abi: nostosInstantPoolP6Abi,
      functionName: "lpNav",
    }),
    publicClient.readContract({
      address: plan.pool,
      abi: nostosInstantPoolP6Abi,
      functionName: "availableLiquidity",
    }),
    publicClient.readContract({
      address: plan.pool,
      abi: nostosInstantPoolP6Abi,
      functionName: "cumulativeProtocolFees",
    }),
    publicClient.readContract({
      address: plan.asset,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [plan.pool],
    }),
    publicClient.readContract({
      address: plan.asset,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [plan.protocolTreasury],
    }),
  ]);

  const feesOk = requireP6AccruedFees(accruedBefore);
  if (!feesOk.ok) {
    throw new Error(`P6 FEE CLAIM REFUSED: ${feesOk.reason}`);
  }

  console.log("P6 PROTOCOL FEE CLAIM");
  console.log(`  pool: ${plan.pool}`);
  console.log(`  caller / treasury signer: ${account.address}`);
  console.log(`  protocolTreasury: ${plan.protocolTreasury}`);
  console.log(`  LP NAV before: ${lpNavBefore.toString()} (${fmtUsdt(lpNavBefore)})`);
  console.log(
    `  available liquidity before: ${availableBefore.toString()} (${fmtUsdt(availableBefore)})`,
  );
  console.log(
    `  pool raw USDT balance before: ${poolUsdtBefore.toString()} (${fmtUsdt(poolUsdtBefore)})`,
  );
  console.log(
    `  accruedProtocolFees before: ${accruedBefore.toString()} (${fmtUsdt(accruedBefore)})`,
  );
  console.log(
    `  cumulativeProtocolFees before: ${cumulativeBefore.toString()} (${fmtUsdt(cumulativeBefore)})`,
  );
  console.log(
    `  treasury USDT balance before: ${treasuryUsdtBefore.toString()} (${fmtUsdt(treasuryUsdtBefore)})`,
  );

  const walletClient = createWalletClient({
    chain: botTestnet,
    transport: http(BOT_TESTNET_RPC_URL),
    account,
  });
  const hash = await sendP4Transaction({
    publicClient,
    walletClient,
    account,
    chain: botTestnet,
    to: plan.pool,
    data: encodeFunctionData({
      abi: nostosInstantPoolP6Abi as Abi,
      functionName: "claimProtocolFees",
    }),
  });
  const receipt = await waitForP4Receipt(publicClient, hash, "p6 protocol fee claim");

  const [
    accruedAfter,
    lpNavAfter,
    availableAfter,
    cumulativeAfter,
    poolUsdtAfter,
    treasuryUsdtAfter,
  ] = await Promise.all([
    publicClient.readContract({
      address: plan.pool,
      abi: nostosInstantPoolP6Abi,
      functionName: "accruedProtocolFees",
    }),
    publicClient.readContract({
      address: plan.pool,
      abi: nostosInstantPoolP6Abi,
      functionName: "lpNav",
    }),
    publicClient.readContract({
      address: plan.pool,
      abi: nostosInstantPoolP6Abi,
      functionName: "availableLiquidity",
    }),
    publicClient.readContract({
      address: plan.pool,
      abi: nostosInstantPoolP6Abi,
      functionName: "cumulativeProtocolFees",
    }),
    publicClient.readContract({
      address: plan.asset,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [plan.pool],
    }),
    publicClient.readContract({
      address: plan.asset,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [plan.protocolTreasury],
    }),
  ]);

  const feeTransferred = treasuryUsdtAfter - treasuryUsdtBefore;
  console.log(`  tx: ${hash}`);
  console.log(`  status: ${receipt.status}`);
  console.log(`  BOT Scan URL: ${BOT_TESTNET_EXPLORER_URL}/tx/${hash}`);
  console.log(`  LP NAV after: ${lpNavAfter.toString()} (${fmtUsdt(lpNavAfter)})`);
  console.log(
    `  available liquidity after: ${availableAfter.toString()} (${fmtUsdt(availableAfter)})`,
  );
  console.log(
    `  pool raw USDT balance after: ${poolUsdtAfter.toString()} (${fmtUsdt(poolUsdtAfter)})`,
  );
  console.log(
    `  accruedProtocolFees after: ${accruedAfter.toString()} (${fmtUsdt(accruedAfter)})`,
  );
  console.log(
    `  cumulativeProtocolFees after: ${cumulativeAfter.toString()} (${fmtUsdt(cumulativeAfter)})`,
  );
  console.log(
    `  treasury USDT balance after: ${treasuryUsdtAfter.toString()} (${fmtUsdt(treasuryUsdtAfter)})`,
  );
  console.log(
    `  local feeTransferred: ${feeTransferred.toString()} (${fmtUsdt(feeTransferred)}) (not authoritative)`,
  );
  console.log(
    `  LP NAV invariant: ${lpNavBefore === lpNavAfter ? "HOLD (before == after)" : "BROKEN"}`,
  );
}

main().catch((err) => {
  console.error("P6 FEE CLAIM FAILED:", err instanceof Error ? err.message : err);
  process.exit(1);
});
