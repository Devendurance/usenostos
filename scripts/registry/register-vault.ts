import { createPublicClient, createWalletClient, http } from "viem";
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
import { buildVaultRegistrationPlan } from "@/scripts/registry/vault-plan";
import { registryAbi } from "@/scripts/registry/artifact";
import { loadScriptEnv } from "../load-script-env";

loadScriptEnv();

async function main() {
  const addresses = JSON.parse(
    readFileSync(
      join(process.cwd(), "contracts", "addresses", "bot-testnet.json"),
      "utf8",
    ),
  ) as { registry?: string; asyncVault?: string };
  const registryAddress = addresses.registry as `0x${string}` | undefined;
  const vaultAddress = addresses.asyncVault as `0x${string}` | undefined;
  if (!registryAddress || !vaultAddress) {
    console.error(
      "REGISTER-VAULT REFUSED: need both registry and asyncVault addresses persisted.",
    );
    process.exit(1);
  }

  const plan = buildVaultRegistrationPlan(process.env, vaultAddress);
  if (!plan.enabled) {
    console.log(`REGISTER-VAULT DISABLED: ${plan.reason}`);
    process.exit(0);
  }
  if (!plan.ok) {
    console.error(`REGISTER-VAULT REFUSED: ${plan.reason}`);
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

  console.log(`REGISTERING demo vault in NostosRegistry`);
  console.log(`  chain: ${plan.chainId} (BOT Testnet)`);
  console.log(`  sender: ${plan.deployer}`);
  console.log(`  registry: ${registryAddress}`);
  console.log(`  integrationId: ${plan.integrationId}`);
  console.log(`  metadataHash: ${plan.metadataHash}`);
  console.log(`  nostosVault: ${plan.nostosVault}`);
  console.log(`  status: REDEMPTION_SUPPORTED (${plan.status})`);

  let hash: `0x${string}`;
  try {
    hash = await walletClient.writeContract({
      address: registryAddress,
      abi: registryAbi,
      functionName: "register",
      args: [plan.integrationId, plan.nostosVault, plan.metadataHash, plan.status],
      chain: botTestnet,
    });
  } catch {
    // Already registered -> update in place.
    hash = await walletClient.writeContract({
      address: registryAddress,
      abi: registryAbi,
      functionName: "update",
      args: [plan.integrationId, plan.nostosVault, plan.metadataHash, plan.status],
      chain: botTestnet,
    });
  }
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log(`  tx: ${hash}`);
  console.log(`  status: ${receipt.status}`);
  console.log(`  explorer: ${BOT_TESTNET_EXPLORER_URL}/tx/${hash}`);
}

main().catch((err) => {
  console.error("REGISTER-VAULT FAILED:", err instanceof Error ? err.message : err);
  process.exit(1);
});