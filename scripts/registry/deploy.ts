import {
  createPublicClient,
  createWalletClient,
  http,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { readFileSync, writeFileSync } from "node:fs";
import { existsSync } from "node:fs";
import { join } from "node:path";
import {
  botTestnet,
  BOT_TESTNET_RPC_URL,
  BOT_TESTNET_EXPLORER_URL,
} from "@/lib/chain/bot-testnet";
import { getTestnetPrivateKey } from "@/lib/chain/builder-wallet";
import { assertBotTestnetChain } from "@/lib/chain/guards";
import { buildDeployPlan } from "@/scripts/registry/plan";
import { registryAbi, registryBytecode } from "@/scripts/registry/artifact";

async function main() {
  const plan = buildDeployPlan();
  if (!plan.enabled) {
    console.log(`DEPLOY DISABLED: ${plan.reason}`);
    process.exit(0);
  }
  if (!plan.ok) {
    console.error(`DEPLOY REFUSED: ${plan.reason}`);
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

  const account = privateKeyToAccount(getTestnetPrivateKey() as `0x${string}`);
  const walletClient = createWalletClient({
    chain: botTestnet,
    transport: http(BOT_TESTNET_RPC_URL),
    account,
  });

  console.log("DEPLOYING NostosRegistry");
  console.log(`  chain: ${plan.chainId} (BOT Testnet)`);
  console.log(`  deployer: ${plan.deployer}`);

  const hash = await walletClient.deployContract({
    abi: registryAbi,
    bytecode: registryBytecode,
    args: [plan.deployer],
    chain: botTestnet,
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  const registryAddress = receipt.contractAddress;
  console.log(`  tx: ${hash}`);
  console.log(`  block: ${receipt.blockNumber}`);
  console.log(`  registry: ${registryAddress}`);
  console.log(`  explorer: ${BOT_TESTNET_EXPLORER_URL}/tx/${hash}`);

  const file = join(
    process.cwd(),
    "contracts",
    "addresses",
    "bot-testnet.json",
  );
  const current = existsSync(file)
    ? (JSON.parse(readFileSync(file, "utf8")) as Record<string, unknown>)
    : {};
  writeFileSync(
    file,
    JSON.stringify(
      {
        ...current,
        registry: registryAddress,
        registryTx: hash,
        registryBlock: String(receipt.blockNumber),
        deployedAt: new Date().toISOString(),
      },
      null,
      2,
    ),
  );
  console.log(`  persisted to ${file}`);
}

main().catch((err) => {
  console.error("DEPLOY FAILED:", err instanceof Error ? err.message : err);
  process.exit(1);
});