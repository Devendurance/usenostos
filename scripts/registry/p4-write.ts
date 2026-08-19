import {
  keccak256,
  type Account,
  type Address,
  type Chain,
  type Hex,
  type PublicClient,
  type Transport,
  type WalletClient,
} from "viem";
import {
  isAlreadyKnownError,
  runIdempotentBroadcast,
} from "@/lib/chain/testnet-write";
import { sampleTestnetRpcHealth } from "@/lib/chain/testnet-rpc-health";
import type { RpcHealthResult } from "@/lib/chain/testnet-rpc-health";

export function assertP4RpcHealth(
  health: Pick<
    RpcHealthResult,
    "status" | "nonceConsistent" | "balanceConsistent" | "staleReasons"
  >,
): void {
  if (health.status === "STALE_BACKENDS_DETECTED") {
    throw new Error(
      `P4 transaction refused: stale RPC backends detected (${health.staleReasons.join("; ")})`,
    );
  }
  if (!health.nonceConsistent) {
    throw new Error("P4 transaction refused: nonce samples are inconsistent");
  }
  if (!health.balanceConsistent) {
    throw new Error("P4 transaction refused: balance samples are inconsistent");
  }
}

export function assertSuccessfulReceipt(
  receipt: { status: string },
  operation: string,
): void {
  if (receipt.status !== "success") {
    throw new Error(`P4 ${operation} transaction reverted`);
  }
}

export async function waitForP4Receipt(
  publicClient: PublicClient,
  hash: Hex,
  operation: string,
) {
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  assertSuccessfulReceipt(receipt, operation);
  return receipt;
}

export async function sendP4Transaction<
  publicTransport extends Transport,
  walletTransport extends Transport,
  chainType extends Chain,
  accountType extends Account,
>({
  publicClient,
  walletClient,
  account,
  chain,
  to,
  data,
}: {
  publicClient: PublicClient<publicTransport, chainType>;
  walletClient: WalletClient<walletTransport, chainType, accountType>;
  account: accountType;
  chain: chainType;
  to?: Address;
  data?: Hex;
}): Promise<Hex> {
  const health = await sampleTestnetRpcHealth({
    client: publicClient as PublicClient,
    address: account.address,
  });
  assertP4RpcHealth(health);

  const request = await walletClient.prepareTransactionRequest({
    account,
    chain,
    ...(to ? { to } : {}),
    ...(data ? { data } : {}),
  } as never);
  const serialized = await walletClient.signTransaction(request as never);
  const hash = keccak256(serialized);
  const broadcast = await runIdempotentBroadcast({
    raw: serialized,
    hash,
    maxAttempts: 5,
    isRetryable: () => true,
    broadcast: async (raw) => {
      try {
        return await publicClient.sendRawTransaction({
          serializedTransaction: raw,
        });
      } catch (error) {
        if (isAlreadyKnownError(error)) {
          const receipt = await publicClient
            .getTransactionReceipt({ hash })
            .catch(() => null);
          if (receipt) return hash;
        }
        throw error;
      }
    },
  });
  if (!broadcast.result) {
    const knownReceipt = await publicClient
      .getTransactionReceipt({ hash })
      .catch(() => null);
    const knownTransaction = knownReceipt
      ? true
      : Boolean(await publicClient.getTransaction({ hash }).catch(() => null));
    if (knownTransaction) return hash;
    throw new Error(
      `P4 transaction ${hash} was not accepted after ${broadcast.attempts} broadcast attempt(s).`,
    );
  }
  return hash;
}
