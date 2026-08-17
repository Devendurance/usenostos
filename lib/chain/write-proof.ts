import { parseUnits } from "viem";
import {
  BOT_CHAIN_ID,
  BOT_NATIVE_SYMBOL,
  BOT_NATIVE_DECIMALS,
} from "./bot-mainnet";
import { getBuilderPrivateKey } from "./builder-wallet";
import { privateKeyToAccount } from "viem/accounts";
import {
  BOT_USDT,
  isUsableSettlementToken,
  type SettlementTokenRecord,
} from "./settlement-token";

export const P0_ENABLE_MAINNET_WRITE_ENV = "P0_ENABLE_MAINNET_WRITE";
export const P0_WRITE_AMOUNT_ENV = "P0_WRITE_AMOUNT";
export const P0_WRITE_TOKEN_ENV = "P0_WRITE_TOKEN";

const DEFAULT_WRITE_AMOUNT = "0.0001";
const MAX_WRITE_AMOUNT = 1;

export function assertMainnetChain(chainId: number | bigint): void {
  if (Number(chainId) !== BOT_CHAIN_ID) {
    throw new Error(
      `Refusing mainnet operation on chain ${chainId}; only chain ${BOT_CHAIN_ID} is allowed.`,
    );
  }
}

export function parseWriteAmount(
  env: Record<string, string | undefined> = process.env,
): bigint {
  const raw = env[P0_WRITE_AMOUNT_ENV] ?? DEFAULT_WRITE_AMOUNT;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error(`Invalid ${P0_WRITE_AMOUNT_ENV} value: "${raw}"`);
  }
  if (n >= MAX_WRITE_AMOUNT) {
    throw new Error(
      `Refusing write-proof amount >= ${MAX_WRITE_AMOUNT} ${BOT_NATIVE_SYMBOL}`,
    );
  }
  return parseUnits(n.toString(), BOT_NATIVE_DECIMALS);
}

export type WriteProofPlan =
  | {
      ok: true;
      enabled: true;
      chainId: number;
      sender: `0x${string}`;
      token: "BOT" | "USDT";
      tokenAddress: `0x${string}` | null;
      amount: string;
      amountUnits: bigint;
    }
  | { ok: false; enabled: false; reason: string }
  | { ok: false; enabled: true; reason: string };

export function buildWriteProofPlan(
  env: Record<string, string | undefined> = process.env,
  token: SettlementTokenRecord = BOT_USDT,
): WriteProofPlan {
  const enabled = env[P0_ENABLE_MAINNET_WRITE_ENV] === "true";
  if (!enabled) {
    return {
      ok: false,
      enabled: false,
      reason: `${P0_ENABLE_MAINNET_WRITE_ENV}=true is required to enable the write proof.`,
    };
  }

  const key = getBuilderPrivateKey(env);
  if (!key) {
    return {
      ok: false,
      enabled: true,
      reason: "BOT_BUILDER_PRIVATE_KEY is not configured.",
    };
  }
  const sender = privateKeyToAccount(key as `0x${string}`).address;

  const choice = (env[P0_WRITE_TOKEN_ENV] ?? "BOT").toUpperCase();
  if (choice === "BOT") {
    const amountUnits = parseWriteAmount(env);
    return {
      ok: true,
      enabled: true,
      chainId: BOT_CHAIN_ID,
      sender,
      token: "BOT",
      tokenAddress: null,
      amount: env[P0_WRITE_AMOUNT_ENV] ?? DEFAULT_WRITE_AMOUNT,
      amountUnits,
    };
  }

  if (choice === "USDT") {
    if (!isUsableSettlementToken(token)) {
      return {
        ok: false,
        enabled: true,
        reason: `USDT settlement token is ${token.status}; a VERIFIED token is required before any USDT write.`,
      };
    }
    const raw = env[P0_WRITE_AMOUNT_ENV] ?? DEFAULT_WRITE_AMOUNT;
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 1) {
      throw new Error(
        `Invalid ${P0_WRITE_AMOUNT_ENV} for USDT: integer token units required`,
      );
    }
    return {
      ok: true,
      enabled: true,
      chainId: BOT_CHAIN_ID,
      sender,
      token: "USDT",
      tokenAddress: token.address,
      amount: raw,
      amountUnits: BigInt(Math.trunc(n)),
    };
  }

  return {
    ok: false,
    enabled: true,
    reason: `Unsupported ${P0_WRITE_TOKEN_ENV}: "${choice}"`,
  };
}