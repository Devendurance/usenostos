import {
  createPublicClient,
  createWalletClient,
  encodeDeployData,
  encodeFunctionData,
  http,
  type Abi,
} from "viem";
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
import {
  p4VaultAbi,
  p4VaultBytecode,
  redemptionTicketAbi,
  redemptionTicketBytecode,
} from "@/scripts/registry/artifact";
import { buildP4DeployPlan } from "@/scripts/registry/p4-plan";
import { sendP4Transaction, waitForP4Receipt } from "@/scripts/registry/p4-write";
import { loadScriptEnv } from "../load-script-env";

loadScriptEnv();

type AddressRecord = Record<string, unknown>;

const ADDRESS_FILE = join(
  process.cwd(),
  "contracts",
  "addresses",
  "bot-testnet.json",
);
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

function readAddresses(): AddressRecord {
  return existsSync(ADDRESS_FILE)
    ? (JSON.parse(readFileSync(ADDRESS_FILE, "utf8")) as AddressRecord)
    : {};
}

function persistAddresses(addresses: AddressRecord): void {
  const temporaryFile = `${ADDRESS_FILE}.p4.tmp`;
  writeFileSync(temporaryFile, `${JSON.stringify(addresses, null, 2)}\n`);
  renameSync(temporaryFile, ADDRESS_FILE);
}

function addressFrom(value: unknown, label: string): `0x${string}` | undefined {
  if (typeof value !== "string" || !/^0x[0-9a-fA-F]{40}$/.test(value)) {
    if (value !== undefined && value !== null) {
      throw new Error(`P4 DEPLOY REFUSED: invalid ${label} address.`);
    }
    return undefined;
  }
  return value as `0x${string}`;
}

function p4RecordFrom(addresses: AddressRecord): AddressRecord {
  const value = addresses.p4;
  if (value === undefined || value === null) return {};
  if (typeof value !== "object" || Array.isArray(value)) {
    throw new Error("P4 DEPLOY REFUSED: persisted p4 record is invalid.");
  }
  return { ...(value as AddressRecord) };
}

async function ensureDeployed(
  publicClient: ReturnType<typeof createPublicClient>,
  address: `0x${string}`,
  label: string,
): Promise<void> {
  const bytecode = await publicClient.getBytecode({ address });
  if (!bytecode || bytecode === "0x") {
    throw new Error(`P4 DEPLOY REFUSED: persisted ${label} has no contract code.`);
  }
}

