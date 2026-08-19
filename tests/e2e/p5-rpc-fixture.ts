import { expect, type Page } from "@playwright/test";
import {
  decodeFunctionData,
  encodeFunctionResult,
  erc20Abi,
  type Hex,
} from "viem";
import { nostosAsyncVaultP4Abi } from "@/lib/contracts/nostos-async-vault-p4-abi";
import { nostosRedemptionTicketAbi } from "@/lib/contracts/nostos-redemption-ticket-abi";
import { nostosInstantPoolAbi } from "@/lib/contracts/nostos-instant-pool-abi";

export const P5_FIXTURE_VAULT = "0x0000000000000000000000000000000000000101" as const;
export const P5_FIXTURE_TICKET = "0x0000000000000000000000000000000000000202" as const;
export const P5_FIXTURE_POOL = "0x0000000000000000000000000000000000000303" as const;
export const P5_FIXTURE_ALICE = "0x1234567890abcdef1234567890abcdef12345678" as const;
export const P5_FIXTURE_BOB = "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd" as const;
export const P5_FIXTURE_ZERO = "0x0000000000000000000000000000000000000000" as const;

type FixtureState = {
  owner: `0x${string}`;
  status: 1 | 2 | 3;
  approved: boolean;
  sold: boolean;
  rejectNextTransaction: boolean;
  transactionCounter: number;
};

type ProviderWindow = Window & {
  __nostosP5Provider?: {
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
  abi: typeof nostosAsyncVaultP4Abi | typeof nostosRedemptionTicketAbi | typeof nostosInstantPoolAbi | typeof erc20Abi,
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

export async function installP5RpcFixture(
  page: Page,
  initial: Partial<Pick<FixtureState, "owner" | "status">> & { chainId?: `0x${string}` } = {},
) {
  const state: FixtureState = {
    owner: initial.owner ?? P5_FIXTURE_ALICE,
    status: initial.status ?? 1,
    approved: false,
    sold: false,
    rejectNextTransaction: false,
    transactionCounter: 0,
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
          from: P5_FIXTURE_ALICE,
          to: P5_FIXTURE_POOL,
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
      if (transaction.data && isAddress(transaction.to, P5_FIXTURE_TICKET)) {
        const decoded = decodeFunctionData({
          abi: nostosRedemptionTicketAbi,
          data: transaction.data,
        });
        if (decoded.functionName === "approve") {
          state.approved = true;
        }
      }
      if (transaction.data && isAddress(transaction.to, P5_FIXTURE_POOL)) {
        const decoded = decodeFunctionData({
          abi: nostosInstantPoolAbi,
          data: transaction.data,
        });
        if (decoded.functionName === "sellTicket") {
          state.owner = P5_FIXTURE_POOL;
          state.sold = true;
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

    if (!call.data || isAddress(call.to, P5_FIXTURE_TICKET)) {
      if (call.data && isAddress(call.to, P5_FIXTURE_TICKET)) {
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
                  state.approved ? P5_FIXTURE_POOL : P5_FIXTURE_ZERO,
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
            await route.fulfill({ json: rpcResult(body.id, encodedResult(nostosRedemptionTicketAbi, "vault", P5_FIXTURE_VAULT)) });
            return;
          case "supportsInterface":
            await route.fulfill({ json: rpcResult(body.id, encodedResult(nostosRedemptionTicketAbi, "supportsInterface", true)) });
            return;
          default:
            break;
        }
      }
    }

    if (call.data && isAddress(call.to, P5_FIXTURE_VAULT)) {
      const decoded = decodeFunctionData({ abi: nostosAsyncVaultP4Abi, data: call.data });
      switch (decoded.functionName) {
        case "asset":
          await route.fulfill({ json: rpcResult(body.id, encodedResult(nostosAsyncVaultP4Abi, "asset", P5_FIXTURE_ZERO)) });
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
                isAddress(decoded.args[0], P5_FIXTURE_ALICE) ? BigInt(7) : BigInt(0),
              ),
            ),
          });
          return;
        case "requestController":
          await route.fulfill({ json: rpcResult(body.id, encodedResult(nostosAsyncVaultP4Abi, "requestController", P5_FIXTURE_ALICE)) });
          return;
        case "redemptionTicket":
          await route.fulfill({ json: rpcResult(body.id, encodedResult(nostosAsyncVaultP4Abi, "redemptionTicket", P5_FIXTURE_TICKET)) });
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
                P5_FIXTURE_ALICE,
                P5_FIXTURE_ALICE,
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

    if (call.data && isAddress(call.to, P5_FIXTURE_POOL)) {
      const decoded = decodeFunctionData({ abi: nostosInstantPoolAbi, data: call.data });
      switch (decoded.functionName) {
        case "liquidAssets":
          await route.fulfill({ json: rpcResult(body.id, encodedResult(nostosInstantPoolAbi, "liquidAssets", BigInt(1_000_000_000))) });
          return;
        case "outstandingFaceValue":
        case "outstandingCostBasis":
          await route.fulfill({ json: rpcResult(body.id, encodedResult(nostosInstantPoolAbi, decoded.functionName, BigInt(0))) });
          return;
        case "realizedSpread":
          await route.fulfill({ json: rpcResult(body.id, encodedResult(nostosInstantPoolAbi, "realizedSpread", BigInt(0))) });
          return;
        case "utilizationBps":
          await route.fulfill({ json: rpcResult(body.id, encodedResult(nostosInstantPoolAbi, "utilizationBps", BigInt(0))) });
          return;
        case "positionCount":
          await route.fulfill({ json: rpcResult(body.id, encodedResult(nostosInstantPoolAbi, "positionCount", BigInt(0))) });
          return;
        case "getPricing":
          await route.fulfill({ json: rpcResult(body.id, encodedResult(nostosInstantPoolAbi, "getPricing", [BigInt(100), BigInt(1000), BigInt(500), BigInt(0), BigInt(3000), BigInt(9000)])) });
          return;
        case "quoteTicket":
          await route.fulfill({
            json: rpcResult(
              body.id,
              encodedResult(nostosInstantPoolAbi, "quoteTicket", [
                BigInt(100_000_000),
                BigInt(98_500_000),
                BigInt(150),
                BigInt(0),
                BigInt(1_000),
                BigInt(998),
              ]),
            ),
          });
          return;
        case "positions":
          await route.fulfill({
            json: rpcResult(
              body.id,
              encodedResult(nostosInstantPoolAbi, "positions", [
                BigInt(7),
                BigInt(7),
                P5_FIXTURE_ALICE,
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

    if (call.data?.startsWith("0x70a08231")) {
      await route.fulfill({ json: rpcResult(body.id, encodedResult(erc20Abi, "balanceOf", BigInt(1_000_000_000))) });
      return;
    }
    if (call.data?.startsWith("0xdd62ed3e")) {
      await route.fulfill({ json: rpcResult(body.id, encodedResult(erc20Abi, "allowance", BigInt(0))) });
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
    (window as ProviderWindow).__nostosP5Provider = provider;
    (window as unknown as { ethereum: typeof provider }).ethereum = provider;
  }, { initialAccount: P5_FIXTURE_ALICE, chainId });

  return {
    state,
    async switchAccount(next: `0x${string}` | null) {
      await page.evaluate((address) => {
        (window as ProviderWindow).__nostosP5Provider?.setAccount(address);
      }, next);
    },
    async rejectNextTransaction() {
      state.rejectNextTransaction = true;
    },
    async expectConfirmed() {
      await expect(page.getByTestId("p5-tx-stage")).toContainText("CONFIRMED");
    },
  };
}
