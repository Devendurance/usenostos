import { createPublicClient, erc20Abi, formatUnits, http } from "viem";
import {
  botMainnet,
  BOT_CHAIN_ID,
  BOT_CHAIN_RPC_URL,
  BOT_CHAIN_EXPLORER_URL,
  BOT_NATIVE_SYMBOL,
  BOT_NATIVE_DECIMALS,
} from "../lib/chain/bot-mainnet";
import {
  BOT_USDT,
  CANDIDATE_BOT_USDT_ADDRESS,
} from "../lib/chain/settlement-token";
import { getBuilderWallet } from "../lib/chain/builder-wallet";
import { loadScriptEnv } from "./load-script-env";

loadScriptEnv();

const rpcUrl = process.env.BOT_MAINNET_RPC_URL ?? BOT_CHAIN_RPC_URL;

const publicClient = createPublicClient({
  chain: botMainnet,
  transport: http(rpcUrl, { timeout: 15_000, retryCount: 0 }),
});

function section(title: string) {
  console.log(`\n== ${title} ==`);
}

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
  section("NETWORK");
  line("expected chain id", String(BOT_CHAIN_ID));
  line("rpc", rpcUrl);
  line("explorer base url", BOT_CHAIN_EXPLORER_URL);
  line("native currency", `${BOT_NATIVE_SYMBOL} / ${BOT_NATIVE_DECIMALS} decimals`);

  const chainIdProbe = await probe("eth_chainId", () => publicClient.getChainId());
  line("RPC reachable", chainIdProbe.ok ? "YES" : "NO");
  if (!chainIdProbe.ok) {
    console.error("\nFATAL: RPC unreachable; cannot verify BOT Mainnet identity.");
    process.exit(1);
  }
  const chainId = Number(chainIdProbe.value);
  line("returned chain id", String(chainId));
  if (chainId !== BOT_CHAIN_ID) {
    console.error(
      `\nFATAL: RPC returned chain id ${chainId}, expected ${BOT_CHAIN_ID}. Refusing to continue.`,
    );
    process.exit(1);
  }
  line("chain id check", "PASS (677)");

  const block = await probe("latest block", () => publicClient.getBlockNumber());
  if (block.ok) line("latest block number", String(block.value));

  section("RPC CAPABILITY AUDIT");
  await probe("eth_getBalance", () =>
    publicClient.getBalance({ address: "0x0000000000000000000000000000000000000000" }),
  );
  await probe("eth_call (erc20 name on candidate)", () =>
    publicClient.readContract({
      address: CANDIDATE_BOT_USDT_ADDRESS,
      abi: erc20Abi,
      functionName: "name",
    }),
  );
  await probe("eth_getCode (candidate)", () =>
    publicClient.getCode({ address: CANDIDATE_BOT_USDT_ADDRESS }),
  );

  const logs = await probe("eth_getLogs (historical range)", () =>
    publicClient.request({
      method: "eth_getLogs",
      params: [
        {
          fromBlock: block.ok
            ? `0x${(BigInt(String(block.value)) - BigInt(200)).toString(16)}`
            : "latest",
          toBlock: block.ok
            ? `0x${BigInt(String(block.value)).toString(16)}`
            : "latest",
          address: CANDIDATE_BOT_USDT_ADDRESS,
        },
      ],
    }),
  );
  if (logs.ok) {
    const entries = Array.isArray(logs.value) ? logs.value.length : -1;
    line(
      "HISTORICAL LOG INDEXING VIA OFFICIAL RPC",
      `SUPPORTED (${entries} logs in range)`,
    );
  } else {
    line("HISTORICAL LOG INDEXING VIA OFFICIAL RPC", "UNSUPPORTED");
  }
  console.log(
    "  implication: if unsupported, historical event indexing requires an approved third-party RPC/WebSocket/indexer/explorer (P7).",
  );

  section("BUILDER WALLET");
  const wallet = getBuilderWallet();
  if (!wallet.configured || !wallet.address) {
    line("BUILDER WALLET", "NOT CONFIGURED");
  } else {
    const bal = await probe("eth_getBalance (builder)", () =>
      publicClient.getBalance({ address: wallet.address }),
    );
    line("BUILDER WALLET", "CONFIGURED");
    line("  address", wallet.address);
    if (bal.ok) {
      const wei = BigInt(bal.value as bigint);
      line("  BOT balance", `${formatUnits(wei, BOT_NATIVE_DECIMALS)} BOT`);
      line("  balance non-zero", wei > BigInt(0) ? "YES" : "NO");
      line("  readiness (tiny tx)", wei > BigInt(0) ? "READY" : "INSUFFICIENT");
    }
  }

  section("USDT INVESTIGATION");
  line("candidate address", CANDIDATE_BOT_USDT_ADDRESS);

  const code = await probe("eth_getCode", () =>
    publicClient.getCode({ address: CANDIDATE_BOT_USDT_ADDRESS }),
  );
  const codeHex = code.ok ? String(code.value) : "";
  const hasCode = codeHex.length > 2;
  line("  code present", hasCode ? "YES" : "NO");

  if (hasCode) {
    const name = await probe("name()", () =>
      publicClient.readContract({
        address: CANDIDATE_BOT_USDT_ADDRESS,
        abi: erc20Abi,
        functionName: "name",
      }),
    );
    const symbol = await probe("symbol()", () =>
      publicClient.readContract({
        address: CANDIDATE_BOT_USDT_ADDRESS,
        abi: erc20Abi,
        functionName: "symbol",
      }),
    );
    const decimals = await probe("decimals()", () =>
      publicClient.readContract({
        address: CANDIDATE_BOT_USDT_ADDRESS,
        abi: erc20Abi,
        functionName: "decimals",
      }),
    );
    const total = await probe("totalSupply()", () =>
      publicClient.readContract({
        address: CANDIDATE_BOT_USDT_ADDRESS,
        abi: erc20Abi,
        functionName: "totalSupply",
      }),
    );
    if (name.ok) line("  name", String(name.value));
    if (symbol.ok) line("  symbol", String(symbol.value));
    if (decimals.ok) line("  decimals", String(decimals.value));
    if (total.ok) {
      const dec = decimals.ok ? Number(decimals.value) : 6;
      line("  total supply", `${formatUnits(BigInt(total.value as bigint), dec)}`);
    }
    if (wallet.configured && wallet.address) {
      const bal = await probe("balanceOf(builder)", () =>
        publicClient.readContract({
          address: CANDIDATE_BOT_USDT_ADDRESS,
          abi: erc20Abi,
          functionName: "balanceOf",
          args: [wallet.address],
        }),
      );
      if (bal.ok) {
        const dec = decimals.ok ? Number(decimals.value) : 6;
        line(
          "  builder balance",
          `${formatUnits(BigInt(bal.value as bigint), dec)}`,
        );
      }
    }
  }

  section("SETTLEMENT TOKEN STATUS");
  line("status", BOT_USDT.status);
  console.log(
    "  note: final VERIFIED/PROVISIONALLY VERIFIED/UNRESOLVED/REJECTED decision is recorded in lib/chain/settlement-token.ts after all evidence is reviewed.",
  );
}

main().catch((err) => {
  console.error("DOCTOR FAILED:", err instanceof Error ? err.message : err);
  process.exit(1);
});