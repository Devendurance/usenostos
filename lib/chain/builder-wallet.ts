import { privateKeyToAccount } from "viem/accounts";

export const BUILDER_PRIVATE_KEY_ENV = "BOT_BUILDER_PRIVATE_KEY";

export function getBuilderPrivateKey(
  env: Record<string, string | undefined> = process.env,
): string | null {
  const raw = env[BUILDER_PRIVATE_KEY_ENV];
  if (!raw) return null;
  const key = raw.startsWith("0x") ? raw : `0x${raw}`;
  return /^0x[0-9a-fA-F]{64}$/.test(key) ? key : null;
}

export type BuilderWalletState =
  | { configured: false; address: null }
  | { configured: true; address: `0x${string}` };

export function getBuilderWallet(
  env: Record<string, string | undefined> = process.env,
): BuilderWalletState {
  const key = getBuilderPrivateKey(env);
  if (!key) return { configured: false, address: null };
  return {
    configured: true,
    address: privateKeyToAccount(key as `0x${string}`).address,
  };
}