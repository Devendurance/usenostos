import { expect, type Page } from "@playwright/test";
import {
  decodeFunctionData,
  encodeFunctionResult,
  erc20Abi,
  type Hex,
} from "viem";
import { nostosAsyncVaultP4Abi } from "@/lib/contracts/nostos-async-vault-p4-abi";
import { nostosRedemptionTicketAbi } from "@/lib/contracts/nostos-redemption-ticket-abi";

export const P4_FIXTURE_VAULT = "0x0000000000000000000000000000000000000101" as const;
export const P4_FIXTURE_TICKET = "0x0000000000000000000000000000000000000202" as const;
export const P4_FIXTURE_ALICE = "0x1234567890abcdef1234567890abcdef12345678" as const;
export const P4_FIXTURE_BOB = "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd" as const;

type FixtureState = {
  owner: `0x${string}`;
  status: 1 | 2 | 3;
  rejectNextTransaction: boolean;
  transactionCounter: number;
};

type ProviderWindow = Window & {
  __nostosP4Provider?: {
    setAccount: (address: string) => void;
  };
};

function rpcResult(id: number, result: unknown) {
  return { jsonrpc: "2.0", id, result };
}

function rpcError(id: number, message: string) {
  return { jsonrpc: "2.0", id, error: { code: 3, message } };
}

