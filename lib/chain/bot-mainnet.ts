import { defineChain } from "viem";

export const BOT_CHAIN_ID = 677;
export const BOT_CHAIN_RPC_URL = "https://rpc.botchain.ai";
export const BOT_CHAIN_EXPLORER_URL = "https://scan.botchain.ai";
export const BOT_NATIVE_SYMBOL = "BOT";
export const BOT_NATIVE_DECIMALS = 18;

export const botMainnet = defineChain({
  id: BOT_CHAIN_ID,
  name: "BOT Chain",
  nativeCurrency: {
    name: "BOT",
    symbol: BOT_NATIVE_SYMBOL,
    decimals: BOT_NATIVE_DECIMALS,
  },
  rpcUrls: {
    default: { http: [BOT_CHAIN_RPC_URL] },
  },
  blockExplorers: {
    default: { name: "BOT Scan", url: BOT_CHAIN_EXPLORER_URL },
  },
  testnet: false,
});