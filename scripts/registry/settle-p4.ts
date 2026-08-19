import {
  createPublicClient,
  createWalletClient,
  encodeFunctionData,
  formatUnits,
  http,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  botTestnet,
  BOT_TESTNET_EXPLORER_URL,
  BOT_TESTNET_RPC_URL,
} from "@/lib/chain/bot-testnet";
import { getTestnetPrivateKey } from "@/lib/chain/builder-wallet";
import { assertBotTestnetChain } from "@/lib/chain/guards";
import { nostosAsyncVaultP4Abi } from "@/lib/contracts/nostos-async-vault-p4-abi";
import { redemptionTicketAbi } from "@/scripts/registry/artifact";
import { buildP4SettlementPlan } from "@/scripts/registry/p4-plan";
import { sendP4Transaction, waitForP4Receipt } from "@/scripts/registry/p4-write";
import { loadScriptEnv } from "../load-script-env";

loadScriptEnv();

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

async function main() {
  const rawRequestId = process.argv[2];
  if (!rawRequestId || !/^\d+$/.test(rawRequestId)) {
    console.error("usage: npm run settle:request:p4:testnet -- <requestId>");
    process.exit(1);
  }
  const requestId = BigInt(rawRequestId);

  const addresses = JSON.parse(
    readFileSync(
      join(process.cwd(), "contracts", "addresses", "bot-testnet.json"),
      "utf8",
    ),
  ) as { p4?: { asyncVault?: string; redemptionTicket?: string } };
  const plan = buildP4SettlementPlan(
    process.env,
    addresses.p4?.asyncVault,
    addresses.p4?.redemptionTicket,
    requestId,
  );
  if (!plan.enabled) {
    console.log(`P4 SETTLE DISABLED: ${plan.reason}`);
    process.exit(0);
  }
  if (!plan.ok) {
    console.error(`P4 SETTLE REFUSED: ${plan.reason}`);
    process.exit(1);
  }

  const publicClient = createPublicClient({
    chain: botTestnet,
    transport: http(BOT_TESTNET_RPC_URL, { timeout: 15_000 }),
  });
  assertBotTestnetChain(await publicClient.getChainId());

  const configuredTicket = (await publicClient.readContract({
    address: plan.p4Vault,
    abi: nostosAsyncVaultP4Abi,
    functionName: "redemptionTicket",
  })) as `0x${string}`;
  const boundVault = (await publicClient.readContract({
    address: plan.ticket,
    abi: redemptionTicketAbi as never,
    functionName: "vault",
  })) as `0x${string}`;
  if (
    configuredTicket.toLowerCase() !== plan.ticket.toLowerCase() ||
    boundVault.toLowerCase() !== plan.p4Vault.toLowerCase()
  ) {
    console.error("P4 SETTLE REFUSED: vault and ticket binding is not confirmed on-chain.");
    process.exit(1);
  }

  let ticketOwner: `0x${string}`;
  try {
    ticketOwner = (await publicClient.readContract({
      address: plan.ticket,
      abi: redemptionTicketAbi as never,
      functionName: "ownerOf",
      args: [plan.requestId],
    })) as `0x${string}`;
  } catch {
    console.error(
      `P4 SETTLE REFUSED: ticket #${plan.requestId.toString()} is not minted or has already been burned.`,
    );
    process.exit(1);
  }

  const controller = (await publicClient.readContract({
    address: plan.p4Vault,
    abi: nostosAsyncVaultP4Abi,
    functionName: "requestController",
    args: [plan.requestId],
  })) as `0x${string}`;
  if (controller === ZERO_ADDRESS) {
    console.error(`P4 SETTLE REFUSED: request #${plan.requestId} does not exist.`);
    process.exit(1);
  }

  const request = (await publicClient.readContract({
    address: plan.p4Vault,
    abi: nostosAsyncVaultP4Abi,
    functionName: "requests",
    args: [plan.requestId, controller],
  })) as [bigint, `0x${string}`, `0x${string}`, bigint, bigint, bigint, bigint, bigint, number];
  const shares = request[3];
  const status = request[8];
  const statusName = ["None", "PENDING", "CLAIMABLE", "CLAIMED"][status] ?? "?";

  console.log(`P4 SETTLE REQUEST #${plan.requestId.toString()}`);
  console.log(`  controller: ${controller}`);
  console.log(`  ticket: ${plan.ticket}`);
  console.log(`  ticket owner: ${ticketOwner}`);
  console.log(`  shares: ${formatUnits(shares, 6)}`);
  console.log(`  status: ${statusName}`);
  if (status !== 1) {
    console.error(`P4 SETTLE REFUSED: request is ${statusName}, not PENDING.`);
    process.exit(1);
  }

  const assets = (await publicClient.readContract({
    address: plan.p4Vault,
    abi: nostosAsyncVaultP4Abi,
    functionName: "sharesToAssets",
    args: [shares],
  })) as bigint;
  const totalAssets = (await publicClient.readContract({
    address: plan.p4Vault,
    abi: nostosAsyncVaultP4Abi,
    functionName: "totalAssets",
  })) as bigint;
  const reserved = (await publicClient.readContract({
    address: plan.p4Vault,
    abi: nostosAsyncVaultP4Abi,
    functionName: "reservedClaimableAssets",
  })) as bigint;
  const unreserved = totalAssets - reserved;
  console.log(`  required assets: ${formatUnits(assets, 6)} USDT`);
  console.log(`  vault assets: ${formatUnits(totalAssets, 6)} USDT`);
  console.log(`  reserved (claimable): ${formatUnits(reserved, 6)} USDT`);
  console.log(`  unreserved: ${formatUnits(unreserved, 6)} USDT`);
  if (assets > unreserved) {
    console.error(
      `P4 SETTLE REFUSED: insufficient unreserved liquidity (need ${formatUnits(assets, 6)} USDT, have ${formatUnits(unreserved, 6)} USDT).`,
    );
    process.exit(1);
  }

  const key = getTestnetPrivateKey();
  if (!key) {
    throw new Error("P4 SETTLE REFUSED: Testnet key disappeared after planning.");
  }
  const account = privateKeyToAccount(key as `0x${string}`);
  const walletClient = createWalletClient({
    chain: botTestnet,
    transport: http(BOT_TESTNET_RPC_URL),
    account,
  });
  console.log(`  settler: ${account.address}`);
  const hash = await sendP4Transaction({
    publicClient,
    walletClient,
    account,
    chain: botTestnet,
    to: plan.p4Vault,
    data: encodeFunctionData({
      abi: nostosAsyncVaultP4Abi,
      functionName: "settleRequest",
      args: [plan.requestId],
    }),
  });
  const receipt = await waitForP4Receipt(publicClient, hash, "settlement");
  console.log(`  tx: ${hash}`);
  console.log(`  status: ${receipt.status}`);
  console.log(`  explorer: ${BOT_TESTNET_EXPLORER_URL}/tx/${hash}`);
}

main().catch((err) => {
  console.error("P4 SETTLE FAILED:", err instanceof Error ? err.message : err);
  process.exit(1);
});
