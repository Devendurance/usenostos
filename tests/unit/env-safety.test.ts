import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  BUILDER_PRIVATE_KEY_ENV,
  BOT_TESTNET_PRIVATE_KEY_ENV,
  getBuilderWallet,
  getTestnetWallet,
} from "@/lib/chain/builder-wallet";
import {
  P0_ENABLE_MAINNET_WRITE_ENV,
  P0_WRITE_TOKEN_ENV,
} from "@/lib/chain/write-proof";
import { P0_ENABLE_TESTNET_WRITE_ENV } from "@/lib/chain/write-proof-testnet";

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) walk(full, out);
    else if (/\.(ts|tsx|js|mjs|mts)$/.test(entry)) out.push(full);
  }
  return out;
}

describe("env and secret safety", () => {
  it("does not expose the private key env var through NEXT_PUBLIC_*", () => {
    expect(BUILDER_PRIVATE_KEY_ENV.startsWith("NEXT_PUBLIC_")).toBe(false);
  });

  it("does not expose the testnet private key env var through NEXT_PUBLIC_*", () => {
    expect(BOT_TESTNET_PRIVATE_KEY_ENV.startsWith("NEXT_PUBLIC_")).toBe(false);
  });

  it("keeps server-only env names out of client code", () => {
    const secretNames = [
      BUILDER_PRIVATE_KEY_ENV,
      BOT_TESTNET_PRIVATE_KEY_ENV,
      P0_ENABLE_MAINNET_WRITE_ENV,
      P0_ENABLE_TESTNET_WRITE_ENV,
      P0_WRITE_TOKEN_ENV,
    ];
    const clientDirs = ["app", "components", "public"];
    const offenders: string[] = [];
    for (const dir of clientDirs) {
      for (const file of walk(join(process.cwd(), dir))) {
        const content = readFileSync(file, "utf8");
        for (const name of secretNames) {
          if (content.includes(name)) offenders.push(`${file} -> ${name}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("returns an unconfigured wallet when no private key is present", () => {
    const wallet = getBuilderWallet({});
    expect(wallet.configured).toBe(false);
    expect(wallet.address).toBeNull();
  });

  it("returns an unconfigured testnet wallet when no testnet key is present", () => {
    const wallet = getTestnetWallet({});
    expect(wallet.configured).toBe(false);
    expect(wallet.address).toBeNull();
  });

  it("keeps server-only chain modules out of client code", () => {
    const forbidden = [
      "builder-wallet",
      "write-proof",
      "write-proof-testnet",
      "testnet-write",
      "guards",
    ];
    const clientDirs = ["app", "components"];
    const offenders: string[] = [];
    for (const dir of clientDirs) {
      for (const file of walk(join(process.cwd(), dir))) {
        const content = readFileSync(file, "utf8");
        for (const mod of forbidden) {
          if (new RegExp(`from ["']@/lib/chain/${mod}["']`).test(content)) {
            offenders.push(`${file} -> ${mod}`);
          }
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("does not export the raw private key from the wallet module", async () => {
    const mod = (await import("@/lib/chain/builder-wallet")) as Record<
      string,
      unknown
    >;
    const exported = Object.keys(mod);
    expect(exported).not.toContain("privateKey");
    expect(exported).not.toContain("key");
  });
});