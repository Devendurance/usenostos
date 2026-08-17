import { describe, expect, it } from "vitest";
import {
  botMainnet,
  BOT_CHAIN_ID,
  BOT_CHAIN_RPC_URL,
  BOT_CHAIN_EXPLORER_URL,
  BOT_NATIVE_SYMBOL,
  BOT_NATIVE_DECIMALS,
} from "@/lib/chain/bot-mainnet";
import { BOT_MAINNET_PROVENANCE } from "@/lib/chain/provenance";

describe("canonical BOT mainnet chain", () => {
  it("has chain id 677", () => {
    expect(botMainnet.id).toBe(677);
    expect(BOT_CHAIN_ID).toBe(677);
  });

  it("uses the BOT mainnet explorer", () => {
    expect(BOT_CHAIN_EXPLORER_URL).toBe("https://scan.botchain.ai");
    expect(botMainnet.blockExplorers?.default.url).toBe(
      "https://scan.botchain.ai",
    );
  });

  it("uses BOT with 18 decimals as native currency", () => {
    expect(BOT_NATIVE_SYMBOL).toBe("BOT");
    expect(BOT_NATIVE_DECIMALS).toBe(18);
    expect(botMainnet.nativeCurrency.symbol).toBe("BOT");
    expect(botMainnet.nativeCurrency.decimals).toBe(18);
  });

  it("is not a testnet", () => {
    expect(botMainnet.testnet).toBe(false);
  });

  it("does not claim official RPC log indexing", () => {
    expect(BOT_MAINNET_PROVENANCE.officialRpcIndexesLogs).toBe(false);
  });

  it("keeps the RPC URL consistent", () => {
    expect(BOT_MAINNET_PROVENANCE.rpcUrl).toBe(BOT_CHAIN_RPC_URL);
  });
});