import { getTestnetPrivateKey } from "@/lib/chain/builder-wallet";
import { BOT_TESTNET_CHAIN_ID } from "@/lib/chain/bot-testnet";
import { privateKeyToAccount } from "viem/accounts";
import { getOpportunityBySlug } from "@/lib/rwa/opportunities";
import { integrationIdFor, metadataHashFor } from "@/lib/rwa/metadata";

export const P2_ENABLE_DEPLOY_ENV = "P2_ENABLE_TESTNET_DEPLOY";
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

export type DeployPlan =
  | { ok: true; enabled: true; chainId: number; deployer: `0x${string}` }
  | { ok: false; enabled: false; reason: string }
  | { ok: false; enabled: true; reason: string };

export function buildDeployPlan(
  env: Record<string, string | undefined> = process.env,
): DeployPlan {
  if (env[P2_ENABLE_DEPLOY_ENV] !== "true") {
    return {
      ok: false,
      enabled: false,
      reason: `${P2_ENABLE_DEPLOY_ENV}=true is required.`,
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
  return {
    ok: true,
    enabled: true,
    chainId: BOT_TESTNET_CHAIN_ID,
    deployer: privateKeyToAccount(key as `0x${string}`).address,
  };
}

export type RegistrationPlan =
  | (DeployPlan & {
      slug: string;
      integrationId: `0x${string}`;
      metadataHash: `0x${string}`;
      nostosVault: `0x${string}`;
    })
  | { ok: false; enabled: boolean; reason: string };

export function buildRegistrationPlan(
  env: Record<string, string | undefined> = process.env,
  slug: string,
): RegistrationPlan {
  const base = buildDeployPlan(env);
  if (!base.ok) return base;
  const opportunity = getOpportunityBySlug(slug);
  if (!opportunity) {
    return { ok: false, enabled: true, reason: `Unknown slug: ${slug}` };
  }
  return {
    ok: true,
    enabled: true,
    chainId: base.chainId,
    deployer: base.deployer,
    slug,
    integrationId: integrationIdFor(slug),
    metadataHash: metadataHashFor(opportunity),
    nostosVault: ZERO_ADDRESS,
  };
}