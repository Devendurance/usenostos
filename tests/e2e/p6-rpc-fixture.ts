import { expect, type Page } from "@playwright/test";
import {
  decodeFunctionData,
  encodeFunctionResult,
  erc20Abi,
  type Hex,
} from "viem";
import { nostosAsyncVaultP4Abi } from "@/lib/contracts/nostos-async-vault-p4-abi";
import { nostosRedemptionTicketAbi } from "@/lib/contracts/nostos-redemption-ticket-abi";
import { nostosInstantPoolP6Abi } from "@/lib/contracts/nostos-instant-pool-p6-abi";
import { CANDIDATE_BOT_TESTNET_USDT_ADDRESS } from "@/lib/chain/settlement-token";

export const P6_FIXTURE_VAULT = "0x0000000000000000000000000000000000000101" as const;
export const P6_FIXTURE_TICKET = "0x0000000000000000000000000000000000000202" as const;
export const P6_FIXTURE_POOL = "0x0000000000000000000000000000000000000404" as const;
export const P6_FIXTURE_USDT = CANDIDATE_BOT_TESTNET_USDT_ADDRESS;
export const P6_FIXTURE_TREASURY = "0x0000000000000000000000000000000000000505" as const;
export const P6_FIXTURE_ALICE = "0x1234567890abcdef1234567890abcdef12345678" as const;
export const P6_FIXTURE_ZERO = "0x0000000000000000000000000000000000000000" as const;
export const P6_FIXTURE_UNLOCK_AT = BigInt(2_000_000_000);

type FixtureState = {
  owner: `0x${string}`;
  status: 1 | 2 | 3;
  approved: boolean;
  sold: boolean;
  rejectNextTransaction: boolean;
  transactionCounter: number;
  usdtAllowance: bigint;
  userShares: bigint;
  unlockAt: bigint;
  availableLiquidity: bigint;
  maxRedeem: bigint;
  cashDeployed: boolean;
};

type ProviderWindow = Window & {
  __nostosP6Provider?: {
    setAccount: (address: string | null) => void;
  };
};

function rpcResult(id: number, result: unknown) {
  return { jsonrpc: "2.0", id, result };
}

function rpcError(id: number, message: string) {
  return { jsonrpc: "2.0", id, error: { code: 3, message } };
}

function encodedResult(
  abi:
    | typeof nostosAsyncVaultP4Abi
    | typeof nostosRedemptionTicketAbi
    | typeof nostosInstantPoolP6Abi
    | typeof erc20Abi,
  functionName: string,
  result: unknown,
): Hex {
  return encodeFunctionResult({
    abi,
    functionName: functionName as never,
    result: result as never,
  });
}

function isAddress(value: unknown, expected: string): boolean {
  return typeof value === "string" && value.toLowerCase() === expected.toLowerCase();
}

