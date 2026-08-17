import { BOT_CHAIN_ID } from "./bot-mainnet";
import { BOT_TESTNET_CHAIN_ID } from "./bot-testnet";

export function assertBotMainnetChain(chainId: number | bigint): void {
  if (Number(chainId) !== BOT_CHAIN_ID) {
    throw new Error(
      `Refusing mainnet operation on chain ${chainId}; only chain ${BOT_CHAIN_ID} is allowed.`,
    );
  }
}

export function assertBotTestnetChain(chainId: number | bigint): void {
  if (Number(chainId) !== BOT_TESTNET_CHAIN_ID) {
    throw new Error(
      `Refusing testnet operation on chain ${chainId}; only chain ${BOT_TESTNET_CHAIN_ID} is allowed.`,
    );
  }
}