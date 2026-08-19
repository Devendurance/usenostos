import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export interface FoundryArtifact {
  abi: readonly unknown[];
  bytecode?: { object?: string };
}

function artifactPath(name: string): string {
  return join(process.cwd(), "contracts", "out", name);
}

export function readArtifact(name: string): FoundryArtifact {
  return JSON.parse(readFileSync(artifactPath(name), "utf8")) as FoundryArtifact;
}

export function readOptionalArtifact(name: string): FoundryArtifact | undefined {
  return existsSync(artifactPath(name)) ? readArtifact(name) : undefined;
}

const registryArtifact = readArtifact("NostosRegistry.sol/NostosRegistry.json");

export const registryAbi = registryArtifact.abi as never;
export const registryBytecode = registryArtifact.bytecode?.object as `0x${string}`;

const vaultArtifact = readArtifact("NostosAsyncVault.sol/NostosAsyncVault.json");

export const vaultAbi = vaultArtifact.abi as never;
export const vaultBytecode = vaultArtifact.bytecode?.object as `0x${string}`;

const p4VaultArtifact = readOptionalArtifact(
  "NostosAsyncVaultP4.sol/NostosAsyncVaultP4.json",
);

export const p4VaultAbi = p4VaultArtifact?.abi;
export const p4VaultBytecode = p4VaultArtifact?.bytecode?.object as
  | `0x${string}`
  | undefined;

const redemptionTicketArtifact = readOptionalArtifact(
  "NostosRedemptionTicket.sol/NostosRedemptionTicket.json",
);

export const redemptionTicketAbi = redemptionTicketArtifact?.abi;
export const redemptionTicketBytecode = redemptionTicketArtifact?.bytecode
  ?.object as `0x${string}` | undefined;

const instantPoolArtifact = readOptionalArtifact(
  "NostosInstantPool.sol/NostosInstantPool.json",
);

export const instantPoolAbi = instantPoolArtifact?.abi;
export const instantPoolBytecode = instantPoolArtifact?.bytecode
  ?.object as `0x${string}` | undefined;

const instantPoolP6Artifact = readOptionalArtifact(
  "NostosInstantPoolP6.sol/NostosInstantPoolP6.json",
);

export const instantPoolP6Abi = instantPoolP6Artifact?.abi;
export const instantPoolP6Bytecode = instantPoolP6Artifact?.bytecode
  ?.object as `0x${string}` | undefined;
