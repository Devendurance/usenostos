import { isAddress, zeroAddress } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { getTestnetPrivateKey } from "@/lib/chain/builder-wallet";
import { BOT_TESTNET_CHAIN_ID } from "@/lib/chain/bot-testnet";
import { BOT_TESTNET_SETTLEMENT_TOKEN } from "@/lib/chain/settlement-token";

export const P6_ENABLE_TESTNET_DEPLOY_ENV = "P6_ENABLE_TESTNET_DEPLOY";
export const P6_PROTOCOL_TREASURY_ENV = "P6_PROTOCOL_TREASURY";

export type P6DeployPlan =
  | {
      ok: true;
      enabled: true;
      chainId: number;
      deployer: `0x${string}`;
      asset: `0x${string}`;
      vault: `0x${string}`;
      ticket: `0x${string}`;
      protocolTreasury: `0x${string}`;
    }
  | { ok: false; enabled: boolean; reason: string };

type P4Record = {
  asyncVault?: string | null;
  redemptionTicket?: string | null;
};

export function buildP6DeployPlan(
  env: Record<string, string | undefined> = process.env,
  addresses: { p4?: P4Record },
): P6DeployPlan {
  if (env[P6_ENABLE_TESTNET_DEPLOY_ENV] !== "true") {
    return {
      ok: false,
      enabled: false,
      reason: `${P6_ENABLE_TESTNET_DEPLOY_ENV}=true is required.`,
    };
  }
  const key = getTestnetPrivateKey(env);
  if (!key) {
    return {
      ok: false,
      enabled: true,
      reason: "BOT_TESTNET_PRIVATE_KEY is not configured.",
    };
  }
  const asset = BOT_TESTNET_SETTLEMENT_TOKEN.address;
  if (!asset) {
    return {
      ok: false,
      enabled: true,
      reason: "Verified Testnet USDT is not configured.",
    };
  }
  const vault = addresses.p4?.asyncVault ?? null;
  const ticket = addresses.p4?.redemptionTicket ?? null;
  if (!vault || !isAddress(vault)) {
    return {
      ok: false,
      enabled: true,
      reason: "P4 asyncVault address is required.",
    };
  }
  if (!ticket || !isAddress(ticket)) {
    return {
      ok: false,
      enabled: true,
      reason: "P4 redemptionTicket address is required.",
    };
  }
  const treasury = env[P6_PROTOCOL_TREASURY_ENV];
  if (!treasury) {
    return {
      ok: false,
      enabled: true,
      reason: `${P6_PROTOCOL_TREASURY_ENV} is required.`,
    };
  }
  if (!isAddress(treasury)) {
    return {
      ok: false,
      enabled: true,
      reason: `${P6_PROTOCOL_TREASURY_ENV} is not a valid address.`,
    };
  }
  if (treasury.toLowerCase() === zeroAddress) {
    return {
      ok: false,
      enabled: true,
      reason: `${P6_PROTOCOL_TREASURY_ENV} cannot be the zero address.`,
    };
  }
  return {
    ok: true,
    enabled: true,
    chainId: BOT_TESTNET_CHAIN_ID,
    deployer: privateKeyToAccount(key as `0x${string}`).address,
    asset,
    vault: vault as `0x${string}`,
    ticket: ticket as `0x${string}`,
    protocolTreasury: treasury as `0x${string}`,
  };
}
