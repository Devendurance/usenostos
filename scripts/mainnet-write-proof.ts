import {
  createPublicClient,
  createWalletClient,
  erc20Abi,
  formatUnits,
  http,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import {
  botMainnet,
  BOT_CHAIN_RPC_URL,
  BOT_CHAIN_EXPLORER_URL,
  BOT_NATIVE_DECIMALS,
} from "../lib/chain/bot-mainnet";
import { getBuilderPrivateKey } from "../lib/chain/builder-wallet";
import {
  assertMainnetChain,
  buildWriteProofPlan,
  P0_ENABLE_MAINNET_WRITE_ENV,
} from "../lib/chain/write-proof";
import { BOT_USDT, isUsableSettlementToken } from "../lib/chain/settlement-token";
import { loadScriptEnv } from "./load-script-env";

loadScriptEnv();

const rpcUrl = process.env.BOT_MAINNET_RPC_URL ?? BOT_CHAIN_RPC_URL;

async function main() {
  const plan = buildWriteProofPlan();
  if (!plan.enabled) {
    console.log(`WRITE PROOF DISABLED: ${plan.reason}`);
    console.log(
      `Set ${P0_ENABLE_MAINNET_WRITE_ENV}=true only when you explicitly authorize a tiny transaction.`,
    );
    process.exit(0);
  }
  if (!plan.ok) {
    console.error(`WRITE PROOF REFUSED: ${plan.reason}`);
    process.exit(1);
  }

  console.log("MAINNET WRITE PROOF REQUESTED");
  console.log(`  chain: ${plan.chainId} (BOT Chain Mainnet)`);
  console.log(`  sender: ${plan.sender}`);
  console.log(`  token: ${plan.token}`);
  console.log(`  token address: ${plan.tokenAddress ?? "native (BOT)"}`);
  const decimals =
    plan.token === "USDT"
      ? isUsableSettlementToken(BOT_USDT)
        ? BOT_USDT.decimals
        : 6
      : BOT_NATIVE_DECIMALS;
  console.log(
    `  amount: ${plan.amount} ${plan.token} (${formatUnits(plan.amountUnits, decimals)} raw units)`,
  );

  const publicClient = createPublicClient({
    chain: botMainnet,
    transport: http(rpcUrl, { timeout: 15_000 }),
  });

  const liveChainId = await publicClient.getChainId();
  try {
    assertMainnetChain(liveChainId);
  } catch (err) {
    console.error(`ABORT: ${err instanceof Error ? err.message : err}`);
    process.exit(1);
  }

  const account = privateKeyToAccount(
    getBuilderPrivateKey() as `0x${string}`,
  );
  const walletClient = createWalletClient({
    chain: botMainnet,
    transport: http(rpcUrl, { timeout: 15_000 }),
    account,
  });

  let hash: `0x${string}`;
  if (plan.token === "USDT" && plan.tokenAddress) {
    hash = await walletClient.writeContract({
      address: plan.tokenAddress,
      abi: erc20Abi,
      functionName: "transfer",
      args: [plan.sender, plan.amountUnits],
      chain: botMainnet,
    });
  } else {
    hash = await walletClient.sendTransaction({
      to: plan.sender,
      value: plan.amountUnits,
      chain: botMainnet,
    });
  }

  console.log(`  transaction sent: ${hash}`);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log(`  status: ${receipt.status}`);
  console.log(`  explorer: ${BOT_CHAIN_EXPLORER_URL}/tx/${hash}`);
}

main().catch((err) => {
  console.error(
    "WRITE PROOF FAILED:",
    err instanceof Error ? err.message : err,
  );
  process.exit(1);
});