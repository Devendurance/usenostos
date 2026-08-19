import {
  createPublicClient,
  createWalletClient,
  encodeDeployData,
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
  instantPoolP6Abi,
  instantPoolP6Bytecode,
} from "@/scripts/registry/artifact";
import { buildP6DeployPlan } from "@/scripts/registry/p6-plan";
import { sendP4Transaction, waitForP4Receipt } from "@/scripts/registry/p4-write";
import { loadScriptEnv } from "../load-script-env";

loadScriptEnv();

const ADDRESS_FILE = join(
  process.cwd(),
  "contracts",
  "addresses",
  "bot-testnet.json",
);

const BINDING_FNS = ["asset", "vault", "ticket", "protocolTreasury"] as const;

async function main() {
  const current = existsSync(ADDRESS_FILE)
    ? (JSON.parse(readFileSync(ADDRESS_FILE, "utf8")) as Record<string, unknown>)
    : {};
  const plan = buildP6DeployPlan(process.env, current as never);
  if (!plan.enabled) {
    console.log(`P6 INSTANT POOL DEPLOY DISABLED: ${plan.reason}`);
    process.exit(0);
  }
  if (!plan.ok) {
    console.error(`P6 INSTANT POOL DEPLOY REFUSED: ${plan.reason}`);
    process.exit(1);
  }
  if (!instantPoolP6Abi || !instantPoolP6Bytecode) {
    throw new Error("P6 INSTANT POOL DEPLOY REFUSED: run forge build first.");
  }

  const p6 = (current.p6 ?? {}) as Record<string, unknown>;
  const persistedPool =
    typeof p6.instantPool === "string" &&
    /^0x[0-9a-fA-F]{40}$/.test(p6.instantPool)
      ? (p6.instantPool as `0x${string}`)
      : undefined;
  if (
    persistedPool &&
    (!p6.instantPoolTx || !p6.instantPoolBlock || !p6.instantPoolDeployedAt)
  ) {
    throw new Error(
      "P6 INSTANT POOL DEPLOY REFUSED: persisted p6 record is incomplete.",
    );
  }

  const publicClient = createPublicClient({
    chain: botTestnet,
    transport: http(BOT_TESTNET_RPC_URL, { timeout: 15_000 }),
  });
  assertBotTestnetChain(await publicClient.getChainId());

  if (persistedPool) {
    const code = await publicClient.getBytecode({ address: persistedPool });
    if (!code || code === "0x") {
      throw new Error(
        "P6 INSTANT POOL DEPLOY REFUSED: persisted pool has no code.",
      );
    }
    console.log(`P6 instant pool already persisted: ${persistedPool}`);
  } else {
    const key = getTestnetPrivateKey();
    if (!key) {
      throw new Error(
        "P6 INSTANT POOL DEPLOY REFUSED: Testnet key disappeared after planning.",
      );
    }
    const account = privateKeyToAccount(key as `0x${string}`);
    const walletClient = createWalletClient({
      chain: botTestnet,
      transport: http(BOT_TESTNET_RPC_URL),
      account,
    });
    console.log("DEPLOYING NostosInstantPoolP6");
    console.log(`  chain: ${plan.chainId} (BOT Testnet)`);
    console.log(`  deployer: ${account.address}`);
    console.log(`  asset: ${plan.asset} (verified Testnet USDT)`);
    console.log(`  vault: ${plan.vault}`);
    console.log(`  ticket: ${plan.ticket}`);
    console.log(`  protocolTreasury: ${plan.protocolTreasury}`);
    const hash = await sendP4Transaction({
      publicClient,
      walletClient,
      account,
      chain: botTestnet,
      data: encodeDeployData({
        abi: instantPoolP6Abi as Abi,
        bytecode: instantPoolP6Bytecode,
        args: [plan.asset, plan.vault, plan.ticket, plan.protocolTreasury],
      }),
    });
    const receipt = await waitForP4Receipt(
      publicClient,
      hash,
      "instant pool p6 deployment",
    );
    const poolAddress = receipt.contractAddress;
    if (!poolAddress) {
      throw new Error("P6 INSTANT POOL DEPLOY FAILED: no contract address.");
    }
    const code = await publicClient.getBytecode({ address: poolAddress });
    if (!code || code === "0x") {
      throw new Error(
        "P6 INSTANT POOL DEPLOY REFUSED: deployed pool has no code.",
      );
    }
    const expected = {
      asset: plan.asset,
      vault: plan.vault,
      ticket: plan.ticket,
      protocolTreasury: plan.protocolTreasury,
    };
    for (const fn of BINDING_FNS) {
      const actual = await publicClient.readContract({
        address: poolAddress,
        abi: instantPoolP6Abi as Abi,
        functionName: fn,
      });
      if (String(actual).toLowerCase() !== expected[fn].toLowerCase()) {
        throw new Error(
          `P6 INSTANT POOL DEPLOY REFUSED: ${fn}() is ${String(actual)}, expected ${expected[fn]}.`,
        );
      }
    }
    const temporaryFile = `${ADDRESS_FILE}.p6.tmp`;
    writeFileSync(
      temporaryFile,
      JSON.stringify(
        {
          ...current,
          p6: {
            instantPool: poolAddress,
            instantPoolTx: hash,
            instantPoolBlock: String(receipt.blockNumber),
            instantPoolDeployedAt: new Date().toISOString(),
            protocolTreasury: plan.protocolTreasury,
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
  console.error(
    "P6 INSTANT POOL DEPLOY FAILED:",
    err instanceof Error ? err.message : err,
  );
  process.exit(1);
});
