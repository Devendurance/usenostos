"use client";

import { useState } from "react";
import { createPublicClient, erc20Abi, formatUnits, http, isAddress } from "viem";
import { useAccount, useWriteContract } from "wagmi";
import { DataPanel, DefinitionRows, StateNotice } from "@/components/product/product-primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BOT_TESTNET_SETTLEMENT_TOKEN } from "@/lib/chain/settlement-token";
import { FRONTEND_POLICY } from "@/lib/chain/frontend-policy";
import { useBotNetwork } from "@/lib/chain/frontend-hooks";
import { botTestnet, BOT_TESTNET_RPC_URL } from "@/lib/chain/bot-testnet";
import { useTicketedVault } from "@/lib/chain/ticketed-vault-hooks";
import { nostosAsyncVaultP4Abi } from "@/lib/contracts/nostos-async-vault-p4-abi";
import { nostosRedemptionTicketAbi } from "@/lib/contracts/nostos-redemption-ticket-abi";

type Stage =
  | "idle"
  | "review"
  | "sign"
  | "submitted"
  | "confirming"
  | "confirmed"
  | "failed";
type ReviewAction = "transfer" | "claim" | null;
type ReviewSnapshot = {
  action: Exclude<ReviewAction, null>;
  ticketId: bigint;
  owner: `0x${string}`;
  recipient?: `0x${string}`;
  account: `0x${string}`;
};

const STAGE_TEXT: Record<Stage, string> = {
  idle: "",
  review: "REVIEW - confirm the transaction details.",
  sign: "SIGN - approve the transaction in your wallet.",
  submitted: "SUBMITTED - transaction broadcast.",
  confirming: "CONFIRMING - waiting for confirmation on BOT Testnet.",
  confirmed: "CONFIRMED - transaction mined.",
  failed: "FAILED",
};
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

function errorMessage(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  if (/user rejected|user denied|action rejected/i.test(message)) {
    return "Transaction rejected in wallet. No transaction was sent.";
  }
  return message;
}

function statusLabel(status: number | undefined): string {
  return ["None", "PENDING", "CLAIMABLE", "CLAIMED"][status ?? 0] ?? "UNKNOWN";
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
    <p className="mt-3 text-xs leading-5 text-muted-foreground" data-testid="p4-tx-stage" aria-live="polite">
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
      {stage === "failed" && error && <span className="block text-[var(--ink)]">{error}</span>}
    </p>
  );
}

