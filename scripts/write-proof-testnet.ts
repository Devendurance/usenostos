import { createPublicClient, formatUnits, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import {
  botTestnet,
  BOT_TESTNET_RPC_URL,
  BOT_TESTNET_EXPLORER_URL,
} from "../lib/chain/bot-testnet";
import { getTestnetPrivateKey } from "../lib/chain/builder-wallet";
import { assertBotTestnetChain } from "../lib/chain/guards";
import {
  buildTestnetWriteProofPlan,
  P0_ENABLE_TESTNET_WRITE_ENV,
} from "../lib/chain/write-proof-testnet";
import { sampleTestnetRpcHealth } from "../lib/chain/testnet-rpc-health";
import {
  classifyFunds,
  estimateRequiredBalance,
  formatPreflightReport,
  isAlreadyKnownError,
  isInsufficientFundsError,
  MAX_SEND_RETRIES,
  NATIVE_TRANSFER_GAS_LIMIT,
  runIdempotentBroadcast,
  signedTransactionHash,
} from "../lib/chain/testnet-write";
import { loadScriptEnv } from "./load-script-env";

loadScriptEnv();

const rpcUrl = process.env.BOT_TESTNET_RPC_URL ?? BOT_TESTNET_RPC_URL;

async function main() {
  const plan = buildTestnetWriteProofPlan();
  if (!plan.enabled) {
    console.log(`TESTNET WRITE PROOF DISABLED: ${plan.reason}`);
    console.log(
      `Set ${P0_ENABLE_TESTNET_WRITE_ENV}=true only when you explicitly authorize a tiny tBOT transaction.`,
    );
    process.exit(0);
  }
  if (!plan.ok) {
    console.error(`TESTNET WRITE PROOF REFUSED: ${plan.reason}`);
    process.exit(1);
  }

  const publicClient = createPublicClient({
    chain: botTestnet,
    transport: http(rpcUrl, { timeout: 15_000 }),
  });

  const liveChainId = await publicClient.getChainId();
  try {
    assertBotTestnetChain(liveChainId);
  } catch (err) {
    console.error(`ABORT: ${err instanceof Error ? err.message : err}`);
    process.exit(1);
  }

  const account = privateKeyToAccount(getTestnetPrivateKey() as `0x${string}`);
  const sender = account.address;
  const value = plan.amountUnits;

  console.log("TESTNET WRITE PROOF REQUESTED");
  console.log(`  chain: ${plan.chainId} (BOT Chain Testnet)`);
  console.log(`  sender: ${sender}`);
  console.log(`  token: ${plan.token}`);
  console.log(
    `  amount: ${plan.amount} tBOT (${formatUnits(value, 18)} raw units)`,
  );

  const health = await sampleTestnetRpcHealth({
    client: publicClient,
    address: sender,
  });
  const latestBlock = health.maxBlock;
  const freshest = health.samples.reduce((a, b) =>
    b.block >= a.block ? b : a,
  );
  const balance =
    freshest.balance ??
    (await publicClient.getBalance({ address: sender }));
  const nonce =
    freshest.nonce ??
    Number(
      await publicClient.getTransactionCount({ address: sender }),
    );

  const eip1559 = await publicClient
    .estimateFeesPerGas({ type: "eip1559" })
    .catch(() => null);
  const gasPrice = eip1559
    ? eip1559.maxFeePerGas
    : await publicClient.getGasPrice();
  const required = estimateRequiredBalance(
    value,
    NATIVE_TRANSFER_GAS_LIMIT,
    gasPrice,
  );

  const fundCheck = classifyFunds(health, balance, required);
  console.log(
    formatPreflightReport({
      chainId: plan.chainId,
      sender,
      latestBlock,
      balance,
      nonce,
      gasPriceWei: eip1559 ? null : gasPrice,
      maxFeePerGasWei: eip1559 ? gasPrice : null,
      value,
      gasLimit: NATIVE_TRANSFER_GAS_LIMIT,
      required,
    }),
  );
  console.log(`  RPC HEALTH: ${health.status}`);
  console.log(`  FUND CHECK: ${fundCheck.kind}`);

  if (fundCheck.kind === "INSUFFICIENT_FUNDS") {
    console.log("\nINSUFFICIENT TESTNET FUNDS");
    console.log(
      "  All sampled RPC backends agree the wallet lacks enough tBOT for the value plus gas.",
    );
    console.log(
      "  Claim tBOT from the official faucet: https://faucet.botchain.ai/basic",
    );
    process.exit(1);
  }

  const staleSuspected =
    health.status === "STALE_BACKENDS_DETECTED" ||
    fundCheck.kind === "POSSIBLE_STALE_RPC_BACKEND";

  const serialized = await account.signTransaction({
    chainId: plan.chainId,
    to: sender,
    value,
    gas: NATIVE_TRANSFER_GAS_LIMIT,
    nonce,
    ...(eip1559
      ? {
          type: "eip1559" as const,
          maxFeePerGas: eip1559.maxFeePerGas,
          maxPriorityFeePerGas: eip1559.maxPriorityFeePerGas,
        }
      : {
          type: "legacy" as const,
          gasPrice,
        }),
  });
  const hash = signedTransactionHash(serialized);
  console.log(`  signed transaction hash: ${hash}`);

  const broadcast = async (
    raw: `0x${string}`,
    txHash: `0x${string}`,
    attempt: number,
  ): Promise<`0x${string}`> => {
    try {
      return await publicClient.sendRawTransaction({
        serializedTransaction: raw,
      });
    } catch (err) {
      if (isAlreadyKnownError(err)) {
        const receipt = await publicClient
          .getTransactionReceipt({ hash: txHash })
          .catch(() => null);
        if (receipt) return txHash;
        throw new Error(
          `transaction already broadcast (attempt ${attempt}); awaiting confirmation`,
        );
      }
      throw err;
    }
  };

  const { attempts, result, error } = await runIdempotentBroadcast({
    raw: serialized,
    hash,
    broadcast,
    maxAttempts: MAX_SEND_RETRIES,
    isRetryable: (err) => isInsufficientFundsError(err) && staleSuspected,
  });

  if (!result) {
    if (error && isInsufficientFundsError(error)) {
      if (staleSuspected) {
        console.error("\nPOSSIBLE STALE RPC BACKEND");
        console.error(
          "  The broadcast repeatedly reported insufficient funds while sampled RPC state suggested funds exist.",
        );
        console.error(
          "  Re-run the proof, or wait for a synchronized backend before trying again.",
        );
      } else {
        console.error("\nINSUFFICIENT TESTNET FUNDS");
        console.error(
          "  Claim tBOT from the official faucet: https://faucet.botchain.ai/basic",
        );
      }
    } else {
      console.error(
        "TESTNET WRITE PROOF FAILED:",
        error instanceof Error ? error.message : error,
      );
    }
    process.exit(1);
  }

  console.log(`  broadcast accepted after ${attempts} attempt(s)`);
  console.log(`  transaction sent: ${hash}`);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log(`  status: ${receipt.status}`);
  console.log(`  explorer: ${BOT_TESTNET_EXPLORER_URL}/tx/${hash}`);
}

main().catch((err) => {
  console.error(
    "TESTNET WRITE PROOF FAILED:",
    err instanceof Error ? err.message : err,
  );
  process.exit(1);
});