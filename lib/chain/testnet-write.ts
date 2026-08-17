import { keccak256 } from "viem";
import type { RpcHealthResult } from "./testnet-rpc-health";

export const NATIVE_TRANSFER_GAS_LIMIT = BigInt(21000);
export const MAX_SEND_RETRIES = 5;
const RETRY_DELAY_MS = 300;

export function estimateRequiredBalance(
  value: bigint,
  gasLimit: bigint,
  feePerGas: bigint,
): bigint {
  return value + gasLimit * feePerGas;
}

export type FundCheckKind =
  | "SUFFICIENT"
  | "INSUFFICIENT_FUNDS"
  | "POSSIBLE_STALE_RPC_BACKEND";

export interface FundCheckResult {
  kind: FundCheckKind;
  balance: bigint;
  required: bigint;
  reason: string;
}

export function classifyFunds(
  health: RpcHealthResult,
  balance: bigint,
  required: bigint,
): FundCheckResult {
  if (balance >= required) {
    return {
      kind: "SUFFICIENT",
      balance,
      required,
      reason: "balance covers value plus gas",
    };
  }
  if (health.maxBalance !== null && health.maxBalance >= required) {
    return {
      kind: "POSSIBLE_STALE_RPC_BACKEND",
      balance,
      required,
      reason: `current sample shows ${balance} but another sample reported ${health.maxBalance}; likely a stale RPC backend`,
    };
  }
  return {
    kind: "INSUFFICIENT_FUNDS",
    balance,
    required,
    reason:
      "all sampled RPC backends agree the balance is below the required amount",
  };
}

export function isInsufficientFundsError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return /insufficient funds/i.test(message);
}

export function isAlreadyKnownError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return /already known|known transaction|nonce too low/i.test(message);
}

export interface IdempotentBroadcastOptions<T> {
  raw: `0x${string}`;
  hash: `0x${string}`;
  broadcast: (
    raw: `0x${string}`,
    hash: `0x${string}`,
    attempt: number,
  ) => Promise<T>;
  maxAttempts?: number;
  isRetryable?: (err: unknown) => boolean;
  retryDelayMs?: number;
}

export async function runIdempotentBroadcast<T>({
  raw,
  hash,
  broadcast,
  maxAttempts = MAX_SEND_RETRIES,
  isRetryable = isInsufficientFundsError,
  retryDelayMs = RETRY_DELAY_MS,
}: IdempotentBroadcastOptions<T>): Promise<{
  attempts: number;
  result: T | null;
  error: unknown;
}> {
  let attempts = 0;
  let lastError: unknown;
  for (attempts = 1; attempts <= maxAttempts; attempts++) {
    try {
      const result = await broadcast(raw, hash, attempts);
      return { attempts, result, error: null };
    } catch (err) {
      lastError = err;
      if (attempts >= maxAttempts) break;
      if (!isRetryable(err)) break;
      if (retryDelayMs > 0)
        await new Promise((r) => setTimeout(r, retryDelayMs));
    }
  }
  return { attempts, result: null, error: lastError };
}

export interface PreflightData {
  chainId: number;
  sender: string;
  latestBlock: number;
  balance: bigint;
  nonce: number | null;
  gasPriceWei: bigint | null;
  maxFeePerGasWei: bigint | null;
  value: bigint;
  gasLimit: bigint;
  required: bigint;
}

export function formatPreflightReport(data: PreflightData): string {
  const lines = [
    "TESTNET WRITE PREFLIGHT",
    `  chain: ${data.chainId}`,
    `  sender: ${data.sender}`,
    `  latest block: ${data.latestBlock}`,
    `  balance: ${data.balance} raw`,
    `  nonce: ${data.nonce ?? "unknown"}`,
    `  value: ${data.value} raw`,
    `  gas limit: ${data.gasLimit}`,
    `  gas price: ${data.gasPriceWei ?? "n/a"} raw`,
    `  max fee per gas: ${data.maxFeePerGasWei ?? "n/a"} raw`,
    `  max required native balance: ${data.required} raw`,
  ];
  return lines.join("\n");
}

export function signedTransactionHash(raw: `0x${string}`): `0x${string}` {
  return keccak256(raw);
}