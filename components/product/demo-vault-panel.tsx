"use client";

import { useState } from "react";
import { createPublicClient, formatUnits, http, erc20Abi } from "viem";
import { useAccount, useWriteContract } from "wagmi";
import { useDemoVault } from "@/lib/chain/vault-hooks";
import { nostosAsyncVaultAbi } from "@/lib/contracts/nostos-async-vault-abi";
import { BOT_TESTNET_SETTLEMENT_TOKEN } from "@/lib/chain/settlement-token";
import { FRONTEND_POLICY } from "@/lib/chain/frontend-policy";
import { useBotNetwork } from "@/lib/chain/frontend-hooks";
import {
  botTestnet,
  BOT_TESTNET_RPC_URL,
} from "@/lib/chain/bot-testnet";
import { DataPanel, DefinitionRows, StateNotice } from "@/components/product/product-primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Stage =
  | "idle"
  | "review"
  | "sign"
  | "submitted"
  | "confirming"
  | "confirmed"
  | "failed";

const STAGE_TEXT: Record<Stage, string> = {
  idle: "",
  review: "REVIEW — confirm the transaction details.",
  sign: "SIGN — approve the transaction in your wallet.",
  submitted: "SUBMITTED — transaction broadcast.",
  confirming: "CONFIRMING — waiting for confirmation on BOT Testnet.",
  confirmed: "CONFIRMED — transaction mined.",
  failed: "FAILED",
};

function errorMessage(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  if (/user rejected|user denied|action rejected/i.test(message)) {
    return "Transaction rejected in wallet. No transaction was sent.";
  }
  return message;
}

function StageLine({
  stage,
  error,
  txHash,
}: {
  stage: Stage;
  error: string | null;
  txHash: string | null;
}) {
  return (
    <p className="mt-3 text-xs leading-5 text-muted-foreground" data-testid="tx-stage">
      {stage !== "idle" && STAGE_TEXT[stage]}
      {stage === "confirmed" && txHash && (
        <a
          href={`https://scan.bohr.life/tx/${txHash}`}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-2 underline"
        >
          view on BOT Scan
        </a>
      )}
      {stage === "failed" && error && (
        <span className="block text-[var(--ink)]">{error}</span>
      )}
    </p>
  );
}

