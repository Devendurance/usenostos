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
import { erc20Abi } from "viem";
import { instantPoolAbi } from "@/scripts/registry/artifact";
import { buildP5DeployPlan } from "@/scripts/registry/p5-plan";
import { sendP4Transaction, waitForP4Receipt } from "@/scripts/registry/p4-write";
import { loadScriptEnv } from "../load-script-env";

loadScriptEnv();

async function main() {
  const rawAmount = process.argv[2];
  if (!rawAmount || !/^\d+$/.test(rawAmount)) {
    console.error("usage: npm run fund:instant-pool:testnet -- <amountUnits>");
    process.exit(1);
  }
  const amount = BigInt(rawAmount);

  const addresses = JSON.parse(
    readFileSync(join(process.cwd(), "contracts", "addresses", "bot-testnet.json"), "utf8"),
  ) as Record<string, unknown>;
  const poolAddress = (addresses.p5 as { instantPool?: string } | undefined)?.instantPool;
  if (!poolAddress || !/^0x[0-9a-fA-F]{40}$/.test(poolAddress)) {
    console.error("P5 FUND REFUSED: p5.instantPool address is required.");
    process.exit(1);
  }

  const plan = buildP5DeployPlan(process.env, addresses as never);
  if (!plan.enabled) {
    console.log(`P5 FUND DISABLED: ${plan.reason}`);
    process.exit(0);
  }
  if (!plan.ok) {
    console.error(`P5 FUND REFUSED: ${plan.reason}`);
    process.exit(1);
  }

  const publicClient = createPublicClient({
    chain: botTestnet,
    transport: http(BOT_TESTNET_RPC_URL, { timeout: 15_000 }),
  });
  assertBotTestnetChain(await publicClient.getChainId());

  const code = await publicClient.getBytecode({ address: poolAddress as `0x${string}` });
  if (!code || code === "0x") {
    console.error("P5 FUND REFUSED: persisted pool has no code.");
    process.exit(1);
  }

  const key = getTestnetPrivateKey();
  if (!key) {
    throw new Error("P5 FUND REFUSED: Testnet key disappeared after planning.");
  }
  const account = privateKeyToAccount(key as `0x${string}`);
  const walletClient = createWalletClient({
    chain: botTestnet,
    transport: http(BOT_TESTNET_RPC_URL),
    account,
  });

  const asset = (await publicClient.readContract({
    address: poolAddress as `0x${string}`,
    abi: instantPoolAbi as never,
    functionName: "asset",
  })) as `0x${string}`;
  if (asset.toLowerCase() !== plan.asset.toLowerCase()) {
    console.error("P5 FUND REFUSED: persisted pool uses a different asset.");
    process.exit(1);
  }

  const allowance = (await publicClient.readContract({
    address: plan.asset,
    abi: erc20Abi,
    functionName: "allowance",
    args: [account.address, poolAddress as `0x${string}`],
  })) as bigint;
  if (allowance < amount) {
    console.log("APPROVING pool to spend Testnet USDT");
    const approveHash = await sendP4Transaction({
      publicClient,
      walletClient,
      account,
      chain: botTestnet,
      to: plan.asset,
      data: encodeFunctionData({
        abi: erc20Abi as Abi,
        functionName: "approve",
        args: [poolAddress, amount],
      }),
    });
    await waitForP4Receipt(publicClient, approveHash, "fund approval");
    console.log(`  approve tx: ${approveHash}`);
    console.log(`  explorer: ${BOT_TESTNET_EXPLORER_URL}/tx/${approveHash}`);
  }

  console.log("FUNDING NostosInstantPool");
  const hash = await sendP4Transaction({
    publicClient,
    walletClient,
    account,
    chain: botTestnet,
    to: poolAddress as `0x${string}`,
    data: encodeFunctionData({
      abi: instantPoolAbi as Abi,
      functionName: "fund",
      args: [amount],
    }),
  });
  const receipt = await waitForP4Receipt(publicClient, hash, "pool funding");
  console.log(`  tx: ${hash}`);
  console.log(`  status: ${receipt.status}`);
  console.log(`  pool: ${poolAddress}`);
  console.log(`  amount: ${amount} USDT (6 dp)`);
  console.log(`  explorer: ${BOT_TESTNET_EXPLORER_URL}/tx/${hash}`);
}

main().catch((err) => {
  console.error("P5 FUND FAILED:", err instanceof Error ? err.message : err);
  process.exit(1);
});
