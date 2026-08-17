import { readFileSync } from "node:fs";
import { join } from "node:path";

export interface FoundryArtifact {
  abi: readonly unknown[];
  bytecode?: { object?: string };
}

export function readArtifact(name: string): FoundryArtifact {
  const file = join(process.cwd(), "contracts", "out", name);
  return JSON.parse(readFileSync(file, "utf8")) as FoundryArtifact;
}

const registryArtifact = readArtifact("NostosRegistry.sol/NostosRegistry.json");

export const registryAbi = registryArtifact.abi as never;
export const registryBytecode = registryArtifact.bytecode?.object as `0x${string}`;

const vaultArtifact = readArtifact("NostosAsyncVault.sol/NostosAsyncVault.json");

export const vaultAbi = vaultArtifact.abi as never;
export const vaultBytecode = vaultArtifact.bytecode?.object as `0x${string}`;