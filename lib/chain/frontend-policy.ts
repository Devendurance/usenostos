import { BOT_CHAIN_ID } from "./bot-mainnet";
import { BOT_TESTNET_CHAIN_ID } from "./bot-testnet";

export interface FrontendPolicy {
  environment: "testnet";
  requiredChainId: number;
  writesEnabled: false;
}

// P1 is explicitly testnet-only. Mainnet (677) is known internally but can
// never activate in the frontend; promoting to Mainnet is a future, single,
// centralized change.
export const FRONTEND_POLICY: FrontendPolicy = {
  environment: "testnet",
  requiredChainId: BOT_TESTNET_CHAIN_ID,
  writesEnabled: false,
};

export function isFrontendUsableChain(
  chainId: number | bigint | undefined,
): boolean {
  if (chainId === undefined) return false;
  return Number(chainId) === FRONTEND_POLICY.requiredChainId;
}

// Fail closed: only "testnet" is ever accepted in P1. Missing, invalid, or an
// explicit "mainnet" value all resolve to testnet, so Mainnet can never be
// enabled by misconfiguration.
export function resolveFrontendEnvironment(
  raw: string | undefined,
): FrontendPolicy {
  const value = raw?.trim().toLowerCase();
  return value === "testnet" ? FRONTEND_POLICY : { ...FRONTEND_POLICY };
}

export const MAINNET_CHAIN_ID = BOT_CHAIN_ID;