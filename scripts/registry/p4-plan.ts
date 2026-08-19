import { privateKeyToAccount } from "viem/accounts";
import { isAddress } from "viem";
import { getTestnetPrivateKey } from "@/lib/chain/builder-wallet";
import { BOT_TESTNET_CHAIN_ID } from "@/lib/chain/bot-testnet";
import { BOT_TESTNET_SETTLEMENT_TOKEN } from "@/lib/chain/settlement-token";
import { p4DemoVaultOpportunity } from "@/lib/rwa/opportunities/demo-vault";
import { integrationIdFor, metadataHashFor } from "@/lib/rwa/metadata";

export const P4_ENABLE_TESTNET_DEPLOY_ENV = "P4_ENABLE_TESTNET_DEPLOY";
export const DEMO_VAULT_SLUG = "nostos-async-vault";
export const REGISTRY_REDEMPTION_SUPPORTED = 2;

export type P4DeployPlan =
  | {
      ok: true;
      enabled: true;
      chainId: number;
      deployer: `0x${string}`;
      asset: `0x${string}`;
    }
  | { ok: false; enabled: false; reason: string }
  | { ok: false; enabled: true; reason: string };

export function buildP4DeployPlan(
  env: Record<string, string | undefined> = process.env,
): P4DeployPlan {
  if (env[P4_ENABLE_TESTNET_DEPLOY_ENV] !== "true") {
    return {
      ok: false,
      enabled: false,
      reason: `${P4_ENABLE_TESTNET_DEPLOY_ENV}=true is required.`,
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

  return {
    ok: true,
    enabled: true,
    chainId: BOT_TESTNET_CHAIN_ID,
    deployer: privateKeyToAccount(key as `0x${string}`).address,
    asset,
  };
}

export type P4RegistrationPlan =
  | {
      ok: true;
      enabled: true;
      chainId: number;
      deployer: `0x${string}`;
      integrationId: `0x${string}`;
      metadataHash: `0x${string}`;
      nostosVault: `0x${string}`;
      status: number;
    }
  | { ok: false; enabled: boolean; reason: string };

export function buildP4RegistrationPlan(
  env: Record<string, string | undefined> = process.env,
  nostosVault: string,
): P4RegistrationPlan {
  const base = buildP4DeployPlan(env);
  if (!base.ok) return base;
  if (!isAddress(nostosVault)) {
    return {
      ok: false,
      enabled: true,
      reason: `Invalid P4 vault address: ${nostosVault}`,
    };
  }

  return {
    ok: true,
    enabled: true,
    chainId: base.chainId,
    deployer: base.deployer,
    integrationId: integrationIdFor(DEMO_VAULT_SLUG),
    metadataHash: metadataHashFor(p4DemoVaultOpportunity),
    nostosVault: nostosVault as `0x${string}`,
    status: REGISTRY_REDEMPTION_SUPPORTED,
  };
}

export type P4SettlementPlan =
  | {
      ok: true;
      enabled: true;
      chainId: number;
      deployer: `0x${string}`;
      p4Vault: `0x${string}`;
      ticket: `0x${string}`;
      requestId: bigint;
    }
  | { ok: false; enabled: boolean; reason: string };

export function buildP4SettlementPlan(
  env: Record<string, string | undefined> = process.env,
  p4Vault: string | undefined,
  ticket: string | undefined,
  requestId: bigint,
): P4SettlementPlan {
  const base = buildP4DeployPlan(env);
  if (!base.ok) return base;
  if (!p4Vault || !isAddress(p4Vault)) {
    return { ok: false, enabled: true, reason: "P4 vault address is required." };
  }
  if (!ticket || !isAddress(ticket)) {
    return { ok: false, enabled: true, reason: "P4 redemption ticket address is required." };
  }
  if (requestId <= BigInt(0)) {
    return { ok: false, enabled: true, reason: "Request ID must be positive." };
  }
  return {
    ok: true,
    enabled: true,
    chainId: base.chainId,
    deployer: base.deployer,
    p4Vault: p4Vault as `0x${string}`,
    ticket: ticket as `0x${string}`,
    requestId,
  };
}
