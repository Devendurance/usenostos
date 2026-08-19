import addresses from "@/contracts/addresses/bot-testnet.json";

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

export type DeployedTestnetAddresses = {
  registry?: string | null;
  registryTx?: string | null;
  registryBlock?: string | null;
  asyncVault?: string | null;
  asyncVaultTx?: string | null;
  asyncVaultBlock?: string | null;
  p4?: P4Deployment;
};

function readE2eP4Fixture(): P4Deployment | undefined {
  if (process.env.NODE_ENV === "production") return undefined;
  if (process.env.NEXT_PUBLIC_NOSTOS_E2E !== "true") return undefined;
  const raw = process.env.NEXT_PUBLIC_NOSTOS_E2E_P4_FIXTURE;
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw) as P4Deployment;
    if (
      typeof parsed.asyncVault === "string" &&
      typeof parsed.redemptionTicket === "string"
    ) {
      return parsed;
    }
  } catch {
    return undefined;
  }
  return undefined;
}

const persistedAddresses = addresses as DeployedTestnetAddresses;
const e2eP4Fixture = readE2eP4Fixture();

export const deployedTestnet: DeployedTestnetAddresses = e2eP4Fixture
  ? { ...persistedAddresses, p4: e2eP4Fixture }
  : persistedAddresses;
