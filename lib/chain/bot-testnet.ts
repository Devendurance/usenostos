import { defineChain } from "viem";
import { BOT_NATIVE_SYMBOL, BOT_NATIVE_DECIMALS } from "./bot-mainnet";

export const BOT_TESTNET_CHAIN_ID = 968;
export const BOT_TESTNET_RPC_URL = "https://rpc.bohr.life";
export const BOT_TESTNET_EXPLORER_URL = "https://scan.bohr.life";
export const BOT_TESTNET_FAUCET_URL = "https://faucet.botchain.ai/basic";

export const botTestnet = defineChain({
  id: BOT_TESTNET_CHAIN_ID,
  name: "BOT Chain Testnet",
  nativeCurrency: {
    name: "BOT",
    symbol: BOT_NATIVE_SYMBOL,
    decimals: BOT_NATIVE_DECIMALS,
  },
  rpcUrls: {
    default: { http: [BOT_TESTNET_RPC_URL] },
  },
  blockExplorers: {
    default: { name: "BOT Scan Testnet", url: BOT_TESTNET_EXPLORER_URL },
  },
  testnet: true,
});