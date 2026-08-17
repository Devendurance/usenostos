import { describe, expect, it } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadEnvFileIntoProcess } from "@/scripts/load-script-env";
import { getTestnetPrivateKey } from "@/lib/chain/builder-wallet";

const TESTNET_KEY = `0x${"44".repeat(32)}`;
const MAINNET_KEY = `0x${"11".repeat(32)}`;

describe("script environment loading", () => {
  it("loads a configured server-only Testnet key into process.env", () => {
    const dir = mkdtempSync(join(tmpdir(), "nostos-env-"));
    const file = join(dir, ".env");
    writeFileSync(file, `BOT_TESTNET_PRIVATE_KEY=${TESTNET_KEY}\n`);
    try {
      loadEnvFileIntoProcess(file);
      expect(process.env.BOT_TESTNET_PRIVATE_KEY).toBe(TESTNET_KEY);
      expect(getTestnetPrivateKey(process.env)).toBe(TESTNET_KEY);
    } finally {
      delete process.env.BOT_TESTNET_PRIVATE_KEY;
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("fails closed when the Testnet key is absent", () => {
    expect(getTestnetPrivateKey({})).toBeNull();
  });

  it("never falls back to the Mainnet key for Testnet scripts", () => {
    expect(
      getTestnetPrivateKey({ BOT_BUILDER_PRIVATE_KEY: MAINNET_KEY }),
    ).toBeNull();
  });
});