import { parseUnits } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { BOT_TESTNET_CHAIN_ID } from "./bot-testnet";
import { getTestnetPrivateKey } from "./builder-wallet";

export const P0_ENABLE_TESTNET_WRITE_ENV = "P0_ENABLE_TESTNET_WRITE";
export const P0_TESTNET_WRITE_AMOUNT_ENV = "P0_TESTNET_WRITE_AMOUNT";

const DEFAULT_TESTNET_WRITE_AMOUNT = "0.0001";
const MAX_TESTNET_WRITE_AMOUNT = 1;
const TBOT_DECIMALS = 18;

export function parseTestnetWriteAmount(
  env: Record<string, string | undefined> = process.env,
): bigint {
  const raw = env[P0_TESTNET_WRITE_AMOUNT_ENV] ?? DEFAULT_TESTNET_WRITE_AMOUNT;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error(`Invalid ${P0_TESTNET_WRITE_AMOUNT_ENV} value: "${raw}"`);
  }
  if (n >= MAX_TESTNET_WRITE_AMOUNT) {
    throw new Error(
      `Refusing testnet write amount >= ${MAX_TESTNET_WRITE_AMOUNT} tBOT`,
    );
  }
  return parseUnits(n.toString(), TBOT_DECIMALS);
}

export type TestnetWriteProofPlan =
  | {
      ok: true;
      enabled: true;
      chainId: number;
      sender: `0x${string}`;
      token: "tBOT";
      amount: string;
      amountUnits: bigint;
    }
  | { ok: false; enabled: false; reason: string }
  | { ok: false; enabled: true; reason: string };

export function buildTestnetWriteProofPlan(
  env: Record<string, string | undefined> = process.env,
): TestnetWriteProofPlan {
  const enabled = env[P0_ENABLE_TESTNET_WRITE_ENV] === "true";
  if (!enabled) {
    return {
      ok: false,
      enabled: false,
      reason: `${P0_ENABLE_TESTNET_WRITE_ENV}=true is required to enable the testnet write proof.`,
    };
  }
  const key = getTestnetPrivateKey(env);
  if (!key) {
    return {
      ok: false,
      enabled: true,
      reason:
        "BOT_TESTNET_PRIVATE_KEY is not configured (BOT_BUILDER_PRIVATE_KEY is never used for testnet writes).",
    };
  }
  const sender = privateKeyToAccount(key as `0x${string}`).address;
  const amountUnits = parseTestnetWriteAmount(env);
  return {
    ok: true,
    enabled: true,
    chainId: BOT_TESTNET_CHAIN_ID,
    sender,
    token: "tBOT",
    amount: env[P0_TESTNET_WRITE_AMOUNT_ENV] ?? DEFAULT_TESTNET_WRITE_AMOUNT,
    amountUnits,
  };
}