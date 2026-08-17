import { describe, expect, it } from "vitest";
import {
  botTestnet,
  BOT_TESTNET_CHAIN_ID,
  BOT_TESTNET_RPC_URL,
  BOT_TESTNET_EXPLORER_URL,
} from "@/lib/chain/bot-testnet";
import { BOT_TESTNET_PROVENANCE } from "@/lib/chain/provenance";

describe("canonical BOT testnet chain", () => {
  it("has chain id 968", () => {
    expect(botTestnet.id).toBe(968);
    expect(BOT_TESTNET_CHAIN_ID).toBe(968);
  });

  it("uses BOT as the native symbol", () => {
    expect(botTestnet.nativeCurrency.symbol).toBe("BOT");
    expect(botTestnet.nativeCurrency.decimals).toBe(18);
  });

  it("uses the BOT testnet explorer", () => {
    expect(BOT_TESTNET_EXPLORER_URL).toBe("https://scan.bohr.life");
    expect(botTestnet.blockExplorers?.default.url).toBe(
      "https://scan.bohr.life",
    );
  });

  it("uses the BOT testnet RPC", () => {
    expect(BOT_TESTNET_RPC_URL).toBe("https://rpc.bohr.life");
    expect(BOT_TESTNET_PROVENANCE.rpcUrl).toBe("https://rpc.bohr.life");
  });

  it("is a testnet and scoped as staging", () => {
    expect(botTestnet.testnet).toBe(true);
    expect(BOT_TESTNET_PROVENANCE.designation).toBe("staging");
    expect(BOT_TESTNET_PROVENANCE.environment).toBe("testnet");
  });

  it("never reuses the mainnet chain object", () => {
    expect(botTestnet.id).not.toBe(677);
  });
});