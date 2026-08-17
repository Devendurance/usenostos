import { readFileSync } from "node:fs";
import { join } from "node:path";

const file = join(
  process.cwd(),
  "contracts",
  "out",
  "NostosRegistry.sol",
  "NostosRegistry.json",
);

const artifact = JSON.parse(readFileSync(file, "utf8")) as {
  abi: readonly unknown[];
  bytecode?: { object?: string };
};

export const registryAbi = artifact.abi as never;
export const registryBytecode = artifact.bytecode?.object as `0x${string}`;