export async function installP6RpcFixture(
  page: Page,
  initial: Partial<Pick<FixtureState, "owner" | "status" | "unlockAt" | "cashDeployed" | "userShares">> & {
    chainId?: `0x${string}`;
  } = {},
) {
  const cashDeployed = initial.cashDeployed ?? false;
  const state: FixtureState = {
    owner: initial.owner ?? P6_FIXTURE_ALICE,
    status: initial.status ?? 1,
    approved: false,
    sold: false,
    rejectNextTransaction: false,
    transactionCounter: 0,
    usdtAllowance: BigInt(0),
    userShares: initial.userShares ?? BigInt("2000000000000000000"),
    unlockAt: initial.unlockAt ?? BigInt(0),
    availableLiquidity: cashDeployed ? BigInt(0) : BigInt(500_000_000),
    maxRedeem: cashDeployed || (initial.unlockAt !== undefined && initial.unlockAt > BigInt(0))
      ? BigInt(0)
      : (initial.userShares ?? BigInt("2000000000000000000")),
    cashDeployed,
  };
  const chainId = initial.chainId ?? "0x3c8";

  await page.route("https://rpc.bohr.life/**", async (route) => {
    const body = JSON.parse(route.request().postData() ?? "{}") as {
      id: number;
      method: string;
      params?: unknown[];
    };
    const call = (body.params?.[0] ?? {}) as { to?: string; data?: Hex };

    if (body.method === "eth_chainId") {
      await route.fulfill({ json: rpcResult(body.id, chainId) });
      return;
    }
    if (body.method === "net_version") {
      await route.fulfill({ json: rpcResult(body.id, chainId === "0x3c8" ? "968" : "677") });
      return;
    }
    if (body.method === "eth_blockNumber") {
      await route.fulfill({ json: rpcResult(body.id, "0x100") });
      return;
    }
    if (body.method === "eth_getCode") {
      await route.fulfill({ json: rpcResult(body.id, "0x60006000") });
      return;
    }
    if (body.method === "eth_getBalance" || body.method === "eth_getTransactionCount") {
      await route.fulfill({ json: rpcResult(body.id, "0x0") });
      return;
    }
    if (
      body.method === "eth_gasPrice" ||
      body.method === "eth_maxPriorityFeePerGas" ||
      body.method === "eth_estimateGas"
    ) {
      await route.fulfill({ json: rpcResult(body.id, "0x1") });
      return;
    }
    if (body.method === "eth_getTransactionReceipt") {
      await route.fulfill({
        json: rpcResult(body.id, {
          transactionHash: body.params?.[0],
          transactionIndex: "0x0",
          blockHash: "0x" + "11".repeat(32),
          blockNumber: "0x100",
          from: P6_FIXTURE_ALICE,
          to: P6_FIXTURE_POOL,
          cumulativeGasUsed: "0x1",
          gasUsed: "0x1",
          contractAddress: null,
          logs: [],
          logsBloom: "0x" + "00".repeat(256),
          status: "0x1",
          effectiveGasPrice: "0x1",
          type: "0x2",
        }),
      });
      return;
    }
    if (body.method === "eth_sendTransaction") {
      if (state.rejectNextTransaction) {
        state.rejectNextTransaction = false;
        await route.fulfill({ json: rpcError(body.id, "User rejected the request") });
        return;
      }
      const transaction = (body.params?.[0] ?? {}) as { to?: string; data?: Hex };
      if (transaction.data && isAddress(transaction.to, P6_FIXTURE_USDT)) {
        const decoded = decodeFunctionData({ abi: erc20Abi, data: transaction.data });
        if (decoded.functionName === "approve") {
          state.usdtAllowance = decoded.args[1] as bigint;
        }
      }
      if (transaction.data && isAddress(transaction.to, P6_FIXTURE_TICKET)) {
        const decoded = decodeFunctionData({
          abi: nostosRedemptionTicketAbi,
          data: transaction.data,
        });
        if (decoded.functionName === "approve") {
          state.approved = true;
        }
      }
      if (transaction.data && isAddress(transaction.to, P6_FIXTURE_POOL)) {
        const decoded = decodeFunctionData({
          abi: nostosInstantPoolP6Abi,
          data: transaction.data,
        });
        if (decoded.functionName === "sellTicket") {
          state.owner = P6_FIXTURE_POOL;
          state.sold = true;
        }
        if (decoded.functionName === "deposit") {
          const assets = decoded.args[0] as bigint;
          state.userShares += assets * BigInt(1_000_000_000_000);
          state.unlockAt = P6_FIXTURE_UNLOCK_AT;
          state.maxRedeem = BigInt(0);
        }
        if (decoded.functionName === "redeem") {
          const shares = decoded.args[0] as bigint;
          state.userShares = state.userShares > shares ? state.userShares - shares : BigInt(0);
        }
      }
      state.transactionCounter += 1;
      const hash = `0x${String(state.transactionCounter).padStart(64, "0")}` as Hex;
      await route.fulfill({ json: rpcResult(body.id, hash) });
      return;
    }
    if (body.method !== "eth_call") {
      await route.fulfill({ json: rpcResult(body.id, "0x0") });
      return;
    }

    if (call.data && isAddress(call.to, P6_FIXTURE_TICKET)) {
      const decoded = decodeFunctionData({ abi: nostosRedemptionTicketAbi, data: call.data });
      switch (decoded.functionName) {
        case "ownerOf":
          if (decoded.args[0] !== BigInt(7)) {
            await route.fulfill({ json: rpcError(body.id, "ERC721NonexistentToken") });
            return;
          }
          await route.fulfill({
            json: rpcResult(body.id, encodedResult(nostosRedemptionTicketAbi, "ownerOf", state.owner)),
          });
          return;
        case "getApproved":
          await route.fulfill({
            json: rpcResult(
              body.id,
              encodedResult(
                nostosRedemptionTicketAbi,
                "getApproved",
                state.approved ? P6_FIXTURE_POOL : P6_FIXTURE_ZERO,
              ),
            ),
          });
          return;
        case "isApprovedForAll":
        case "isAuthorized":
          await route.fulfill({
            json: rpcResult(body.id, encodedResult(nostosRedemptionTicketAbi, decoded.functionName, false)),
          });
          return;
        case "balanceOf":
          await route.fulfill({
            json: rpcResult(
              body.id,
              encodedResult(
                nostosRedemptionTicketAbi,
                "balanceOf",
                isAddress(decoded.args[0], state.owner) ? BigInt(1) : BigInt(0),
              ),
            ),
          });
          return;
        case "vault":
          await route.fulfill({ json: rpcResult(body.id, encodedResult(nostosRedemptionTicketAbi, "vault", P6_FIXTURE_VAULT)) });
          return;
        case "supportsInterface":
          await route.fulfill({ json: rpcResult(body.id, encodedResult(nostosRedemptionTicketAbi, "supportsInterface", true)) });
          return;
        default:
          break;
      }
    }

    if (call.data && isAddress(call.to, P6_FIXTURE_VAULT)) {
      const decoded = decodeFunctionData({ abi: nostosAsyncVaultP4Abi, data: call.data });
      switch (decoded.functionName) {
        case "asset":
          await route.fulfill({ json: rpcResult(body.id, encodedResult(nostosAsyncVaultP4Abi, "asset", P6_FIXTURE_USDT)) });
          return;
        case "decimals":
          await route.fulfill({ json: rpcResult(body.id, encodedResult(nostosAsyncVaultP4Abi, "decimals", 6)) });
          return;
        case "totalAssets":
        case "totalSupply":
        case "reservedClaimableAssets":
        case "balanceOf":
        case "allowance":
          await route.fulfill({ json: rpcResult(body.id, encodedResult(nostosAsyncVaultP4Abi, decoded.functionName, BigInt(0))) });
          return;
        case "nextRequestId":
          await route.fulfill({ json: rpcResult(body.id, encodedResult(nostosAsyncVaultP4Abi, "nextRequestId", BigInt(8))) });
          return;
        case "activeRequestId":
          await route.fulfill({
            json: rpcResult(
              body.id,
              encodedResult(
                nostosAsyncVaultP4Abi,
                "activeRequestId",
                isAddress(decoded.args[0], P6_FIXTURE_ALICE) ? BigInt(7) : BigInt(0),
              ),
            ),
          });
          return;
        case "requestController":
          await route.fulfill({ json: rpcResult(body.id, encodedResult(nostosAsyncVaultP4Abi, "requestController", P6_FIXTURE_ALICE)) });
          return;
        case "redemptionTicket":
          await route.fulfill({ json: rpcResult(body.id, encodedResult(nostosAsyncVaultP4Abi, "redemptionTicket", P6_FIXTURE_TICKET)) });
          return;
        case "sharesToAssets":
          await route.fulfill({ json: rpcResult(body.id, encodedResult(nostosAsyncVaultP4Abi, "sharesToAssets", BigInt(100_000_000))) });
          return;
        case "requests":
          await route.fulfill({
            json: rpcResult(
              body.id,
              encodedResult(nostosAsyncVaultP4Abi, "requests", [
                BigInt(7),
                P6_FIXTURE_ALICE,
                P6_FIXTURE_ALICE,
                BigInt(100_000_000),
                BigInt(0),
                BigInt(1),
                BigInt(0),
                BigInt(0),
                state.status,
              ]),
            ),
          });
          return;
        default:
          break;
      }
    }

    if (call.data && isAddress(call.to, P6_FIXTURE_POOL)) {
      const decoded = decodeFunctionData({ abi: nostosInstantPoolP6Abi, data: call.data });
      switch (decoded.functionName) {
        case "asset":
          await route.fulfill({ json: rpcResult(body.id, encodedResult(nostosInstantPoolP6Abi, "asset", P6_FIXTURE_USDT)) });
          return;
        case "vault":
          await route.fulfill({ json: rpcResult(body.id, encodedResult(nostosInstantPoolP6Abi, "vault", P6_FIXTURE_VAULT)) });
          return;
        case "ticket":
          await route.fulfill({ json: rpcResult(body.id, encodedResult(nostosInstantPoolP6Abi, "ticket", P6_FIXTURE_TICKET)) });
          return;
        case "protocolTreasury":
          await route.fulfill({ json: rpcResult(body.id, encodedResult(nostosInstantPoolP6Abi, "protocolTreasury", P6_FIXTURE_TREASURY)) });
          return;
        case "availableLiquidity":
          await route.fulfill({
            json: rpcResult(body.id, encodedResult(nostosInstantPoolP6Abi, "availableLiquidity", state.availableLiquidity)),
          });
          return;
        case "lpNav":
          await route.fulfill({ json: rpcResult(body.id, encodedResult(nostosInstantPoolP6Abi, "lpNav", BigInt(800_000_000))) });
          return;
        case "totalSupply":
          await route.fulfill({
            json: rpcResult(body.id, encodedResult(nostosInstantPoolP6Abi, "totalSupply", BigInt("1000000000000000000"))),
          });
          return;
        case "sharePrice":
          await route.fulfill({ json: rpcResult(body.id, encodedResult(nostosInstantPoolP6Abi, "sharePrice", BigInt(800_000_000))) });
          return;
        case "outstandingFaceValue":
          await route.fulfill({
            json: rpcResult(body.id, encodedResult(nostosInstantPoolP6Abi, "outstandingFaceValue", BigInt(320_000_000))),
          });
          return;
        case "outstandingCostBasis":
          await route.fulfill({
            json: rpcResult(
              body.id,
              encodedResult(nostosInstantPoolP6Abi, "outstandingCostBasis", cashDeployed ? BigInt(800_000_000) : BigInt(300_000_000)),
            ),
          });
          return;
        case "utilizationBps":
          await route.fulfill({ json: rpcResult(body.id, encodedResult(nostosInstantPoolP6Abi, "utilizationBps", BigInt(3902))) });
          return;
        case "cumulativeGrossSpread":
          await route.fulfill({
            json: rpcResult(body.id, encodedResult(nostosInstantPoolP6Abi, "cumulativeGrossSpread", BigInt(12_500_000))),
          });
          return;
        case "accruedProtocolFees":
          await route.fulfill({
            json: rpcResult(body.id, encodedResult(nostosInstantPoolP6Abi, "accruedProtocolFees", BigInt(1_250_000))),
          });
          return;
        case "cumulativeProtocolFees":
          await route.fulfill({
            json: rpcResult(body.id, encodedResult(nostosInstantPoolP6Abi, "cumulativeProtocolFees", BigInt(2_500_000))),
          });
          return;
        case "lpRealizedProfit":
          await route.fulfill({
            json: rpcResult(body.id, encodedResult(nostosInstantPoolP6Abi, "lpRealizedProfit", BigInt(10_000_000))),
          });
          return;
        case "decimals":
          await route.fulfill({ json: rpcResult(body.id, encodedResult(nostosInstantPoolP6Abi, "decimals", 18)) });
          return;
        case "balanceOf":
          await route.fulfill({
            json: rpcResult(
              body.id,
              encodedResult(
                nostosInstantPoolP6Abi,
                "balanceOf",
                isAddress(decoded.args[0], P6_FIXTURE_ALICE) ? state.userShares : BigInt(0),
              ),
            ),
          });
          return;
        case "maxRedeem":
          await route.fulfill({ json: rpcResult(body.id, encodedResult(nostosInstantPoolP6Abi, "maxRedeem", state.maxRedeem)) });
          return;
        case "withdrawalUnlockAt":
          await route.fulfill({
            json: rpcResult(body.id, encodedResult(nostosInstantPoolP6Abi, "withdrawalUnlockAt", state.unlockAt)),
          });
          return;
        case "previewDeposit": {
          const assets = decoded.args[0] as bigint;
          await route.fulfill({
            json: rpcResult(body.id, encodedResult(nostosInstantPoolP6Abi, "previewDeposit", assets * BigInt(1_000_000_000_000))),
          });
          return;
        }
        case "previewRedeem": {
          const shares = decoded.args[0] as bigint;
          await route.fulfill({
            json: rpcResult(body.id, encodedResult(nostosInstantPoolP6Abi, "previewRedeem", shares / BigInt(1_000_000_000_000))),
          });
          return;
        }
        case "getPricing":
          await route.fulfill({
            json: rpcResult(
              body.id,
              encodedResult(nostosInstantPoolP6Abi, "getPricing", [
                BigInt(100),
                BigInt(1000),
                BigInt(500),
                BigInt(0),
                BigInt(3000),
                BigInt(9000),
              ]),
            ),
          });
          return;
        case "quoteTicket":
          await route.fulfill({
            json: rpcResult(
              body.id,
              encodedResult(nostosInstantPoolP6Abi, "quoteTicket", [
                BigInt(100_000_000),
                BigInt(98_500_000),
                BigInt(150),
                BigInt(3902),
                BigInt(1_000),
                BigInt(4_000),
              ]),
            ),
          });
          return;
        case "positions":
          await route.fulfill({
            json: rpcResult(
              body.id,
              encodedResult(nostosInstantPoolP6Abi, "positions", [
                BigInt(7),
                BigInt(7),
                P6_FIXTURE_ALICE,
                BigInt(100_000_000),
                BigInt(98_500_000),
                BigInt(150),
                BigInt(1),
                BigInt(0),
                state.sold ? 0 : 0,
              ]),
            ),
          });
          return;
        default:
          break;
      }
    }

    if (call.data && isAddress(call.to, P6_FIXTURE_USDT)) {
      const decoded = decodeFunctionData({ abi: erc20Abi, data: call.data });
      switch (decoded.functionName) {
        case "allowance":
          await route.fulfill({ json: rpcResult(body.id, encodedResult(erc20Abi, "allowance", state.usdtAllowance)) });
          return;
        case "balanceOf":
          await route.fulfill({ json: rpcResult(body.id, encodedResult(erc20Abi, "balanceOf", BigInt(10_000_000_000))) });
          return;
        case "decimals":
          await route.fulfill({ json: rpcResult(body.id, encodedResult(erc20Abi, "decimals", 6)) });
          return;
        default:
          break;
      }
    }

    if (call.data?.startsWith("0x70a08231")) {
      await route.fulfill({ json: rpcResult(body.id, encodedResult(erc20Abi, "balanceOf", BigInt(10_000_000_000))) });
      return;
    }
    if (call.data?.startsWith("0xdd62ed3e")) {
      await route.fulfill({ json: rpcResult(body.id, encodedResult(erc20Abi, "allowance", state.usdtAllowance)) });
      return;
    }

    await route.fulfill({ json: rpcResult(body.id, "0x0") });
  });

  await page.addInitScript(({ initialAccount, chainId }) => {
    const listeners: Record<string, Array<(...args: unknown[]) => void>> = {};
    let account: string | null = initialAccount;
    const provider = {
      isMetaMask: true,
      get chainId() {
        return chainId;
      },
      request: async ({ method, params }: { method: string; params?: unknown[] }) => {
        if (method === "eth_chainId") return chainId;
        if (method === "net_version") return chainId === "0x3c8" ? "968" : "677";
        if (method === "eth_accounts" || method === "eth_requestAccounts") {
          return account ? [account] : [];
        }
        if (method === "wallet_getPermissions") return [];
        if (method === "wallet_switchEthereumChain") return null;
        if (method === "eth_sendTransaction") {
          const response = await fetch("https://rpc.bohr.life", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ jsonrpc: "2.0", id: Date.now(), method, params }),
          });
          const payload = await response.json();
          if (payload.error) throw new Error(payload.error.message);
          return payload.result;
        }
        return null;
      },
      on: (event: string, callback: (...args: unknown[]) => void) => {
        (listeners[event] ??= []).push(callback);
      },
      removeListener: (event: string, callback: (...args: unknown[]) => void) => {
        listeners[event] = (listeners[event] ?? []).filter((item) => item !== callback);
      },
      setAccount: (next: string | null) => {
        account = next;
        for (const callback of listeners.accountsChanged ?? []) callback([account]);
      },
    };
    (window as ProviderWindow).__nostosP6Provider = provider;
    (window as unknown as { ethereum: typeof provider }).ethereum = provider;
  }, { initialAccount: P6_FIXTURE_ALICE, chainId });

  return {
    state,
    async switchAccount(next: `0x${string}` | null) {
      await page.evaluate((address) => {
        (window as ProviderWindow).__nostosP6Provider?.setAccount(address);
      }, next);
    },
    async rejectNextTransaction() {
      state.rejectNextTransaction = true;
    },
    async expectConfirmed() {
      await expect(page.getByTestId("p6-tx-stage")).toContainText("CONFIRMED");
    },
  };
}
