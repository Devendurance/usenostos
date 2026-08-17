import { createPublicClient, erc20Abi, formatUnits, http } from "viem";
import { existsSync } from "node:fs";
import {
  botTestnet,
  BOT_TESTNET_CHAIN_ID,
  BOT_TESTNET_RPC_URL,
  BOT_TESTNET_EXPLORER_URL,
  BOT_TESTNET_FAUCET_URL,
} from "../lib/chain/bot-testnet";
import {
  BOT_TESTNET_SETTLEMENT_TOKEN,
  CANDIDATE_BOT_TESTNET_USDT_ADDRESS,
} from "../lib/chain/settlement-token";
import { getTestnetWallet } from "../lib/chain/builder-wallet";
import { sampleTestnetRpcHealth } from "../lib/chain/testnet-rpc-health";

for (const file of [".env", ".env.local"]) {
  if (existsSync(file)) {
    try {
      process.loadEnvFile(file);
    } catch {
      /* ignore invalid env files */
    }
  }
}

const rpcUrl = process.env.BOT_TESTNET_RPC_URL ?? BOT_TESTNET_RPC_URL;

const publicClient = createPublicClient({
  chain: botTestnet,
  transport: http(rpcUrl, { timeout: 15_000, retryCount: 0 }),
});

function line(label: string, value: string) {
  console.log(`  ${label}: ${value}`);
}

async function probe(label: string, fn: () => Promise<unknown>) {
  try {
    const value = await fn();
    console.log(`  [${label}] OK`);
    return { ok: true as const, value };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.log(`  [${label}] ERROR ${message}`);
    return { ok: false as const, error: message };
  }
}

