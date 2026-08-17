import {
  botMainnet,
  BOT_CHAIN_ID,
  BOT_CHAIN_RPC_URL,
  BOT_CHAIN_EXPLORER_URL,
  BOT_NATIVE_SYMBOL,
  BOT_NATIVE_DECIMALS,
} from "./bot-mainnet";
import {
  botTestnet,
  BOT_TESTNET_CHAIN_ID,
  BOT_TESTNET_RPC_URL,
  BOT_TESTNET_EXPLORER_URL,
  BOT_TESTNET_FAUCET_URL,
} from "./bot-testnet";
import {
  BOT_USDT,
  BOT_TESTNET_SETTLEMENT_TOKEN,
  type SettlementTokenRecord,
} from "./settlement-token";

export type BotEnvironment = "mainnet" | "testnet";
export type BotDesignation = "production" | "staging";

export interface BotNetworkProvenance {
  environment: BotEnvironment;
  designation: BotDesignation;
  chainId: number;
  chainName: string;
  rpcUrl: string;
  explorerUrl: string;
  faucetUrl: string | null;
  nativeSymbol: string;
  nativeDecimals: number;
  officialRpcIndexesLogs: false;
  indexingStrategy: string;
  settlementToken: SettlementTokenRecord;
}

export const BOT_MAINNET_PROVENANCE: BotNetworkProvenance = {
  environment: "mainnet",
  designation: "production",
  chainId: BOT_CHAIN_ID,
  chainName: botMainnet.name,
  rpcUrl: BOT_CHAIN_RPC_URL,
  explorerUrl: BOT_CHAIN_EXPLORER_URL,
  faucetUrl: null,
  nativeSymbol: BOT_NATIVE_SYMBOL,
  nativeDecimals: BOT_NATIVE_DECIMALS,
  officialRpcIndexesLogs: false,
  indexingStrategy:
    "BOT's official Mainnet RPC was expected to disable eth_getLogs, but the P0 live probe (2026-08-17) received a successful response for a 200-block range on the USDT token. Do not rely on this; plan P7 indexing around an approved third-party indexer and re-validate.",
  settlementToken: BOT_USDT,
};

export const BOT_TESTNET_PROVENANCE: BotNetworkProvenance = {
  environment: "testnet",
  designation: "staging",
  chainId: BOT_TESTNET_CHAIN_ID,
  chainName: botTestnet.name,
  rpcUrl: BOT_TESTNET_RPC_URL,
  explorerUrl: BOT_TESTNET_EXPLORER_URL,
  faucetUrl: BOT_TESTNET_FAUCET_URL,
  nativeSymbol: BOT_NATIVE_SYMBOL,
  nativeDecimals: BOT_NATIVE_DECIMALS,
  officialRpcIndexesLogs: false,
  indexingStrategy:
    "Testnet RPC capabilities are established by npm run doctor:testnet; indexer strategy for testnet follows the same approved third-party approach planned for Mainnet (P7).",
  settlementToken: BOT_TESTNET_SETTLEMENT_TOKEN,
};