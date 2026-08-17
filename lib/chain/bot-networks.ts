import { botMainnet } from "./bot-mainnet";
import { botTestnet } from "./bot-testnet";

export const botNetworks = {
  mainnet: botMainnet,
  testnet: botTestnet,
} as const;