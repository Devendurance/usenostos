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
import { registryAbi } from "@/scripts/registry/artifact";
import { nostosAsyncVaultP4Abi } from "@/lib/contracts/nostos-async-vault-p4-abi";
import { nostosRedemptionTicketAbi } from "@/lib/contracts/nostos-redemption-ticket-abi";
import {
  buildP4DeployPlan,
  buildP4RegistrationPlan,
} from "@/scripts/registry/p4-plan";
import { sendP4Transaction, waitForP4Receipt } from "@/scripts/registry/p4-write";
import { loadScriptEnv } from "../load-script-env";

loadScriptEnv();

async function main() {
  const base = buildP4DeployPlan();
  if (!base.enabled) {
    console.log(`P4 REGISTER DISABLED: ${base.reason}`);
    process.exit(0);
  }
  if (!base.ok) {
    console.error(`P4 REGISTER REFUSED: ${base.reason}`);
    process.exit(1);
  }

  const addresses = JSON.parse(
    readFileSync(
      join(process.cwd(), "contracts", "addresses", "bot-testnet.json"),
      "utf8",
    ),
  ) as {
    registry?: string;
    p4?: { asyncVault?: string; redemptionTicket?: string };
  };
  const registryAddress = addresses.registry as `0x${string}` | undefined;
  const p4Vault = addresses.p4?.asyncVault;
  const ticket = addresses.p4?.redemptionTicket;
  if (!registryAddress || !p4Vault || !ticket) {
    console.error(
      "P4 REGISTER REFUSED: registry, p4.asyncVault, and p4.redemptionTicket addresses are required.",
    );
    process.exit(1);
  }

  const plan = buildP4RegistrationPlan(process.env, p4Vault);
  if (!plan.ok) {
    console.error(`P4 REGISTER REFUSED: ${plan.reason}`);
    process.exit(1);
  }

  const publicClient = createPublicClient({
    chain: botTestnet,
    transport: http(BOT_TESTNET_RPC_URL, { timeout: 15_000 }),
  });
  assertBotTestnetChain(await publicClient.getChainId());

  const configuredTicket = (await publicClient.readContract({
    address: p4Vault as `0x${string}`,
    abi: nostosAsyncVaultP4Abi,
    functionName: "redemptionTicket",
  })) as `0x${string}`;
  const boundVault = (await publicClient.readContract({
    address: ticket as `0x${string}`,
    abi: nostosRedemptionTicketAbi,
    functionName: "vault",
  })) as `0x${string}`;
  if (
    configuredTicket.toLowerCase() !== ticket.toLowerCase() ||
    boundVault.toLowerCase() !== p4Vault.toLowerCase()
  ) {
    throw new Error("P4 REGISTER REFUSED: vault and ticket binding is not confirmed on-chain.");
  }

  const key = getTestnetPrivateKey();
  if (!key) {
    throw new Error("P4 REGISTER REFUSED: Testnet key disappeared after planning.");
  }
  const account = privateKeyToAccount(key as `0x${string}`);
  const walletClient = createWalletClient({
    chain: botTestnet,
    transport: http(BOT_TESTNET_RPC_URL),
    account,
  });

  const exists = (await publicClient.readContract({
    address: registryAddress,
    abi: registryAbi,
    functionName: "exists",
    args: [plan.integrationId],
  })) as boolean;
  const functionName = exists ? "update" : "register";

  console.log(`P4 ${exists ? "UPDATING" : "REGISTERING"} demo vault in NostosRegistry`);
  console.log(`  chain: ${plan.chainId} (BOT Testnet)`);
  console.log(`  sender: ${plan.deployer}`);
  console.log(`  registry: ${registryAddress}`);
  console.log(`  p4Vault: ${plan.nostosVault}`);
  console.log(`  integrationId: ${plan.integrationId}`);
  console.log(`  metadataHash: ${plan.metadataHash}`);
  console.log(`  status: REDEMPTION_SUPPORTED (${plan.status})`);

  const hash = await sendP4Transaction({
    publicClient,
    walletClient,
    account,
    chain: botTestnet,
    to: registryAddress,
    data: encodeFunctionData({
      abi: registryAbi as Abi,
      functionName,
      args: [plan.integrationId, plan.nostosVault, plan.metadataHash, plan.status],
    }),
  });
  const receipt = await waitForP4Receipt(publicClient, hash, "registry update");
  console.log(`  tx: ${hash}`);
  console.log(`  status: ${receipt.status}`);
  console.log(`  explorer: ${BOT_TESTNET_EXPLORER_URL}/tx/${hash}`);
}

main().catch((err) => {
  console.error("P4 REGISTER FAILED:", err instanceof Error ? err.message : err);
  process.exit(1);
});
