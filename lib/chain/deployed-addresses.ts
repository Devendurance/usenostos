import addresses from "@/contracts/addresses/bot-testnet.json";

export type DeployedTestnetAddresses = {
  registry?: string | null;
  registryTx?: string | null;
  registryBlock?: string | null;
  asyncVault?: string | null;
  asyncVaultTx?: string | null;
  asyncVaultBlock?: string | null;
};

export const deployedTestnet = addresses as DeployedTestnetAddresses;