export function TicketedDemoVaultPanel() {
  const { address } = useAccount();
  const { isBotTestnet, chainId } = useBotNetwork();
  const [selectedTicketId, setSelectedTicketId] = useState<bigint | undefined>();
  const [ticketInput, setTicketInput] = useState("");
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [stage, setStage] = useState<Stage>("idle");
  const [reviewAction, setReviewAction] = useState<ReviewAction>(null);
  const [reviewSnapshot, setReviewSnapshot] = useState<ReviewSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ticketLookupError, setTicketLookupError] = useState<string | undefined>();
  const [recipientError, setRecipientError] = useState<string | undefined>();
  const [txHash, setTxHash] = useState<string | null>(null);
  const vault = useTicketedVault(selectedTicketId);
  const usdtWrite = useWriteContract();
  const vaultWrite = useWriteContract();
  const ticketWrite = useWriteContract();

  const publicClient = createPublicClient({
    chain: botTestnet,
    transport: http(BOT_TESTNET_RPC_URL),
  });
  const decimals = vault.usdtDecimals;
  const effectiveTicketId = selectedTicketId ?? vault.selectedRequest?.id;
  const busy = stage === "sign" || stage === "submitted" || stage === "confirming";
  const selectedStatus = vault.selectedRequest?.status ?? vault.activeRequest?.status;
  const canTransfer = Boolean(
    vault.selectedRequest &&
      (selectedStatus === 1 || selectedStatus === 2) &&
      vault.canClaim,
  );
  const canClaim = vault.canClaim && selectedStatus === 2;

  function parseAmount(): bigint | null {
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) return null;
    return BigInt(Math.round(value * 10 ** decimals));
  }

  function parseTicketId(): bigint | null {
    if (!/^\d+$/.test(ticketInput)) return null;
    const value = BigInt(ticketInput);
    return value > BigInt(0) ? value : null;
  }

  async function waitMined(hash: `0x${string}`) {
    setStage("confirming");
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    if (receipt.status !== "success") throw new Error("Transaction reverted on BOT Testnet.");
    setTxHash(hash);
    setStage("confirmed");
    vault.refetchAll();
  }

  async function handleDeposit() {
    if (!address || !vault.vaultAddress || !BOT_TESTNET_SETTLEMENT_TOKEN.address) return;
    const assets = parseAmount();
    if (assets === null) {
      setError("Enter a positive USDT amount.");
      return;
    }
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
        abi: nostosAsyncVaultP4Abi,
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
    const assets = parseAmount();
    if (assets === null) {
      setError("Enter the positive share amount to redeem.");
      return;
    }
    setError(null);
    setStage("review");
    try {
      const hash = await vaultWrite.writeContractAsync({
        address: vault.vaultAddress,
        abi: nostosAsyncVaultP4Abi,
        functionName: "requestRedeem",
        args: [assets, address, address],
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

  function selectTicket(id: bigint) {
    setSelectedTicketId(id);
    setTicketInput(id.toString());
    setTicketLookupError(undefined);
    setRecipientError(undefined);
    setError(null);
    setReviewAction(null);
    setReviewSnapshot(null);
    setStage("idle");
  }

  function handleTicketLookup() {
    const id = parseTicketId();
    if (id === null) {
      setTicketLookupError("Enter a positive ticket number.");
      return;
    }
    setTicketLookupError(undefined);
    setSelectedTicketId(id);
    setReviewAction(null);
    setReviewSnapshot(null);
    setStage("idle");
  }

  async function handleTransfer() {
    if (!vault.ticketAddress || effectiveTicketId === undefined || !vault.selectedTicketOwner) return;
    if (!isAddress(recipient) || recipient === ZERO_ADDRESS) {
      setRecipientError("Enter a valid nonzero recipient address.");
      return;
    }
    if (!canTransfer) {
      setRecipientError("The connected wallet is not authorized to transfer this ticket.");
      return;
    }
    setRecipientError(undefined);
    setError(null);
    if (reviewAction !== "transfer") {
      setReviewAction("transfer");
      setReviewSnapshot({
        action: "transfer",
        ticketId: effectiveTicketId,
        owner: vault.selectedTicketOwner,
        recipient: recipient as `0x${string}`,
        account: address as `0x${string}`,
      });
      setStage("review");
      return;
    }
    if (
      reviewSnapshot?.action !== "transfer" ||
      reviewSnapshot.ticketId !== effectiveTicketId ||
      reviewSnapshot.owner.toLowerCase() !== vault.selectedTicketOwner.toLowerCase() ||
      reviewSnapshot.recipient?.toLowerCase() !== recipient.toLowerCase() ||
      reviewSnapshot.account.toLowerCase() !== address?.toLowerCase()
    ) {
      setReviewAction(null);
      setReviewSnapshot(null);
      setStage("idle");
      setError("Transfer details changed. Review the transaction again.");
      return;
    }
    setReviewAction(null);
    setReviewSnapshot(null);
    try {
      setStage("sign");
      const hash = await ticketWrite.writeContractAsync({
        address: vault.ticketAddress,
        abi: nostosRedemptionTicketAbi,
        functionName: "safeTransferFrom",
        args: [vault.selectedTicketOwner, recipient as `0x${string}`, effectiveTicketId],
        chainId: FRONTEND_POLICY.requiredChainId,
      });
      setTxHash(hash);
      setStage("submitted");
      await waitMined(hash);
      setRecipient("");
      setRecipientError(undefined);
    } catch (err) {
      setReviewAction(null);
      setReviewSnapshot(null);
      setStage("failed");
      setError(errorMessage(err));
    }
  }

  async function handleClaim() {
    if (!vault.vaultAddress || effectiveTicketId === undefined || !address || !canClaim) return;
    setError(null);
    if (reviewAction !== "claim") {
      setReviewAction("claim");
      setReviewSnapshot({
        action: "claim",
        ticketId: effectiveTicketId,
        owner: vault.selectedTicketOwner as `0x${string}`,
        account: address,
      });
      setStage("review");
      return;
    }
    if (
      reviewSnapshot?.action !== "claim" ||
      reviewSnapshot.ticketId !== effectiveTicketId ||
      reviewSnapshot.owner.toLowerCase() !== vault.selectedTicketOwner?.toLowerCase() ||
      reviewSnapshot.account.toLowerCase() !== address.toLowerCase()
    ) {
      setReviewAction(null);
      setReviewSnapshot(null);
      setStage("idle");
      setError("Claim details changed. Review the transaction again.");
      return;
    }
    setReviewAction(null);
    setReviewSnapshot(null);
    try {
      setStage("sign");
      const hash = await vaultWrite.writeContractAsync({
        address: vault.vaultAddress,
        abi: nostosAsyncVaultP4Abi,
        functionName: "claimRedeem",
        args: [effectiveTicketId, address],
        chainId: FRONTEND_POLICY.requiredChainId,
      });
      setTxHash(hash);
      setStage("submitted");
      await waitMined(hash);
    } catch (err) {
      setReviewAction(null);
      setReviewSnapshot(null);
      setStage("failed");
      setError(errorMessage(err));
    }
  }

  if (!vault.deployed) {
    return (
      <DataPanel title="P4 ticketed vault" description="Live BOT Testnet ticket reads.">
        <StateNotice
          title="P4 ticketed deployment not available"
          message="The transferable redemption ticket vault has not been deployed to BOT Testnet. The existing P3 vault remains separate and unchanged."
        />
      </DataPanel>
    );
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1.1fr_.9fr]">
      <DataPanel title="Vault state" description="Live BOT Testnet P4 contract reads.">
        <DefinitionRows
          rows={[
            { label: "P4 vault address", value: <span className="break-all font-mono text-xs">{vault.vaultAddress}</span> },
            { label: "Ticket contract", value: <span className="break-all font-mono text-xs">{vault.ticketAddress}</span> },
            { label: "Vault assets", value: vault.totalAssets !== undefined ? `${formatUnits(vault.totalAssets, decimals)} USDT` : "-" },
            { label: "Reserved (claimable)", value: vault.reserved !== undefined ? `${formatUnits(vault.reserved, decimals)} USDT` : "-" },
            { label: "Your shares", value: vault.shareBalance !== undefined ? `${formatUnits(vault.shareBalance, vault.shareDecimals ?? decimals)} shares` : "-" },
            { label: "Your USDT", value: vault.usdtBalance !== undefined ? `${formatUnits(vault.usdtBalance, decimals)} USDT` : "-" },
          ]}
        />
        {!isBotTestnet ? (
          <StateNotice
            title="BOT TESTNET REQUIRED"
            message={`You are on chain ${chainId ?? "unknown"}. Connect on BOT Testnet (${FRONTEND_POLICY.requiredChainId}) to use ticketed redemption.`}
            tone="warning"
          />
        ) : (
          <>
            <div className="mt-6">
              <p className="eyebrow text-muted-foreground">Your redemption tickets</p>
              {vault.ownedTickets.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-2" aria-label="Owned redemption tickets">
                  {vault.ownedTickets.map((ticket) => (
                    <Button
                      key={ticket.id.toString()}
                      size="sm"
                      variant={ticket.id === selectedTicketId ? "default" : "outline"}
                      onClick={() => selectTicket(ticket.id)}
                      aria-pressed={ticket.id === selectedTicketId}
                    >
                      Ticket #{ticket.id.toString()}
                    </Button>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">No owned unclaimed tickets were found.</p>
              )}
            </div>
          </>
        )}
      </DataPanel>

      <DataPanel title="Redemption claim" description="Ticket ownership controls the economic right to settlement proceeds.">
        <StateNotice
          title="TRANSFERABLE REDEMPTION CLAIM"
          message="The redemption ticket represents the right to receive this request's settlement proceeds. Transferring it transfers that right. Pending and Claimable tickets can transfer; a claimed ticket is burned."
          tone="warning"
        />
        {!isBotTestnet ? null : (
          <div className="mt-5 flex flex-col gap-5">
            <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
              <Input
                id="p4-ticket-id"
                name="p4-ticket-id"
                label="Ticket number"
                inputMode="numeric"
                value={ticketInput || vault.selectedRequest?.id.toString() || ""}
                onChange={(event) => setTicketInput(event.target.value)}
                hint="Enter a ticket number to read its current on-chain owner."
                error={ticketLookupError}
              />
              <Button variant="outline" onClick={handleTicketLookup} disabled={busy}>
                Find ticket
              </Button>
            </div>
            {vault.selectedRequest && vault.selectedTicketOwner ? (
              <DefinitionRows
                rows={[
                  { label: "Ticket", value: `#${vault.selectedRequest.id.toString()}` },
                  { label: "Request", value: `#${vault.selectedRequest.id.toString()}` },
                  { label: "Status", value: statusLabel(vault.selectedRequest.status) },
                  { label: "Current owner", value: <span className="break-all font-mono text-xs">{vault.selectedTicketOwner}</span> },
                  { label: "Claimable", value: `${formatUnits(vault.selectedRequest.assetsClaimable, decimals)} USDT` },
                ]}
              />
            ) : (
              <StateNotice title="Select a ticket" message="Connect on BOT Testnet or enter a ticket number to inspect a live redemption claim." />
            )}
            {vault.selectedRequest && (vault.selectedRequest.status === 1 || vault.selectedRequest.status === 2) && (
              <>
                <Input
                  id="p4-recipient"
                  name="p4-recipient"
                  label="Transfer claim to"
                  value={recipient}
                  onChange={(event) => {
                    setRecipient(event.target.value);
                    setRecipientError(undefined);
                    if (reviewAction === "transfer") {
                      setReviewAction(null);
                      setReviewSnapshot(null);
                      setStage("idle");
                    }
                  }}
                  hint="The recipient becomes the current economic owner of this redemption claim."
                  error={recipientError}
                />
                <div className="grid gap-3 sm:grid-cols-2">
                  <Button onClick={handleTransfer} disabled={busy || !canTransfer}>
                    {reviewAction === "transfer" ? "Confirm transfer" : "Transfer claim"}
                  </Button>
                  <Button onClick={handleClaim} disabled={busy || !canClaim}>
                    {reviewAction === "claim" ? "Confirm claim" : "Claim settlement"}
                  </Button>
                </div>
              </>
            )}
            {vault.selectedRequest?.status === 1 && (
              <p className="text-xs leading-5 text-muted-foreground">
                Request PENDING. A Nostos settler will make it CLAIMABLE only when real settlement liquidity is available. This is never driven by a timer.
              </p>
            )}
            {error && <p className="text-sm text-[var(--ink)]" role="alert">{error}</p>}
            <StageLine stage={stage} error={error} txHash={txHash} />
          </div>
        )}
      </DataPanel>

      <DataPanel title="P4 actions" description="Synchronous deposit and asynchronous ticketed redemption." className="xl:col-span-2">
        <div className="grid gap-5 md:grid-cols-[1fr_auto_auto] md:items-end">
          <Input
            id="p4-amount"
            name="p4-amount"
            label="Amount"
            inputMode="decimal"
            autoComplete="off"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            placeholder="0.00"
            hint="1 USDT = 1 share at inception. This demo earns no yield."
          />
          <Button onClick={handleDeposit} disabled={busy || !isBotTestnet}>
            Deposit USDT
          </Button>
          <Button onClick={handleRequest} disabled={busy || !isBotTestnet || Boolean(vault.activeRequestId && vault.activeRequestId > BigInt(0))}>
            Request redemption
          </Button>
        </div>
      </DataPanel>
    </div>
  );
}
