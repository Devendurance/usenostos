import {
  createPublicClient,
  createWalletClient,
  encodeFunctionData,
  http,
  type Abi,
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
import { instantPoolAbi } from "@/scripts/registry/artifact";
import { buildP5DeployPlan } from "@/scripts/registry/p5-plan";
import { sendP4Transaction, waitForP4Receipt } from "@/scripts/registry/p4-write";
import { loadScriptEnv } from "../load-script-env";

loadScriptEnv();

async function main() {
  const rawTicketId = process.argv[2];
  if (!rawTicketId || !/^\d+$/.test(rawTicketId)) {
    console.error("usage: npm run harvest:instant-pool:testnet -- <ticketId>");
    process.exit(1);
  }
  const ticketId = BigInt(rawTicketId);

  const addresses = JSON.parse(
    readFileSync(join(process.cwd(), "contracts", "addresses", "bot-testnet.json"), "utf8"),
  ) as Record<string, unknown>;
  const poolAddress = (addresses.p5 as { instantPool?: string } | undefined)?.instantPool;
  if (!poolAddress || !/^0x[0-9a-fA-F]{40}$/.test(poolAddress)) {
    console.error("P5 HARVEST REFUSED: p5.instantPool address is required.");
    process.exit(1);
  }

  const plan = buildP5DeployPlan(process.env, addresses as never);
  if (!plan.enabled) {
    console.log(`P5 HARVEST DISABLED: ${plan.reason}`);
    process.exit(0);
  }
  if (!plan.ok) {
    console.error(`P5 HARVEST REFUSED: ${plan.reason}`);
    process.exit(1);
  }

  const publicClient = createPublicClient({
    chain: botTestnet,
    transport: http(BOT_TESTNET_RPC_URL, { timeout: 15_000 }),
  });
  assertBotTestnetChain(await publicClient.getChainId());

  const code = await publicClient.getBytecode({ address: poolAddress as `0x${string}` });
  if (!code || code === "0x") {
    console.error("P5 HARVEST REFUSED: persisted pool has no code.");
    process.exit(1);
  }

  const position = (await publicClient.readContract({
    address: poolAddress as `0x${string}`,
    abi: instantPoolAbi as never,
    functionName: "positions",
    args: [ticketId],
  })) as [bigint, bigint, `0x${string}`, bigint, bigint, bigint, bigint, bigint, number];
  const status = position[8];
  const statusName = ["ACTIVE", "SETTLED"][status] ?? "?";
  console.log(`P5 HARVEST POSITION #${ticketId.toString()}`);
  console.log(`  seller: ${position[2]}`);
  console.log(`  face value: ${position[3]}`);
  console.log(`  cost basis: ${position[4]}`);
  console.log(`  status: ${statusName}`);
  if (status !== 0) {
    console.error(`P5 HARVEST REFUSED: position is ${statusName}, not ACTIVE.`);
    process.exit(1);
  }

  const key = getTestnetPrivateKey();
  if (!key) {
    throw new Error("P5 HARVEST REFUSED: Testnet key disappeared after planning.");
  }
  const account = privateKeyToAccount(key as `0x${string}`);
  const walletClient = createWalletClient({
    chain: botTestnet,
    transport: http(BOT_TESTNET_RPC_URL),
    account,
  });

  console.log(`  caller: ${account.address} (permissionless)`);
  const hash = await sendP4Transaction({
    publicClient,
    walletClient,
    account,
    chain: botTestnet,
    to: poolAddress as `0x${string}`,
    data: encodeFunctionData({
      abi: instantPoolAbi as Abi,
      functionName: "harvest",
      args: [ticketId],
    }),
  });
  const receipt = await waitForP4Receipt(publicClient, hash, "harvest");
  console.log(`  tx: ${hash}`);
  console.log(`  status: ${receipt.status}`);
  console.log(`  explorer: ${BOT_TESTNET_EXPLORER_URL}/tx/${hash}`);
}

main().catch((err) => {
  console.error("P5 HARVEST FAILED:", err instanceof Error ? err.message : err);
  process.exit(1);
});
