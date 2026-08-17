import type { PublicClient } from "viem";

export const TESTNET_RPC_HEALTH_DEFAULTS = {
  sampleCount: 5,
  maxBackwardRegressionBlocks: 10,
  maxNormalBlockSpread: 10,
  maxBlockSpread: 50,
  sampleDelayMs: 300,
} as const;

export type RpcHealthStatus =
  | "HEALTHY"
  | "DEGRADED"
  | "STALE_BACKENDS_DETECTED";

export interface RpcHealthSample {
  block: number;
  balance: bigint | null;
  nonce: number | null;
}

export interface RpcHealthResult {
  samples: RpcHealthSample[];
  minBlock: number;
  maxBlock: number;
  blockSpread: number;
  minBalance: bigint | null;
  maxBalance: bigint | null;
  balanceConsistent: boolean;
  nonceConsistent: boolean;
  status: RpcHealthStatus;
  staleReasons: string[];
}

export function classifyRpcHealth(
  samples: RpcHealthSample[],
  config: Partial<typeof TESTNET_RPC_HEALTH_DEFAULTS> = {},
): RpcHealthResult {
  const cfg = { ...TESTNET_RPC_HEALTH_DEFAULTS, ...config };

  const blocks = samples.map((s) => s.block);
  const minBlock = blocks.length ? Math.min(...blocks) : 0;
  const maxBlock = blocks.length ? Math.max(...blocks) : 0;
  const blockSpread = maxBlock - minBlock;

  const balances = samples
    .map((s) => s.balance)
    .filter((b): b is bigint => b !== null);
  const nonces = samples
    .map((s) => s.nonce)
    .filter((n): n is number => n !== null);

  const staleReasons: string[] = [];

  let maxSeen = -1;
  for (const block of blocks) {
    if (maxSeen >= 0 && block < maxSeen - cfg.maxBackwardRegressionBlocks) {
      staleReasons.push(
        `block regressed to ${block} after a prior sample reported ${maxSeen}`,
      );
    }
    if (block > maxSeen) maxSeen = block;
  }

  for (let i = 1; i < samples.length; i++) {
    const prev = samples[i - 1].balance;
    const cur = samples[i].balance;
    if (prev !== null && cur !== null && cur < prev) {
      staleReasons.push(
        `balance regressed from ${prev} to ${cur} between consecutive samples`,
      );
    }
  }

  for (let i = 1; i < samples.length; i++) {
    const prev = samples[i - 1].nonce;
    const cur = samples[i].nonce;
    if (prev !== null && cur !== null && cur < prev) {
      staleReasons.push(
        `nonce regressed from ${prev} to ${cur} between consecutive samples`,
      );
    }
  }

  if (blockSpread > cfg.maxBlockSpread) {
    staleReasons.push(
      `block spread ${blockSpread} exceeds threshold ${cfg.maxBlockSpread}`,
    );
  }

  const balanceConsistent =
    balances.length < 2 || new Set(balances.map(String)).size === 1;
  const nonceConsistent =
    nonces.length < 2 || new Set(nonces.map(String)).size === 1;

  let status: RpcHealthStatus = "HEALTHY";
  if (staleReasons.length > 0) {
    status = "STALE_BACKENDS_DETECTED";
  } else if (blockSpread > cfg.maxNormalBlockSpread) {
    status = "DEGRADED";
  }

  return {
    samples,
    minBlock,
    maxBlock,
    blockSpread,
    minBalance: balances.length
      ? balances.reduce((a, b) => (a < b ? a : b))
      : null,
    maxBalance: balances.length
      ? balances.reduce((a, b) => (a > b ? a : b))
      : null,
    balanceConsistent,
    nonceConsistent,
    status,
    staleReasons,
  };
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function sampleTestnetRpcHealth(params: {
  client: PublicClient;
  address?: `0x${string}`;
  sampleCount?: number;
  delayMs?: number;
  config?: Partial<typeof TESTNET_RPC_HEALTH_DEFAULTS>;
}): Promise<RpcHealthResult> {
  const cfg = { ...TESTNET_RPC_HEALTH_DEFAULTS, ...(params.config ?? {}) };
  const count = params.sampleCount ?? cfg.sampleCount;
  const samples: RpcHealthSample[] = [];
  for (let i = 0; i < count; i++) {
    if (i > 0 && cfg.sampleDelayMs > 0) await delay(cfg.sampleDelayMs);
    const block = Number(await params.client.getBlockNumber());
    const balance = params.address
      ? await params.client.getBalance({ address: params.address })
      : null;
    const nonce = params.address
      ? Number(
          await params.client.getTransactionCount({ address: params.address }),
        )
      : null;
    samples.push({ block, balance, nonce });
  }
  return classifyRpcHealth(samples, cfg);
}