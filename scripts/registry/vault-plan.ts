import { getTestnetPrivateKey } from "@/lib/chain/builder-wallet";
import { BOT_TESTNET_CHAIN_ID } from "@/lib/chain/bot-testnet";
import { BOT_TESTNET_SETTLEMENT_TOKEN } from "@/lib/chain/settlement-token";
import { privateKeyToAccount } from "viem/accounts";
import { demoVaultOpportunity } from "@/lib/rwa/opportunities/demo-vault";
import { integrationIdFor, metadataHashFor } from "@/lib/rwa/metadata";

export const P3_ENABLE_DEPLOY_ENV = "P3_ENABLE_TESTNET_DEPLOY";
export const DEMO_VAULT_SLUG = "nostos-async-vault";
export const REGISTRY_REDEMPTION_SUPPORTED = 2;

export type VaultDeployPlan =
  | {
      ok: true;
      enabled: true;
      chainId: number;
      deployer: `0x${string}`;
      asset: `0x${string}`;
    }
  | { ok: false; enabled: false; reason: string }
  | { ok: false; enabled: true; reason: string };

export function buildVaultDeployPlan(
  env: Record<string, string | undefined> = process.env,
): VaultDeployPlan {
  if (env[P3_ENABLE_DEPLOY_ENV] !== "true") {
    return {
      ok: false,
      enabled: false,
      reason: `${P3_ENABLE_DEPLOY_ENV}=true is required.`,
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

export type VaultRegistrationPlan =
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

export function buildVaultRegistrationPlan(
  env: Record<string, string | undefined> = process.env,
  nostosVault: `0x${string}`,
): VaultRegistrationPlan {
  const base = buildVaultDeployPlan(env);
  if (!base.ok) return base;
  return {
    ok: true,
    enabled: true,
    chainId: base.chainId,
    deployer: base.deployer,
    integrationId: integrationIdFor(DEMO_VAULT_SLUG),
    metadataHash: metadataHashFor(demoVaultOpportunity),
    nostosVault,
    status: REGISTRY_REDEMPTION_SUPPORTED,
  };
}