async function main() {
  console.log("BOT TESTNET DOCTOR");

  line("expected chain id", String(BOT_TESTNET_CHAIN_ID));
  line("rpc", rpcUrl);
  line("explorer base url", BOT_TESTNET_EXPLORER_URL);
  line("faucet", BOT_TESTNET_FAUCET_URL);

  const chainIdProbe = await probe("eth_chainId", () => publicClient.getChainId());
  line("RPC REACHABLE", chainIdProbe.ok ? "YES" : "NO");
  if (!chainIdProbe.ok) {
    console.error(
      "\nFATAL: Testnet RPC unreachable; cannot verify BOT Testnet identity.",
    );
    process.exit(1);
  }
  const chainId = Number(chainIdProbe.value);
  line("CHAIN", String(chainId));
  if (chainId !== BOT_TESTNET_CHAIN_ID) {
    console.error(
      `\nFATAL: RPC returned chain id ${chainId}, expected ${BOT_TESTNET_CHAIN_ID}. Refusing to continue.`,
    );
    process.exit(1);
  }
  line("EXPECTED", String(BOT_TESTNET_CHAIN_ID));

  const block = await probe("latest block", () => publicClient.getBlockNumber());
  if (block.ok) line("LATEST BLOCK", String(block.value));

  line("NATIVE TOKEN", "BOT (tBOT)");

  console.log("\n== RPC CAPABILITIES ==");
  await probe("eth_getBalance", () =>
    publicClient.getBalance({
      address: "0x0000000000000000000000000000000000000000",
    }),
  );
  await probe("eth_call (erc20 name on candidate)", () =>
    publicClient.readContract({
      address: CANDIDATE_BOT_TESTNET_USDT_ADDRESS,
      abi: erc20Abi,
      functionName: "name",
    }),
  );
  await probe("eth_getCode (candidate)", () =>
    publicClient.getCode({ address: CANDIDATE_BOT_TESTNET_USDT_ADDRESS }),
  );
  const logs = await probe("eth_getLogs (recent range)", () =>
    publicClient.request({
      method: "eth_getLogs",
      params: [
        {
          fromBlock: "latest",
          toBlock: "latest",
          address: CANDIDATE_BOT_TESTNET_USDT_ADDRESS,
        },
      ],
    }),
  );
  line("ETH_CALL", "SUPPORTED");
  line("ETH_GETCODE", "SUPPORTED");
  line("ETH_GETLOGS", logs.ok ? "SUPPORTED" : "UNSUPPORTED");

  const wallet = getTestnetWallet();
  const consistencyAddress =
    wallet.configured && wallet.address ? wallet.address : undefined;

  console.log("\n== RPC CONSISTENCY ==");
  const health = await sampleTestnetRpcHealth({
    client: publicClient,
    address: consistencyAddress,
  });
  for (let i = 0; i < health.samples.length; i++) {
    const s = health.samples[i];
    console.log(
      `  SAMPLE ${i + 1}   BLOCK ${s.block}   BALANCE ${
        s.balance === null ? "n/a" : formatUnits(s.balance, 18)
      } tBOT   NONCE ${s.nonce ?? "n/a"}`,
    );
  }
  line("MIN BLOCK", String(health.minBlock));
  line("MAX BLOCK", String(health.maxBlock));
  line("BLOCK SPREAD", String(health.blockSpread));
  line("BALANCE CONSISTENT", health.balanceConsistent ? "YES" : "NO");
  line("NONCE CONSISTENT", health.nonceConsistent ? "YES" : "NO");
  line("RPC HEALTH", health.status);
  if (health.status === "STALE_BACKENDS_DETECTED") {
    console.log(
      "  The public BOT Testnet RPC appears to route requests across backend nodes at different synchronization heights. Recent transactions/balances may temporarily appear missing.",
    );
    for (const reason of health.staleReasons) {
      console.log(`  - ${reason}`);
    }
  }

  const observedFloorRaw = process.env.BOT_TESTNET_KNOWN_BLOCK;
  if (observedFloorRaw && /^\d+$/.test(observedFloorRaw)) {
    const floor = Number(observedFloorRaw);
    line("OBSERVED BLOCK FLOOR", String(floor));
    line(
      "FLOOR CHECK",
      health.maxBlock >= floor
        ? "PASS (head at or above floor)"
        : "WARN (head below floor - explorer-confirmed state may not be visible yet)",
    );
  }

  if (!wallet.configured || !wallet.address) {
    line("TESTNET WALLET", "NOT CONFIGURED");
  } else {
    const bal = await probe("eth_getBalance (testnet)", () =>
      publicClient.getBalance({ address: wallet.address }),
    );
    line("TESTNET WALLET", "CONFIGURED");
    line("  address", wallet.address);
    if (bal.ok) {
      const wei = BigInt(bal.value as bigint);
      line("TBOT BALANCE", `${formatUnits(wei, 18)} tBOT`);
    }
  }

  console.log("\n== SETTLEMENT TOKEN INVESTIGATION ==");
  const code = await probe("eth_getCode", () =>
    publicClient.getCode({ address: CANDIDATE_BOT_TESTNET_USDT_ADDRESS }),
  );
  const codeHex = code.ok ? String(code.value) : "";
  const hasCode = codeHex.length > 2;
  line("  code present", hasCode ? "YES" : "NO");
  if (hasCode) {
    const name = await probe("name()", () =>
      publicClient.readContract({
        address: CANDIDATE_BOT_TESTNET_USDT_ADDRESS,
        abi: erc20Abi,
        functionName: "name",
      }),
    );
    const symbol = await probe("symbol()", () =>
      publicClient.readContract({
        address: CANDIDATE_BOT_TESTNET_USDT_ADDRESS,
        abi: erc20Abi,
        functionName: "symbol",
      }),
    );
    const decimals = await probe("decimals()", () =>
      publicClient.readContract({
        address: CANDIDATE_BOT_TESTNET_USDT_ADDRESS,
        abi: erc20Abi,
        functionName: "decimals",
      }),
    );
    if (name.ok) line("  name", String(name.value));
    if (symbol.ok) line("  symbol", String(symbol.value));
    if (decimals.ok) line("  decimals", String(decimals.value));
  }

  line("settlement-token status", BOT_TESTNET_SETTLEMENT_TOKEN.status);
  console.log(
    "  note: final VERIFIED/PROVISIONALLY VERIFIED/UNRESOLVED/NOT_AVAILABLE decision is recorded in lib/chain/settlement-token.ts after all evidence is reviewed.",
  );
}

main().catch((err) => {
  console.error("DOCTOR FAILED:", err instanceof Error ? err.message : err);
  process.exit(1);
});