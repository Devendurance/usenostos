import { createPublicClient, createWalletClient, encodeDeployData, http, type Abi } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  botTestnet,
  BOT_TESTNET_EXPLORER_URL,
  BOT_TESTNET_RPC_URL,
} from "@/lib/chain/bot-testnet";
import { getTestnetPrivateKey } from "@/lib/chain/builder-wallet";
import { assertBotTestnetChain } from "@/lib/chain/guards";
import { instantPoolAbi, instantPoolBytecode } from "@/scripts/registry/artifact";
import { buildP5DeployPlan } from "@/scripts/registry/p5-plan";
import { sendP4Transaction, waitForP4Receipt } from "@/scripts/registry/p4-write";
import { loadScriptEnv } from "../load-script-env";

loadScriptEnv();

const ADDRESS_FILE = join(process.cwd(), "contracts", "addresses", "bot-testnet.json");

async function main() {
  const current = existsSync(ADDRESS_FILE)
    ? (JSON.parse(readFileSync(ADDRESS_FILE, "utf8")) as Record<string, unknown>)
    : {};
  const plan = buildP5DeployPlan(process.env, current as never);
  if (!plan.enabled) {
    console.log(`P5 INSTANT POOL DEPLOY DISABLED: ${plan.reason}`);
    process.exit(0);
  }
  if (!plan.ok) {
    console.error(`P5 INSTANT POOL DEPLOY REFUSED: ${plan.reason}`);
    process.exit(1);
  }
  if (!instantPoolAbi || !instantPoolBytecode) {
    throw new Error("P5 INSTANT POOL DEPLOY REFUSED: run forge build first.");
  }

  const p5 = (current.p5 ?? {}) as Record<string, unknown>;
  const persistedPool =
    typeof p5.instantPool === "string" && /^0x[0-9a-fA-F]{40}$/.test(p5.instantPool)
      ? (p5.instantPool as `0x${string}`)
      : undefined;
  if (
    persistedPool &&
    (!p5.instantPoolTx || !p5.instantPoolBlock || !p5.instantPoolDeployedAt)
  ) {
    throw new Error("P5 INSTANT POOL DEPLOY REFUSED: persisted p5 record is incomplete.");
  }

  const publicClient = createPublicClient({
    chain: botTestnet,
    transport: http(BOT_TESTNET_RPC_URL, { timeout: 15_000 }),
  });
  assertBotTestnetChain(await publicClient.getChainId());

  if (persistedPool) {
    const code = await publicClient.getBytecode({ address: persistedPool });
    if (!code || code === "0x") {
      throw new Error("P5 INSTANT POOL DEPLOY REFUSED: persisted pool has no code.");
    }
    console.log(`P5 instant pool already persisted: ${persistedPool}`);
  } else {
    const key = getTestnetPrivateKey();
    if (!key) {
      throw new Error("P5 INSTANT POOL DEPLOY REFUSED: Testnet key disappeared after planning.");
    }
    const account = privateKeyToAccount(key as `0x${string}`);
    const walletClient = createWalletClient({
      chain: botTestnet,
      transport: http(BOT_TESTNET_RPC_URL),
      account,
    });
    console.log("DEPLOYING NostosInstantPool");
    console.log(`  chain: ${plan.chainId} (BOT Testnet)`);
    console.log(`  deployer: ${account.address}`);
    console.log(`  asset: ${plan.asset} (verified Testnet USDT)`);
    console.log(`  vault: ${plan.vault}`);
    console.log(`  ticket: ${plan.ticket}`);
    const hash = await sendP4Transaction({
      publicClient,
      walletClient,
      account,
      chain: botTestnet,
      data: encodeDeployData({
        abi: instantPoolAbi as Abi,
        bytecode: instantPoolBytecode,
        args: [plan.asset, plan.vault, plan.ticket],
      }),
    });
    const receipt = await waitForP4Receipt(publicClient, hash, "instant pool deployment");
    const poolAddress = receipt.contractAddress;
    if (!poolAddress) {
      throw new Error("P5 INSTANT POOL DEPLOY FAILED: no contract address.");
    }
    const temporaryFile = `${ADDRESS_FILE}.p5.tmp`;
    writeFileSync(
      temporaryFile,
      JSON.stringify(
        {
          ...current,
          p5: {
            ...p5,
            instantPool: poolAddress,
            instantPoolTx: hash,
            instantPoolBlock: String(receipt.blockNumber),
            instantPoolDeployedAt: new Date().toISOString(),
          },
        },
        null,
        2,
      ) + "\n",
    );
    renameSync(temporaryFile, ADDRESS_FILE);
    console.log(`  tx: ${hash}`);
    console.log(`  block: ${receipt.blockNumber}`);
    console.log(`  pool: ${poolAddress}`);
    console.log(`  explorer: ${BOT_TESTNET_EXPLORER_URL}/tx/${hash}`);
  }
}

main().catch((err) => {
  console.error("P5 INSTANT POOL DEPLOY FAILED:", err instanceof Error ? err.message : err);
  process.exit(1);
});
