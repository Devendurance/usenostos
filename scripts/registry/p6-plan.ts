import { isAddress, zeroAddress } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import {
  getTestnetPrivateKey,
  getTestnetTreasuryPrivateKey,
  BOT_TESTNET_TREASURY_PRIVATE_KEY_ENV,
} from "@/lib/chain/builder-wallet";
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

type P6Record = {
  instantPool?: string | null;
  protocolTreasury?: string | null;
};

export type P6HarvestPlan =
  | {
      ok: true;
      enabled: true;
      chainId: number;
      deployer: `0x${string}`;
      asset: `0x${string}`;
      vault: `0x${string}`;
      ticket: `0x${string}`;
      protocolTreasury: `0x${string}`;
      pool: `0x${string}`;
      ticketId: bigint;
    }
  | { ok: false; enabled: boolean; reason: string };

export function parseP6HarvestTicketId(
  raw: string | undefined,
): { ok: true; ticketId: bigint } | { ok: false; reason: string } {
  if (!raw || !/^\d+$/.test(raw)) {
    return {
      ok: false,
      reason: "usage: npm run harvest:instant-pool:p6:testnet -- <ticketId>",
    };
  }
  const ticketId = BigInt(raw);
  if (ticketId <= BigInt(0)) {
    return { ok: false, reason: "ticketId must be a positive integer." };
  }
  return { ok: true, ticketId };
}

export function resolveP6InstantPool(addresses: {
  p5?: { instantPool?: string | null };
  p6?: P6Record;
}): { ok: true; pool: `0x${string}` } | { ok: false; reason: string } {
  const pool = addresses.p6?.instantPool ?? null;
  if (!pool || !isAddress(pool)) {
    return { ok: false, reason: "p6.instantPool address is required." };
  }
  const p5 = addresses.p5?.instantPool ?? null;
  if (p5 && isAddress(p5) && p5.toLowerCase() === pool.toLowerCase()) {
    return {
      ok: false,
      reason: "p6.instantPool must not reuse the P5 instantPool address.",
    };
  }
  return { ok: true, pool: pool as `0x${string}` };
}

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

export function buildP6HarvestPlan(
  env: Record<string, string | undefined> = process.env,
  addresses: { p4?: P4Record; p5?: { instantPool?: string | null }; p6?: P6Record } = {},
  rawTicketId?: string,
): P6HarvestPlan {
  const ticket = parseP6HarvestTicketId(rawTicketId);
  if (!ticket.ok) {
    return { ok: false, enabled: env[P6_ENABLE_TESTNET_DEPLOY_ENV] === "true", reason: ticket.reason };
  }
  const deploy = buildP6DeployPlan(env, addresses);
  if (!deploy.ok) {
    return deploy;
  }
  const pool = resolveP6InstantPool(addresses);
  if (!pool.ok) {
    return { ok: false, enabled: true, reason: pool.reason };
  }
  const persistedTreasury = addresses.p6?.protocolTreasury;
  if (
    persistedTreasury &&
    isAddress(persistedTreasury) &&
    persistedTreasury.toLowerCase() !== deploy.protocolTreasury.toLowerCase()
  ) {
    return {
      ok: false,
      enabled: true,
      reason: "persisted p6.protocolTreasury does not match P6_PROTOCOL_TREASURY.",
    };
  }
  return {
    ok: true,
    enabled: true,
    chainId: deploy.chainId,
    deployer: deploy.deployer,
    asset: deploy.asset,
    vault: deploy.vault,
    ticket: deploy.ticket,
    protocolTreasury: deploy.protocolTreasury,
    pool: pool.pool,
    ticketId: ticket.ticketId,
  };
}

export type P6FeeClaimPlan =
  | {
      ok: true;
      enabled: true;
      chainId: number;
      signer: `0x${string}`;
      asset: `0x${string}`;
      vault: `0x${string}`;
      ticket: `0x${string}`;
      protocolTreasury: `0x${string}`;
      pool: `0x${string}`;
    }
  | { ok: false; enabled: boolean; reason: string };

export function requireP6AccruedFees(
  amount: bigint,
): { ok: true } | { ok: false; reason: string } {
  if (amount <= BigInt(0)) {
    return { ok: false, reason: "accruedProtocolFees must be greater than zero." };
  }
  return { ok: true };
}

export function buildP6FeeClaimPlan(
  env: Record<string, string | undefined> = process.env,
  addresses: { p4?: P4Record; p5?: { instantPool?: string | null }; p6?: P6Record } = {},
): P6FeeClaimPlan {
  if (env[P6_ENABLE_TESTNET_DEPLOY_ENV] !== "true") {
    return {
      ok: false,
      enabled: false,
      reason: `${P6_ENABLE_TESTNET_DEPLOY_ENV}=true is required.`,
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
  const treasuryKey = getTestnetTreasuryPrivateKey(env);
  if (!treasuryKey) {
    return {
      ok: false,
      enabled: true,
      reason: `${BOT_TESTNET_TREASURY_PRIVATE_KEY_ENV} is not configured.`,
    };
  }
  const signer = privateKeyToAccount(treasuryKey as `0x${string}`).address;
  if (signer.toLowerCase() !== treasury.toLowerCase()) {
    return {
      ok: false,
      enabled: true,
      reason: "treasury signer does not match P6_PROTOCOL_TREASURY.",
    };
  }
  const pool = resolveP6InstantPool(addresses);
  if (!pool.ok) {
    return { ok: false, enabled: true, reason: pool.reason };
  }
  const persistedTreasury = addresses.p6?.protocolTreasury;
  if (
    persistedTreasury &&
    isAddress(persistedTreasury) &&
    persistedTreasury.toLowerCase() !== treasury.toLowerCase()
  ) {
    return {
      ok: false,
      enabled: true,
      reason: "persisted p6.protocolTreasury does not match P6_PROTOCOL_TREASURY.",
    };
  }
  return {
    ok: true,
    enabled: true,
    chainId: BOT_TESTNET_CHAIN_ID,
    signer,
    asset,
    vault: vault as `0x${string}`,
    ticket: ticket as `0x${string}`,
    protocolTreasury: treasury as `0x${string}`,
    pool: pool.pool,
  };
}