function encodedResult(
  abi: typeof nostosAsyncVaultP4Abi | typeof nostosRedemptionTicketAbi | typeof erc20Abi,
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

export async function installP4RpcFixture(
  page: Page,
  initial: Partial<Pick<FixtureState, "owner" | "status">> = {},
) {
  const state: FixtureState = {
    owner: initial.owner ?? P4_FIXTURE_ALICE,
    status: initial.status ?? 2,
    rejectNextTransaction: false,
    transactionCounter: 0,
  };

  await page.route("https://rpc.bohr.life/**", async (route) => {
    const body = JSON.parse(route.request().postData() ?? "{}") as {
      id: number;
      method: string;
      params?: unknown[];
    };
    const call = (body.params?.[0] ?? {}) as { to?: string; data?: Hex };

    if (body.method === "eth_chainId") {
      await route.fulfill({ json: rpcResult(body.id, "0x3c8") });
      return;
    }
    if (body.method === "net_version") {
      await route.fulfill({ json: rpcResult(body.id, "968") });
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
          from: P4_FIXTURE_ALICE,
          to: P4_FIXTURE_TICKET,
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
      if (transaction.data && isAddress(transaction.to, P4_FIXTURE_TICKET)) {
        const decoded = decodeFunctionData({
          abi: nostosRedemptionTicketAbi,
          data: transaction.data,
        });
        if (decoded.functionName === "safeTransferFrom") {
          state.owner = decoded.args[1] as `0x${string}`;
        }
      }
      if (transaction.data && isAddress(transaction.to, P4_FIXTURE_VAULT)) {
        const decoded = decodeFunctionData({
          abi: nostosAsyncVaultP4Abi,
          data: transaction.data,
        });
        if (decoded.functionName === "claimRedeem") {
          state.status = 3;
        }
      }
      state.transactionCounter += 1;
      const hash = (`0x${String(state.transactionCounter).padStart(64, "0")}`) as Hex;
      await route.fulfill({ json: rpcResult(body.id, hash) });
      return;
    }
    if (body.method !== "eth_call") {
      await route.fulfill({ json: rpcResult(body.id, "0x0") });
      return;
    }

    if (!call.data || isAddress(call.to, P4_FIXTURE_TICKET)) {
      if (call.data && isAddress(call.to, P4_FIXTURE_TICKET)) {
        const decoded = decodeFunctionData({ abi: nostosRedemptionTicketAbi, data: call.data });
        switch (decoded.functionName) {
          case "ownerOf":
            if (state.status === 3 || (decoded.args[0] as bigint) !== BigInt(7)) {
              await route.fulfill({ json: rpcError(body.id, "ERC721NonexistentToken") });
              return;
            }
            await route.fulfill({
              json: rpcResult(body.id, encodedResult(nostosRedemptionTicketAbi, "ownerOf", state.owner)),
            });
            return;
          case "getApproved":
            await route.fulfill({ json: rpcResult(body.id, encodedResult(nostosRedemptionTicketAbi, "getApproved", "0x0000000000000000000000000000000000000000")) });
            return;
          case "isApprovedForAll":
          case "isAuthorized":
            await route.fulfill({ json: rpcResult(body.id, encodedResult(nostosRedemptionTicketAbi, decoded.functionName, decoded.functionName === "isAuthorized" ? false : false)) });
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
            await route.fulfill({ json: rpcResult(body.id, encodedResult(nostosRedemptionTicketAbi, "vault", P4_FIXTURE_VAULT)) });
            return;
          case "supportsInterface":
            await route.fulfill({ json: rpcResult(body.id, encodedResult(nostosRedemptionTicketAbi, "supportsInterface", true)) });
            return;
          default:
            break;
        }
      }
    }

    if (call.data && isAddress(call.to, P4_FIXTURE_VAULT)) {
      const decoded = decodeFunctionData({ abi: nostosAsyncVaultP4Abi, data: call.data });
      switch (decoded.functionName) {
        case "asset":
          await route.fulfill({ json: rpcResult(body.id, encodedResult(nostosAsyncVaultP4Abi, "asset", "0x0000000000000000000000000000000000000303")) });
          return;
        case "decimals":
          await route.fulfill({ json: rpcResult(body.id, encodedResult(nostosAsyncVaultP4Abi, "decimals", 6)) });
          return;
        case "totalAssets":
        case "totalSupply":
        case "reservedClaimableAssets":
        case "balanceOf":
        case "allowance":
          await route.fulfill({ json: rpcResult(body.id, encodedResult(nostosAsyncVaultP4Abi, decoded.functionName, BigInt(5_000_000))) });
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
                isAddress(decoded.args[0], P4_FIXTURE_ALICE) ? BigInt(7) : BigInt(0),
              ),
            ),
          });
          return;
        case "requestController":
          await route.fulfill({ json: rpcResult(body.id, encodedResult(nostosAsyncVaultP4Abi, "requestController", P4_FIXTURE_ALICE)) });
          return;
        case "redemptionTicket":
          await route.fulfill({ json: rpcResult(body.id, encodedResult(nostosAsyncVaultP4Abi, "redemptionTicket", P4_FIXTURE_TICKET)) });
          return;
        case "sharesToAssets":
          await route.fulfill({ json: rpcResult(body.id, encodedResult(nostosAsyncVaultP4Abi, "sharesToAssets", BigInt(5_000_000))) });
          return;
        case "requests":
          await route.fulfill({
            json: rpcResult(
              body.id,
              encodedResult(nostosAsyncVaultP4Abi, "requests", [BigInt(7), P4_FIXTURE_ALICE, P4_FIXTURE_ALICE, BigInt(5_000_000), BigInt(5_000_000), BigInt(1), BigInt(2), BigInt(0), state.status]),
            ),
          });
          return;
        default:
          break;
      }
    }

    if (call.data?.startsWith("0x70a08231")) {
      await route.fulfill({
        json: rpcResult(body.id, encodedResult(erc20Abi, "balanceOf", BigInt(5_000_000))),
      });
      return;
    }
    if (call.data?.startsWith("0xdd62ed3e")) {
      await route.fulfill({
        json: rpcResult(body.id, encodedResult(erc20Abi, "allowance", BigInt(0))),
      });
      return;
    }

    await route.fulfill({ json: rpcResult(body.id, "0x0") });
  });

  await page.addInitScript(({ initialAccount }) => {
    const listeners: Record<string, Array<(...args: unknown[]) => void>> = {};
    let account: string = initialAccount;
    const provider = {
      isMetaMask: true,
      get chainId() {
        return "0x3c8";
      },
      request: async ({ method, params }: { method: string; params?: unknown[] }) => {
        if (method === "eth_chainId") return "0x3c8";
        if (method === "net_version") return "968";
        if (method === "eth_accounts" || method === "eth_requestAccounts") return [account];
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
      setAccount: (next: string) => {
        account = next;
        for (const callback of listeners.accountsChanged ?? []) callback([account]);
      },
    };
    (window as ProviderWindow).__nostosP4Provider = provider;
    (window as unknown as { ethereum: typeof provider }).ethereum = provider;
  }, { initialAccount: P4_FIXTURE_ALICE });

  return {
    state,
    async switchAccount(next: `0x${string}`) {
      await page.evaluate((address) => {
        (window as ProviderWindow).__nostosP4Provider?.setAccount(address);
      }, next);
    },
    async rejectNextTransaction() {
      state.rejectNextTransaction = true;
    },
    async expectConfirmed() {
      await expect(page.getByTestId("p4-tx-stage")).toContainText("CONFIRMED");
    },
  };
}
