import { createPublicClient, createWalletClient, http, formatUnits } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  botTestnet,
  BOT_TESTNET_RPC_URL,
  BOT_TESTNET_EXPLORER_URL,
} from "@/lib/chain/bot-testnet";
import { getTestnetPrivateKey } from "@/lib/chain/builder-wallet";
import { assertBotTestnetChain } from "@/lib/chain/guards";
import { nostosAsyncVaultAbi } from "@/lib/contracts/nostos-async-vault-abi";
import { buildVaultDeployPlan } from "@/scripts/registry/vault-plan";
import { loadScriptEnv } from "../load-script-env";

loadScriptEnv();

async function main() {
  const plan = buildVaultDeployPlan();
  if (!plan.enabled) {
    console.log(`SETTLE DISABLED: ${plan.reason}`);
    process.exit(0);
  }
  if (!plan.ok) {
    console.error(`SETTLE REFUSED: ${plan.reason}`);
    process.exit(1);
  }

  const rawRequestId = process.argv[2];
  if (!rawRequestId || !/^\d+$/.test(rawRequestId)) {
    console.error("usage: npm run settle:request:testnet -- <requestId>");
    process.exit(1);
  }
  const requestId = BigInt(rawRequestId);

  const addresses = JSON.parse(
    readFileSync(
      join(process.cwd(), "contracts", "addresses", "bot-testnet.json"),
      "utf8",
    ),
  ) as { asyncVault?: string };
  const vaultAddress = addresses.asyncVault as `0x${string}` | undefined;
  if (!vaultAddress) {
    console.error(
      "SETTLE REFUSED: no asyncVault address persisted. Deploy first.",
    );
    process.exit(1);
  }

  const publicClient = createPublicClient({
    chain: botTestnet,
    transport: http(BOT_TESTNET_RPC_URL, { timeout: 15_000 }),
  });
  const liveChainId = await publicClient.getChainId();
  try {
    assertBotTestnetChain(liveChainId);
  } catch (err) {
    console.error(`ABORT: ${err instanceof Error ? err.message : err}`);
    process.exit(1);
  }

  const controller = (await publicClient.readContract({
    address: vaultAddress,
    abi: nostosAsyncVaultAbi,
    functionName: "requestController",
    args: [requestId],
  })) as `0x${string}`;
  if (controller === "0x0000000000000000000000000000000000000000") {
    console.error(`SETTLE REFUSED: request #${requestId} does not exist.`);
    process.exit(1);
  }

  const request = (await publicClient.readContract({
    address: vaultAddress,
    abi: nostosAsyncVaultAbi,
    functionName: "requests",
    args: [requestId, controller],
  })) as [bigint, `0x${string}`, `0x${string}`, bigint, bigint, bigint, bigint, bigint, number];

  const shares = request[3];
  const status = request[8];
  const statusName = ["None", "PENDING", "CLAIMABLE", "CLAIMED"][status] ?? "?";
  const decimals = 6;

  console.log(`SETTLE REQUEST #${requestId.toString()}`);
  console.log(`  controller: ${controller}`);
  console.log(`  shares: ${formatUnits(shares, decimals)}`);
  console.log(`  status: ${statusName}`);
  if (status !== 1) {
    console.error(`SETTLE REFUSED: request is ${statusName}, not PENDING.`);
    process.exit(1);
  }

  const assets = (await publicClient.readContract({
    address: vaultAddress,
    abi: nostosAsyncVaultAbi,
    functionName: "sharesToAssets",
    args: [shares],
  })) as bigint;
  const totalAssets = (await publicClient.readContract({
    address: vaultAddress,
    abi: nostosAsyncVaultAbi,
    functionName: "totalAssets",
  })) as bigint;
  const reserved = (await publicClient.readContract({
    address: vaultAddress,
    abi: nostosAsyncVaultAbi,
    functionName: "reservedClaimableAssets",
  })) as bigint;
  const unreserved = totalAssets - reserved;

  console.log(`  required assets: ${formatUnits(assets, decimals)} USDT`);
  console.log(`  vault assets: ${formatUnits(totalAssets, decimals)} USDT`);
  console.log(`  reserved (claimable): ${formatUnits(reserved, decimals)} USDT`);
  console.log(`  unreserved: ${formatUnits(unreserved, decimals)} USDT`);

  if (assets > unreserved) {
    console.error(
      `SETTLE REFUSED: insufficient unreserved liquidity (need ${formatUnits(assets, decimals)} USDT, have ${formatUnits(unreserved, decimals)} USDT).`,
    );
    process.exit(1);
  }

  const account = privateKeyToAccount(getTestnetPrivateKey() as `0x${string}`);
  const walletClient = createWalletClient({
    chain: botTestnet,
    transport: http(BOT_TESTNET_RPC_URL),
    account,
  });

  console.log(`  settler: ${account.address}`);
  const hash = await walletClient.writeContract({
    address: vaultAddress,
    abi: nostosAsyncVaultAbi,
    functionName: "settleRequest",
    args: [requestId],
    chain: botTestnet,
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log(`  tx: ${hash}`);
  console.log(`  status: ${receipt.status}`);
  console.log(`  explorer: ${BOT_TESTNET_EXPLORER_URL}/tx/${hash}`);
}

main().catch((err) => {
  console.error("SETTLE FAILED:", err instanceof Error ? err.message : err);
  process.exit(1);
});