import {
  createPublicClient,
  createWalletClient,
  encodeFunctionData,
  http,
  zeroAddress,
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
import { getTestnetPrivateKey } from "@/lib/chain/builder-wallet";
import { assertBotTestnetChain } from "@/lib/chain/guards";
import { nostosInstantPoolP6Abi } from "@/lib/contracts/nostos-instant-pool-p6-abi";
import { nostosAsyncVaultP4Abi } from "@/lib/contracts/nostos-async-vault-p4-abi";
import { nostosRedemptionTicketAbi } from "@/lib/contracts/nostos-redemption-ticket-abi";
import {
  buildP6HarvestPlan,
  parseP6HarvestTicketId,
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

const POSITION_ACTIVE = 0;
const REQUEST_CLAIMABLE = 2;
const PROTOCOL_FEE_BPS = BigInt(1000);
const BPS = BigInt(10_000);

const REQUEST_STATUS = ["NONE", "PENDING", "CLAIMABLE", "CLAIMED"] as const;
const POSITION_STATUS = ["ACTIVE", "SETTLED"] as const;

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

function asBigint(value: unknown): bigint {
  return BigInt(value as bigint | number | string);
}

function asStatus(value: unknown): number {
  return Number(value);
}

function tupleField(raw: unknown, index: number, key: string): unknown {
  if (Array.isArray(raw)) return raw[index];
  if (raw && typeof raw === "object") {
    return (raw as Record<string, unknown>)[key];
  }
  return undefined;
}

function positionStatusName(status: number): string {
  return POSITION_STATUS[status] ?? `UNKNOWN(${status})`;
}

function requestStatusName(status: number): string {
  return REQUEST_STATUS[status] ?? `UNKNOWN(${status})`;
}

function expectedSplit(faceValue: bigint, costBasis: bigint) {
  const grossSpread = faceValue - costBasis;
  const expectedProtocolFee = (grossSpread * PROTOCOL_FEE_BPS) / BPS;
  return {
    grossSpread,
    expectedProtocolFee,
    expectedLpProfit: grossSpread - expectedProtocolFee,
  };
}

function sameAddress(left: string, right: string): boolean {
  return left.toLowerCase() === right.toLowerCase();
}

async function main() {
  const parsedTicket = parseP6HarvestTicketId(process.argv[2]);
  if (!parsedTicket.ok) {
    console.error(parsedTicket.reason);
    process.exit(1);
  }

  const addresses = readAddresses();
  const plan = buildP6HarvestPlan(process.env, addresses, process.argv[2]);
  if (!plan.enabled) {
    console.log(`P6 HARVEST DISABLED: ${plan.reason}`);
    process.exit(0);
  }
  if (!plan.ok) {
    console.error(`P6 HARVEST REFUSED: ${plan.reason}`);
    process.exit(1);
  }

  const publicClient = createPublicClient({
    chain: botTestnet,
    transport: http(BOT_TESTNET_RPC_URL, { timeout: 15_000 }),
  });
  assertBotTestnetChain(await publicClient.getChainId());

  const code = await publicClient.getBytecode({ address: plan.pool });
  if (!code || code === "0x") {
    throw new Error("P6 HARVEST REFUSED: persisted p6.instantPool has no code.");
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
      `P6 HARVEST REFUSED: pool.asset() is ${String(asset)}, expected ${plan.asset}.`,
    );
  }
  if (!sameAddress(asAddress(vault), plan.vault)) {
    throw new Error(
      `P6 HARVEST REFUSED: pool.vault() is ${String(vault)}, expected ${plan.vault}.`,
    );
  }
  if (!sameAddress(asAddress(ticket), plan.ticket)) {
    throw new Error(
      `P6 HARVEST REFUSED: pool.ticket() is ${String(ticket)}, expected ${plan.ticket}.`,
    );
  }
  if (!sameAddress(asAddress(protocolTreasury), plan.protocolTreasury)) {
    throw new Error(
      `P6 HARVEST REFUSED: pool.protocolTreasury() is ${String(protocolTreasury)}, expected ${plan.protocolTreasury}.`,
    );
  }

  const rawPosition = await publicClient.readContract({
    address: plan.pool,
    abi: nostosInstantPoolP6Abi,
    functionName: "positions",
    args: [plan.ticketId],
  });
  const seller = asAddress(tupleField(rawPosition, 2, "seller"));
  const faceValue = asBigint(tupleField(rawPosition, 3, "faceValue"));
  const costBasis = asBigint(tupleField(rawPosition, 4, "costBasis"));
  const positionStatus = asStatus(tupleField(rawPosition, 8, "status"));
  if (
    seller.toLowerCase() === zeroAddress ||
    faceValue === BigInt(0) ||
    positionStatus !== POSITION_ACTIVE
  ) {
    throw new Error(
      `P6 HARVEST REFUSED: position is ${positionStatusName(positionStatus)}, not ACTIVE.`,
    );
  }

  let ticketOwner: string;
  try {
    ticketOwner = asAddress(
      await publicClient.readContract({
        address: plan.ticket,
        abi: nostosRedemptionTicketAbi,
        functionName: "ownerOf",
        args: [plan.ticketId],
      }),
    );
  } catch {
    throw new Error("P6 HARVEST REFUSED: ticket does not exist or is already burned.");
  }
  if (!sameAddress(ticketOwner, plan.pool)) {
    throw new Error(
      `P6 HARVEST REFUSED: ticket owner is ${ticketOwner}, expected P6 pool ${plan.pool}.`,
    );
  }

  const controller = asAddress(
    await publicClient.readContract({
      address: plan.vault,
      abi: nostosAsyncVaultP4Abi,
      functionName: "requestController",
      args: [plan.ticketId],
    }),
  );
  if (controller.toLowerCase() === zeroAddress) {
    throw new Error("P6 HARVEST REFUSED: underlying request is unknown.");
  }
  const rawRequest = await publicClient.readContract({
    address: plan.vault,
    abi: nostosAsyncVaultP4Abi,
    functionName: "requests",
    args: [plan.ticketId, controller],
  });
  const requestStatus = asStatus(tupleField(rawRequest, 8, "status"));
  if (requestStatus !== REQUEST_CLAIMABLE) {
    throw new Error(
      `P6 HARVEST REFUSED: underlying request is ${requestStatusName(requestStatus)}, not CLAIMABLE.`,
    );
  }

  const [
    lpNavBefore,
    availableBefore,
    outstandingFaceBefore,
    outstandingCostBefore,
    accruedFeesBefore,
  ] = await Promise.all([
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
      functionName: "outstandingFaceValue",
    }),
    publicClient.readContract({
      address: plan.pool,
      abi: nostosInstantPoolP6Abi,
      functionName: "outstandingCostBasis",
    }),
    publicClient.readContract({
      address: plan.pool,
      abi: nostosInstantPoolP6Abi,
      functionName: "accruedProtocolFees",
    }),
  ]);

  const split = expectedSplit(faceValue, costBasis);
  const key = getTestnetPrivateKey();
  if (!key) {
    throw new Error("P6 HARVEST REFUSED: Testnet key disappeared after planning.");
  }
  const account = privateKeyToAccount(key as `0x${string}`);

  console.log(`P6 HARVEST POSITION #${plan.ticketId.toString()}`);
  console.log(`  pool: ${plan.pool}`);
  console.log(`  caller: ${account.address} (permissionless)`);
  console.log(`  seller: ${seller}`);
  console.log(`  face value: ${faceValue.toString()}`);
  console.log(`  cost basis: ${costBasis.toString()}`);
  console.log(`  status: ${positionStatusName(positionStatus)}`);
  console.log(`  ticket owner: ${ticketOwner}`);
  console.log(`  underlying request status: ${requestStatusName(requestStatus)}`);
  console.log(`  LP NAV before: ${lpNavBefore.toString()}`);
  console.log(`  available liquidity before: ${availableBefore.toString()}`);
  console.log(`  outstanding face before: ${outstandingFaceBefore.toString()}`);
  console.log(`  outstanding cost before: ${outstandingCostBefore.toString()}`);
  console.log(`  accrued protocol fees before: ${accruedFeesBefore.toString()}`);
  console.log(`  local expected grossSpread: ${split.grossSpread.toString()} (not authoritative)`);
  console.log(
    `  local expectedProtocolFee: ${split.expectedProtocolFee.toString()} (floor 10%, not authoritative)`,
  );
  console.log(`  local expectedLpProfit: ${split.expectedLpProfit.toString()} (not authoritative)`);

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
      functionName: "harvest",
      args: [plan.ticketId],
    }),
  });
  const receipt = await waitForP4Receipt(publicClient, hash, "p6 harvest");

  const rawPositionAfter = await publicClient.readContract({
    address: plan.pool,
    abi: nostosInstantPoolP6Abi,
    functionName: "positions",
    args: [plan.ticketId],
  });
  const statusAfter = asStatus(tupleField(rawPositionAfter, 8, "status"));

  let ticketBurned = false;
  let ownerAfter: string | undefined;
  try {
    ownerAfter = asAddress(
      await publicClient.readContract({
        address: plan.ticket,
        abi: nostosRedemptionTicketAbi,
        functionName: "ownerOf",
        args: [plan.ticketId],
      }),
    );
  } catch {
    ticketBurned = true;
  }

  const [
    lpNavAfter,
    availableAfter,
    outstandingFaceAfter,
    outstandingCostAfter,
    cumulativeGrossSpread,
    accruedFeesAfter,
    cumulativeProtocolFees,
  ] = await Promise.all([
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
      functionName: "outstandingFaceValue",
    }),
    publicClient.readContract({
      address: plan.pool,
      abi: nostosInstantPoolP6Abi,
      functionName: "outstandingCostBasis",
    }),
    publicClient.readContract({
      address: plan.pool,
      abi: nostosInstantPoolP6Abi,
      functionName: "cumulativeGrossSpread",
    }),
    publicClient.readContract({
      address: plan.pool,
      abi: nostosInstantPoolP6Abi,
      functionName: "accruedProtocolFees",
    }),
    publicClient.readContract({
      address: plan.pool,
      abi: nostosInstantPoolP6Abi,
      functionName: "cumulativeProtocolFees",
    }),
  ]);

  console.log(`  tx: ${hash}`);
  console.log(`  status: ${receipt.status}`);
  console.log(`  BOT Scan URL: ${BOT_TESTNET_EXPLORER_URL}/tx/${hash}`);
  console.log(
    `  ticket burned / ownerOf no longer exists: ${ticketBurned ? "YES" : `NO (${ownerAfter})`}`,
  );
  console.log(`  position status: ${positionStatusName(statusAfter)}`);
  console.log(`  LP NAV after: ${lpNavAfter.toString()}`);
  console.log(`  available liquidity after: ${availableAfter.toString()}`);
  console.log(`  outstanding face after: ${outstandingFaceAfter.toString()}`);
  console.log(`  outstanding cost after: ${outstandingCostAfter.toString()}`);
  console.log(`  cumulative gross spread: ${cumulativeGrossSpread.toString()}`);
  console.log(`  accrued protocol fees: ${accruedFeesAfter.toString()}`);
  console.log(`  cumulative protocol fees: ${cumulativeProtocolFees.toString()}`);
}

main().catch((err) => {
  console.error("P6 HARVEST FAILED:", err instanceof Error ? err.message : err);
  process.exit(1);
});
