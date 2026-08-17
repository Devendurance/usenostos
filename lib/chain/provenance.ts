import {
  botMainnet,
  BOT_CHAIN_ID,
  BOT_CHAIN_RPC_URL,
  BOT_CHAIN_EXPLORER_URL,
  BOT_NATIVE_SYMBOL,
  BOT_NATIVE_DECIMALS,
} from "./bot-mainnet";
import { BOT_USDT, type SettlementTokenRecord } from "./settlement-token";

export interface MainnetProvenance {
  chainId: number;
  chainName: string;
  rpcUrl: string;
  explorerUrl: string;
  nativeSymbol: string;
  nativeDecimals: number;
  officialRpcIndexesLogs: false;
  indexingStrategy: string;
  settlementToken: SettlementTokenRecord;
}

export const BOT_MAINNET_PROVENANCE: MainnetProvenance = {
  chainId: BOT_CHAIN_ID,
  chainName: botMainnet.name,
  rpcUrl: BOT_CHAIN_RPC_URL,
  explorerUrl: BOT_CHAIN_EXPLORER_URL,
  nativeSymbol: BOT_NATIVE_SYMBOL,
  nativeDecimals: BOT_NATIVE_DECIMALS,
  officialRpcIndexesLogs: false,
  indexingStrategy:
    "BOT's official Mainnet RPC was expected to disable eth_getLogs, but the P0 live probe (2026-08-17) received a successful response for a 200-block range on the USDT token. Do not rely on this; the documentation warns the RPC disables eth_getLogs, so historical event indexing should still plan around an approved third-party RPC/WebSocket/indexer/explorer (P7) and re-validate at integration time.",
  settlementToken: BOT_USDT,
};