async function main() {
  const plan = buildP4DeployPlan();
  if (!plan.enabled) {
    console.log(`P4 VAULT DEPLOY DISABLED: ${plan.reason}`);
    process.exit(0);
  }
  if (!plan.ok) {
    console.error(`P4 VAULT DEPLOY REFUSED: ${plan.reason}`);
    process.exit(1);
  }
  if (
    !p4VaultAbi ||
    !p4VaultBytecode ||
    !redemptionTicketAbi ||
    !redemptionTicketBytecode
  ) {
    throw new Error("P4 VAULT DEPLOY REFUSED: run forge build first.");
  }

  const addresses = readAddresses();
  const p4 = p4RecordFrom(addresses);
  const persistedVault = addressFrom(p4.asyncVault, "P4 vault");
  const persistedTicket = addressFrom(p4.redemptionTicket, "redemption ticket");
  if (!persistedVault && (persistedTicket || p4.configureTx || p4.configuredAt)) {
    throw new Error(
      "P4 DEPLOY REFUSED: ticket/configuration data exists without a P4 vault.",
    );
  }
  if (!persistedTicket && (p4.configureTx || p4.configuredAt)) {
    throw new Error(
      "P4 DEPLOY REFUSED: configuration data exists without a ticket.",
    );
  }
  if (
    persistedVault &&
    (!p4.asyncVaultTx || !p4.asyncVaultBlock || !p4.asyncVaultDeployedAt)
  ) {
    throw new Error("P4 DEPLOY REFUSED: P4 vault record is incomplete.");
  }
  if (
    persistedTicket &&
    (!p4.redemptionTicketTx ||
      !p4.redemptionTicketBlock ||
      !p4.redemptionTicketDeployedAt)
  ) {
    throw new Error("P4 DEPLOY REFUSED: ticket record is incomplete.");
  }
  if (
    (p4.configureTx && !p4.configuredAt) ||
    (p4.configuredAt && !p4.configureTx)
  ) {
    throw new Error("P4 DEPLOY REFUSED: configuration record is incomplete.");
  }

  const publicClient = createPublicClient({
    chain: botTestnet,
    transport: http(BOT_TESTNET_RPC_URL, { timeout: 15_000 }),
  });
  const liveChainId = await publicClient.getChainId();
  assertBotTestnetChain(liveChainId);

  const key = getTestnetPrivateKey();
  if (!key) {
    throw new Error("P4 VAULT DEPLOY REFUSED: Testnet key disappeared after planning.");
  }
  const account = privateKeyToAccount(key as `0x${string}`);
  const walletClient = createWalletClient({
    chain: botTestnet,
    transport: http(BOT_TESTNET_RPC_URL),
    account,
  });

  let vaultAddress = persistedVault;
  if (vaultAddress) {
    await ensureDeployed(publicClient, vaultAddress, "P4 vault");
    const asset = (await publicClient.readContract({
      address: vaultAddress,
      abi: p4VaultAbi as never,
      functionName: "asset",
    })) as `0x${string}`;
    if (asset.toLowerCase() !== plan.asset.toLowerCase()) {
      throw new Error("P4 DEPLOY REFUSED: persisted P4 vault uses a different asset.");
    }
    let configuredTicketBeforeDeployment: `0x${string}`;
    try {
      configuredTicketBeforeDeployment = (await publicClient.readContract({
        address: vaultAddress,
        abi: p4VaultAbi as never,
        functionName: "redemptionTicket",
      })) as `0x${string}`;
    } catch {
      throw new Error("P4 DEPLOY REFUSED: persisted vault is not a P4 vault.");
    }
    if (
      configuredTicketBeforeDeployment !== ZERO_ADDRESS &&
      (!persistedTicket ||
        configuredTicketBeforeDeployment.toLowerCase() !== persistedTicket.toLowerCase())
    ) {
      throw new Error("P4 DEPLOY REFUSED: persisted vault points to an unexpected ticket.");
    }
    console.log(`P4 vault already persisted: ${vaultAddress}`);
  } else {
    console.log("DEPLOYING NostosAsyncVaultP4");
    const hash = await sendP4Transaction({
      publicClient,
      walletClient,
      account,
      chain: botTestnet,
      data: encodeDeployData({
        abi: p4VaultAbi as Abi,
        bytecode: p4VaultBytecode,
        args: [plan.asset],
      }),
    });
    const receipt = await waitForP4Receipt(publicClient, hash, "vault deployment");
    vaultAddress = receipt.contractAddress ?? undefined;
    if (!vaultAddress) throw new Error("P4 VAULT DEPLOY FAILED: no contract address.");
    p4.asyncVault = vaultAddress;
    p4.asyncVaultTx = hash;
    p4.asyncVaultBlock = String(receipt.blockNumber);
    p4.asyncVaultDeployedAt = new Date().toISOString();
    addresses.p4 = p4;
    persistAddresses(addresses);
    console.log(`  tx: ${hash}`);
    console.log(`  block: ${receipt.blockNumber}`);
    console.log(`  vault: ${vaultAddress}`);
    console.log(`  explorer: ${BOT_TESTNET_EXPLORER_URL}/tx/${hash}`);
  }

  let ticketAddress = persistedTicket;
  if (ticketAddress) {
    await ensureDeployed(publicClient, ticketAddress, "redemption ticket");
    console.log(`redemption ticket already persisted: ${ticketAddress}`);
  } else {
    console.log("DEPLOYING NostosRedemptionTicket");
    const hash = await sendP4Transaction({
      publicClient,
      walletClient,
      account,
      chain: botTestnet,
      data: encodeDeployData({
        abi: redemptionTicketAbi as Abi,
        bytecode: redemptionTicketBytecode,
        args: [vaultAddress],
      }),
    });
    const receipt = await waitForP4Receipt(publicClient, hash, "ticket deployment");
    ticketAddress = receipt.contractAddress ?? undefined;
    if (!ticketAddress) throw new Error("TICKET DEPLOY FAILED: no contract address.");
    p4.redemptionTicket = ticketAddress;
    p4.redemptionTicketTx = hash;
    p4.redemptionTicketBlock = String(receipt.blockNumber);
    p4.redemptionTicketDeployedAt = new Date().toISOString();
    addresses.p4 = p4;
    persistAddresses(addresses);
    console.log(`  tx: ${hash}`);
    console.log(`  block: ${receipt.blockNumber}`);
    console.log(`  ticket: ${ticketAddress}`);
    console.log(`  explorer: ${BOT_TESTNET_EXPLORER_URL}/tx/${hash}`);
  }

  const boundVault = (await publicClient.readContract({
    address: ticketAddress,
    abi: redemptionTicketAbi as never,
    functionName: "vault",
  })) as `0x${string}`;
  if (boundVault.toLowerCase() !== vaultAddress.toLowerCase()) {
    throw new Error("P4 DEPLOY REFUSED: ticket is bound to another vault.");
  }

  const configuredTicket = (await publicClient.readContract({
    address: vaultAddress,
    abi: p4VaultAbi as never,
    functionName: "redemptionTicket",
  })) as `0x${string}`;
  if (configuredTicket === "0x0000000000000000000000000000000000000000") {
    console.log("CONFIGURING P4 redemption ticket");
    const hash = await sendP4Transaction({
      publicClient,
      walletClient,
      account,
      chain: botTestnet,
      to: vaultAddress,
      data: encodeFunctionData({
        abi: p4VaultAbi as Abi,
        functionName: "configureRedemptionTicket",
        args: [ticketAddress],
      }),
    });
    const receipt = await waitForP4Receipt(publicClient, hash, "ticket configuration");
    const configuredAfter = (await publicClient.readContract({
      address: vaultAddress,
      abi: p4VaultAbi as never,
      functionName: "redemptionTicket",
    })) as `0x${string}`;
    if (configuredAfter.toLowerCase() !== ticketAddress.toLowerCase()) {
      throw new Error("P4 DEPLOY REFUSED: ticket configuration was not confirmed on-chain.");
    }
    p4.configureTx = hash;
    p4.configuredAt = new Date().toISOString();
    addresses.p4 = p4;
    persistAddresses(addresses);
    console.log(`  tx: ${hash}`);
    console.log(`  block: ${receipt.blockNumber}`);
    console.log(`  explorer: ${BOT_TESTNET_EXPLORER_URL}/tx/${hash}`);
  } else if (configuredTicket.toLowerCase() !== ticketAddress.toLowerCase()) {
    throw new Error("P4 DEPLOY REFUSED: vault points to a different ticket.");
  } else if (!p4.configureTx || !p4.configuredAt) {
    throw new Error(
      "P4 DEPLOY REFUSED: vault is configured but configureTx is not persisted.",
    );
  } else {
    console.log(`P4 vault already configured with ticket: ${ticketAddress}`);
  }

  console.log(`P4 deployment record persisted to ${ADDRESS_FILE}`);
}

main().catch((err) => {
  console.error("P4 VAULT DEPLOY FAILED:", err instanceof Error ? err.message : err);
  process.exit(1);
});
