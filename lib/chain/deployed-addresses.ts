import addresses from "@/contracts/addresses/bot-testnet.json";

export type EnvLike = Record<string, string | undefined>;

export type P4Deployment = {
  asyncVault?: string | null;
  asyncVaultTx?: string | null;
  asyncVaultBlock?: string | null;
  asyncVaultDeployedAt?: string | null;
  redemptionTicket?: string | null;
  redemptionTicketTx?: string | null;
  redemptionTicketBlock?: string | null;
  redemptionTicketDeployedAt?: string | null;
  configureTx?: string | null;
  configuredAt?: string | null;
};

export type P5Deployment = {
  instantPool?: string | null;
  instantPoolTx?: string | null;
  instantPoolBlock?: string | null;
  instantPoolDeployedAt?: string | null;
};

export type P6Deployment = {
  instantPool?: string | null;
  instantPoolTx?: string | null;
  instantPoolBlock?: string | null;
  instantPoolDeployedAt?: string | null;
  protocolTreasury?: string | null;
};

export type DeployedTestnetAddresses = {
  registry?: string | null;
  registryTx?: string | null;
  registryBlock?: string | null;
  asyncVault?: string | null;
  asyncVaultTx?: string | null;
  asyncVaultBlock?: string | null;
  p4?: P4Deployment;
  p5?: P5Deployment;
  p6?: P6Deployment;
};

export type InstantPoolSurface = "p6" | "p5" | "none";

export function isE2eFixtureEnv(env: EnvLike = process.env): boolean {
  return env.NODE_ENV !== "production" && env.NEXT_PUBLIC_NOSTOS_E2E === "true";
}

function parseJsonObject(raw: string | undefined): unknown {
  if (!raw) return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

export function readE2eP4Fixture(env: EnvLike = process.env): P4Deployment | undefined {
  if (!isE2eFixtureEnv(env)) return undefined;
  const parsed = parseJsonObject(env.NEXT_PUBLIC_NOSTOS_E2E_P4_FIXTURE) as P4Deployment | undefined;
  if (
    parsed &&
    typeof parsed.asyncVault === "string" &&
    typeof parsed.redemptionTicket === "string"
  ) {
    return parsed;
  }
  return undefined;
}

export function readE2eP5Fixture(env: EnvLike = process.env): P5Deployment | undefined {
  if (!isE2eFixtureEnv(env)) return undefined;
  const parsed = parseJsonObject(env.NEXT_PUBLIC_NOSTOS_E2E_P5_FIXTURE) as P5Deployment | undefined;
  if (parsed && typeof parsed.instantPool === "string") {
    return parsed;
  }
  return undefined;
}

export function readE2eP6Fixture(env: EnvLike = process.env): P6Deployment | undefined {
  if (!isE2eFixtureEnv(env)) return undefined;
  const parsed = parseJsonObject(env.NEXT_PUBLIC_NOSTOS_E2E_P6_FIXTURE) as P6Deployment | undefined;
  if (parsed && typeof parsed.instantPool === "string") {
    return parsed;
  }
  return undefined;
}

export function mergeDeployedTestnet(
  persisted: DeployedTestnetAddresses,
  fixtures: { p4?: P4Deployment; p5?: P5Deployment; p6?: P6Deployment },
): DeployedTestnetAddresses {
  const merged: DeployedTestnetAddresses = {
    ...persisted,
    ...(fixtures.p4 ? { p4: fixtures.p4 } : {}),
    ...(fixtures.p5 ? { p5: fixtures.p5 } : {}),
    ...(fixtures.p6 ? { p6: fixtures.p6 } : {}),
  };
  // Default Playwright (P5 fixture, no P6 fixture) must not pick a persisted P6 pool.
  if (fixtures.p5 && !fixtures.p6 && merged.p6) {
    const rest = { ...merged };
    delete rest.p6;
    return rest;
  }
  return merged;
}

export function selectInstantPoolSurface(record: DeployedTestnetAddresses): InstantPoolSurface {
  if (record.p6?.instantPool) return "p6";
  if (record.p5?.instantPool) return "p5";
  return "none";
}

const persistedAddresses = addresses as DeployedTestnetAddresses;

// Access each NEXT_PUBLIC_* key as a member expression so Next can inline it
// into the client bundle. Passing process.env as an object is not inlined.
const runtimeEnv: EnvLike = {
  NODE_ENV: process.env.NODE_ENV,
  NEXT_PUBLIC_NOSTOS_E2E: process.env.NEXT_PUBLIC_NOSTOS_E2E,
  NEXT_PUBLIC_NOSTOS_E2E_P4_FIXTURE: process.env.NEXT_PUBLIC_NOSTOS_E2E_P4_FIXTURE,
  NEXT_PUBLIC_NOSTOS_E2E_P5_FIXTURE: process.env.NEXT_PUBLIC_NOSTOS_E2E_P5_FIXTURE,
  NEXT_PUBLIC_NOSTOS_E2E_P6_FIXTURE: process.env.NEXT_PUBLIC_NOSTOS_E2E_P6_FIXTURE,
};

export const deployedTestnet: DeployedTestnetAddresses = mergeDeployedTestnet(persistedAddresses, {
  p4: readE2eP4Fixture(runtimeEnv),
  p5: readE2eP5Fixture(runtimeEnv),
  p6: readE2eP6Fixture(runtimeEnv),
});
