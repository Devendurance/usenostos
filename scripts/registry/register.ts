import {
  createPublicClient,
  createWalletClient,
  http,
} from "viem";
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
import { buildRegistrationPlan } from "@/scripts/registry/plan";
import { registryAbi } from "@/scripts/registry/artifact";

async function main() {
  const slugs = process.argv.slice(2);
  if (slugs.length === 0) {
    console.error("usage: npm run register:rwa:testnet -- ousg tbill");
    process.exit(1);
  }

  const plan = buildRegistrationPlan(process.env, slugs[0]);
  if (!plan.enabled) {
    console.log(`REGISTER DISABLED: ${plan.reason}`);
    process.exit(0);
  }
  if (!plan.ok) {
    console.error(`REGISTER REFUSED: ${plan.reason}`);
    process.exit(1);
  }

  const addressesFile = join(
    process.cwd(),
    "contracts",
    "addresses",
    "bot-testnet.json",
  );
  const addresses = JSON.parse(
    readFileSync(addressesFile, "utf8"),
  ) as { registry?: string };
  if (!addresses.registry) {
    console.error(
      "REGISTER REFUSED: no registry address persisted. Run deploy:registry:testnet first.",
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

  const account = privateKeyToAccount(getTestnetPrivateKey() as `0x${string}`);
  const walletClient = createWalletClient({
    chain: botTestnet,
    transport: http(BOT_TESTNET_RPC_URL),
    account,
  });

  for (const slug of slugs) {
    const p = buildRegistrationPlan(process.env, slug);
    if (!p.ok) {
      console.error(`REGISTER REFUSED (${slug}): ${p.reason}`);
      process.exit(1);
    }
    console.log(`REGISTERING ${p.slug}`);
    console.log(`  chain: ${p.chainId} (BOT Testnet)`);
    console.log(`  sender: ${p.deployer}`);
    console.log(`  registry: ${addresses.registry}`);
    console.log(`  integrationId: ${p.integrationId}`);
    console.log(`  metadataHash: ${p.metadataHash}`);
    console.log(`  nostosVault: ${p.nostosVault} (DISCOVERY_ONLY)`);

    const hash = await walletClient.writeContract({
      address: addresses.registry as `0x${string}`,
      abi: registryAbi,
      functionName: "register",
      args: [p.integrationId, p.nostosVault, p.metadataHash, 0],
      chain: botTestnet,
    });
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    console.log(`  tx: ${hash}`);
    console.log(`  status: ${receipt.status}`);
    console.log(`  explorer: ${BOT_TESTNET_EXPLORER_URL}/tx/${hash}`);
  }
}

main().catch((err) => {
  console.error("REGISTER FAILED:", err instanceof Error ? err.message : err);
  process.exit(1);
});