export function DemoVaultPanel() {
  const { isBotTestnet, chainId } = useBotNetwork();
  const { address } = useAccount();
  const vault = useDemoVault();
  const [amount, setAmount] = useState("");
  const [stage, setStage] = useState<Stage>("idle");
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  const usdtWrite = useWriteContract();
  const vaultWrite = useWriteContract();

  const publicClient = createPublicClient({
    chain: botTestnet,
    transport: http(BOT_TESTNET_RPC_URL),
  });

  const decimals = vault.usdtDecimals;
  const busy =
    stage === "sign" || stage === "submitted" || stage === "confirming";

  function parseAmount(): bigint | null {
    const n = Number(amount);
    if (!Number.isFinite(n) || n <= 0) return null;
    return BigInt(Math.round(n * 10 ** decimals));
  }

  function parseShares(): bigint | null {
    const n = Number(amount);
    if (!Number.isFinite(n) || n <= 0) return null;
    return BigInt(Math.round(n * 10 ** (vault.shareDecimals ?? decimals)));
  }

  async function waitMined(hash: `0x${string}`) {
    setStage("confirming");
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    if (receipt.status !== "success") {
      throw new Error("Transaction reverted on BOT Testnet.");
    }
    setTxHash(hash);
    setStage("confirmed");
    vault.refetchAll();
  }

  async function handleDeposit() {
    if (!address || !vault.vaultAddress || !BOT_TESTNET_SETTLEMENT_TOKEN.address) return;
    const assets = parseAmount();
    if (assets === null) return;
    setError(null);
    setStage("review");
    try {
      const allowance = (await publicClient.readContract({
        address: BOT_TESTNET_SETTLEMENT_TOKEN.address,
        abi: erc20Abi,
        functionName: "allowance",
        args: [address, vault.vaultAddress],
      })) as bigint;

      if (allowance < assets) {
        setStage("sign");
        const approveHash = await usdtWrite.writeContractAsync({
          address: BOT_TESTNET_SETTLEMENT_TOKEN.address,
          abi: erc20Abi,
          functionName: "approve",
          args: [vault.vaultAddress, assets],
          chainId: FRONTEND_POLICY.requiredChainId,
        });
        setTxHash(approveHash);
        setStage("submitted");
        await waitMined(approveHash);
      }

      const hash = await vaultWrite.writeContractAsync({
        address: vault.vaultAddress,
        abi: nostosAsyncVaultAbi,
        functionName: "deposit",
        args: [assets, address],
        chainId: FRONTEND_POLICY.requiredChainId,
      });
      setTxHash(hash);
      setStage("submitted");
      await waitMined(hash);
      setAmount("");
    } catch (err) {
      setStage("failed");
      setError(errorMessage(err));
    }
  }

  async function handleRequest() {
    if (!address || !vault.vaultAddress) return;
    const shares = parseShares();
    if (shares === null) return;
    setError(null);
    setStage("review");
    try {
      const hash = await vaultWrite.writeContractAsync({
        address: vault.vaultAddress,
        abi: nostosAsyncVaultAbi,
        functionName: "requestRedeem",
        args: [shares, address, address],
        chainId: FRONTEND_POLICY.requiredChainId,
      });
      setTxHash(hash);
      setStage("submitted");
      await waitMined(hash);
      setAmount("");
    } catch (err) {
      setStage("failed");
      setError(errorMessage(err));
    }
  }

  async function handleClaim() {
    if (!address || !vault.vaultAddress || !vault.request) return;
    if (vault.request.status !== 2) return;
    setError(null);
    setStage("review");
    try {
      const hash = await vaultWrite.writeContractAsync({
        address: vault.vaultAddress,
        abi: nostosAsyncVaultAbi,
        functionName: "redeem",
        args: [vault.request.shares, address, address],
        chainId: FRONTEND_POLICY.requiredChainId,
      });
      setTxHash(hash);
      setStage("submitted");
      await waitMined(hash);
    } catch (err) {
      setStage("failed");
      setError(errorMessage(err));
    }
  }

  const claimable = vault.request?.status === 2;

  return (
    <div className="grid gap-6 xl:grid-cols-[1.1fr_.9fr]">
      <DataPanel title="Vault state" description="Live BOT Testnet contract reads.">
        {!vault.deployed ? (
          <StateNotice
            title="Vault not deployed"
            message="The Nostos Async Settlement Vault has not been deployed to BOT Testnet yet. No financial writes are available."
          />
        ) : (
          <DefinitionRows
            rows={[
              {
                label: "Vault address",
                value: <span className="break-all font-mono text-xs">{vault.vaultAddress}</span>,
              },
              {
                label: "Vault assets",
                value: vault.totalAssets !== undefined ? `${formatUnits(vault.totalAssets, decimals)} USDT` : "—",
              },
              {
                label: "Reserved (claimable)",
                value: vault.reserved !== undefined ? `${formatUnits(vault.reserved, decimals)} USDT` : "—",
              },
              {
                label: "Your shares",
                value: vault.shareBalance !== undefined ? `${formatUnits(vault.shareBalance, vault.shareDecimals ?? decimals)} shares` : "—",
              },
              {
                label: "Your USDT",
                value: vault.usdtBalance !== undefined ? `${formatUnits(vault.usdtBalance, decimals)} USDT` : "—",
              },
              {
                label: "Active request",
                value: vault.request
                  ? `#${vault.request.id.toString()} · ${["None", "PENDING", "CLAIMABLE", "CLAIMED"][vault.request.status] ?? "?"}`
                  : vault.activeRequestId !== undefined && vault.activeRequestId > BigInt(0)
                    ? "Loading…"
                    : "None",
              },
            ]}
          />
        )}
      </DataPanel>

      <DataPanel
        title="Demo actions"
        description="Synchronous deposit, asynchronous redemption demonstration."
      >
        <StateNotice
          title="DEMO / 0% YIELD / TESTNET SETTLEMENT INFRASTRUCTURE"
          message="Testnet infrastructure demonstration. This vault does not represent an RWA investment and does not earn yield."
          tone="warning"
        />
        {!isBotTestnet ? (
          <div className="mt-5">
            <StateNotice
              title="BOT TESTNET REQUIRED"
              message={`You are on chain ${chainId ?? "unknown"}. Connect on BOT Testnet (${FRONTEND_POLICY.requiredChainId}) to use the demo vault.`}
              tone="warning"
            />
          </div>
        ) : !vault.deployed ? (
          <p className="mt-5 text-sm text-muted-foreground">
            No actions until the vault is deployed.
          </p>
        ) : (
          <div className="mt-5 flex flex-col gap-6">
            <div>
              <Input
                id="demo-amount"
                name="amount"
                label="Amount"
                inputMode="decimal"
                autoComplete="off"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                placeholder="0.00"
                hint="1 USDT = 1 share at inception. Deposits hold settlement liquidity; the vault earns no yield."
              />
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <Button disabled={busy} onClick={handleDeposit}>
                  Deposit USDT
                </Button>
                <Button
                  disabled={busy || Boolean(vault.activeRequestId && vault.activeRequestId > BigInt(0))}
                  onClick={handleRequest}
                >
                  Request redemption
                </Button>
              </div>
              {claimable && (
                <Button
                  className="mt-3 w-full"
                  disabled={busy}
                  onClick={handleClaim}
                  data-testid="claim-button"
                >
                  Claim {formatUnits(vault.request?.assetsClaimable ?? BigInt(0), decimals)} USDT
                </Button>
              )}
              {vault.request?.status === 1 && (
                <p className="mt-3 text-xs leading-5 text-muted-foreground">
                  Request PENDING. A Nostos settler will make it CLAIMABLE only
                  when real settlement liquidity is available. This is never
                  driven by a timer.
                </p>
              )}
              <StageLine stage={stage} error={error} txHash={txHash} />
            </div>
          </div>
        )}
      </DataPanel>
    </div>
  );
}