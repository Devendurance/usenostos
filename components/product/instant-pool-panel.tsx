"use client";

import { useState } from "react";
import { createPublicClient, formatUnits, http } from "viem";
import { useAccount, useWriteContract } from "wagmi";
import { DataPanel, DefinitionRows, Metric, StateNotice } from "@/components/product/product-primitives";
import { Button } from "@/components/ui/button";
import { FRONTEND_POLICY } from "@/lib/chain/frontend-policy";
import { useBotNetwork } from "@/lib/chain/frontend-hooks";
import { botTestnet, BOT_TESTNET_RPC_URL } from "@/lib/chain/bot-testnet";
import { useInstantPool } from "@/lib/chain/instant-pool-hooks";
import { nostosRedemptionTicketAbi } from "@/lib/contracts/nostos-redemption-ticket-abi";
import { nostosInstantPoolAbi } from "@/lib/contracts/nostos-instant-pool-abi";

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
  review: "REVIEW - confirm the instant sale details.",
  sign: "SIGN - approve the transaction(s) in your wallet.",
  submitted: "SUBMITTED - transaction broadcast.",
  confirming: "CONFIRMING - waiting for confirmation on BOT Testnet.",
  confirmed: "CONFIRMED - transaction mined.",
  failed: "FAILED",
};

function errorMessage(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  if (/user rejected|user denied|action rejected/i.test(message)) {
    return "Transaction rejected in wallet. No transaction was sent.";
  }
  return message;
}

function StageLine({ stage, error, txHash }: { stage: Stage; error: string | null; txHash: string | null }) {
  return (
    <p className="mt-3 text-xs leading-5 text-muted-foreground" data-testid="p5-tx-stage" aria-live="polite">
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

export function InstantPoolPanel() {
  const { address } = useAccount();
  const { isBotTestnet, chainId } = useBotNetwork();
  const [soldTicketId, setSoldTicketId] = useState<bigint | undefined>();
  const [stage, setStage] = useState<Stage>("idle");
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [approveHash, setApproveHash] = useState<string | null>(null);

  const pool = useInstantPool(soldTicketId);
  const ticketWrite = useWriteContract();
  const poolWrite = useWriteContract();

  const publicClient = createPublicClient({ chain: botTestnet, transport: http(BOT_TESTNET_RPC_URL) });
  const decimals = 6;
  const busy = stage === "sign" || stage === "submitted" || stage === "confirming";
  const eligible = pool.eligibleTicket;

  function fmt(value: bigint | undefined): string {
    return value !== undefined ? formatUnits(value, decimals) : "-";
  }

  function bps(value: bigint | undefined): string {
    return value !== undefined ? `${Number(value) / 100}%` : "-";
  }

  async function waitMined(hash: `0x${string}`) {
    setStage("confirming");
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    if (receipt.status !== "success") throw new Error("Transaction reverted on BOT Testnet.");
    setTxHash(hash);
  }

  async function handleSale() {
    if (!address || !pool.poolAddress || !eligible || !eligible.quote) return;
    if (eligible.quote.amountOut <= BigInt(0)) {
      setError("Quote is zero; the pool cannot buy this ticket.");
      return;
    }
    setError(null);

    if (stage !== "review") {
      setStage("review");
      return;
    }

    setStage("sign");
    try {
      // Approve the ticket to the pool if not already approved.
      const approved = (await publicClient.readContract({
        address: pool.ticketAddress!,
        abi: nostosRedemptionTicketAbi,
        functionName: "getApproved",
        args: [eligible.ticketId],
      })) as string;
      const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
      if (approved.toLowerCase() === ZERO_ADDRESS) {
        setApproveHash(null);
        const approveHash = await ticketWrite.writeContractAsync({
          address: pool.ticketAddress!,
          abi: nostosRedemptionTicketAbi,
          functionName: "approve",
          args: [pool.poolAddress, eligible.ticketId],
          chainId: FRONTEND_POLICY.requiredChainId,
        });
        setApproveHash(approveHash);
        setStage("submitted");
        await waitMined(approveHash);
        setStage("sign");
      }

      const saleHash = await poolWrite.writeContractAsync({
        address: pool.poolAddress,
        abi: nostosInstantPoolAbi,
        functionName: "sellTicket",
        args: [eligible.ticketId, eligible.quote.amountOut],
        chainId: FRONTEND_POLICY.requiredChainId,
      });
      setTxHash(saleHash);
      setStage("submitted");
      await waitMined(saleHash);
      setSoldTicketId(eligible.ticketId);
      setStage("confirmed");
      pool.refetchAll();
    } catch (err) {
      setStage("failed");
      setError(errorMessage(err));
    }
  }

  if (!pool.deployed) {
    return (
      <DataPanel title="Nostos InstantPool" description="Live BOT Testnet pool reads.">
        <StateNotice
          title="Instant pool not deployed"
          message="The Nostos InstantPool has not been deployed to BOT Testnet. No instant liquidity is available."
        />
      </DataPanel>
    );
  }

  const statusLabel = ["None", "PENDING", "CLAIMABLE", "CLAIMED"][pool.selectedTicketStatus ?? 0] ?? "UNKNOWN";
  const isClaimable = pool.selectedTicketStatus === 2;

  return (
    <div className="grid gap-6 xl:grid-cols-[1.1fr_.9fr]">
      <DataPanel title="Instant pool state" description="Live BOT Testnet pool contract reads.">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <Metric label="Available liquidity" value={`${fmt(pool.liquidAssets)} USDT`} />
          <Metric label="Outstanding claim face value" value={`${fmt(pool.outstandingFaceValue)} USDT`} />
          <Metric label="Outstanding cost basis" value={`${fmt(pool.outstandingCostBasis)} USDT`} />
          <Metric label="Utilization" value={bps(pool.utilizationBps)} />
          <Metric label="Realized spread" value={`${fmt(pool.realizedSpread)} USDT`} />
        </div>
        {!isBotTestnet ? (
          <div className="mt-6">
            <StateNotice
              title="BOT TESTNET REQUIRED"
              message={`You are on chain ${chainId ?? "unknown"}. Connect on BOT Testnet (${FRONTEND_POLICY.requiredChainId}) to use instant liquidity.`}
              tone="warning"
            />
          </div>
        ) : (
          <DefinitionRows
            rows={[
              {
                label: "Pool address",
                value: <span className="break-all font-mono text-xs">{pool.poolAddress}</span>,
              },
            ]}
          />
        )}
      </DataPanel>

      <DataPanel
        title="Instant liquidity"
        description="Sell an eligible PENDING redemption ticket to the pool at a disclosed discount."
      >
        <StateNotice
          title="INSTANT LIQUIDITY"
          message="Only PENDING redemption tickets are eligible. A CLAIMABLE ticket should be redeemed normally for full value."
          tone="warning"
        />
        {!isBotTestnet ? (
          <StateNotice title="No quote" message="Connect on BOT Testnet to see your eligible pending tickets and instant quote." />
        ) : eligible && eligible.quote ? (
          <>
            <DefinitionRows
              rows={[
                { label: "Ticket", value: `#${eligible.ticketId.toString()}` },
                { label: "Face value", value: `${fmt(eligible.faceValue)} USDT` },
                { label: "Status", value: statusLabel },
              ]}
            />
            <p className="eyebrow mt-6 text-muted-foreground">INSTANT QUOTE</p>
            <DefinitionRows
              rows={[
                { label: "You receive now", value: `${fmt(eligible.quote.amountOut)} USDT` },
                { label: "Discount", value: bps(eligible.quote.discountBps) },
                { label: "Pool utilization", value: bps(eligible.quote.utilizationBps) },
                { label: "Trade-size impact", value: bps(eligible.quote.sizeRatioBps) },
              ]}
            />
            {isClaimable ? (
              <StateNotice
                title="CLAIMABLE - redeem normally"
                message="This ticket's underlying request is CLAIMABLE. Claim it through the vault for full value instead of taking an instant discount."
              />
            ) : (
              <>
                <Button onClick={handleSale} disabled={busy} className="mt-6">
                  {stage === "review" ? "Confirm sale" : "Get instant liquidity"}
                </Button>
                {approveHash && (
                  <p className="mt-2 text-xs text-muted-foreground">Ticket approved for the pool.</p>
                )}
              </>
            )}
            {error && <p className="mt-3 text-sm text-[var(--ink)]" role="alert">{error}</p>}
            <StageLine stage={stage} error={error} txHash={txHash} />
          </>
        ) : (
          <StateNotice
            title="No eligible pending ticket"
            message="No PENDING redemption ticket owned by this wallet was found. Request a redemption on the vault to make a claim available for instant sale."
          />
        )}
      </DataPanel>

      {soldTicketId !== undefined && (
        <DataPanel title="Sale result" description="Live on-chain truth after the sale." className="xl:col-span-2">
          <DefinitionRows
            rows={[
              {
                label: "Ticket owner",
                value: (
                  <span className="break-all font-mono text-xs">
                    {pool.soldTicketOwner ?? "reading…"}
                  </span>
                ),
              },
              {
                label: "Owner is InstantPool",
                value: pool.soldTicketOwner?.toLowerCase() === pool.poolAddress?.toLowerCase() ? "YES" : "NO",
              },
            ]}
          />
          <p className="mt-3 text-sm text-muted-foreground">
            {pool.soldTicketOwner?.toLowerCase() === pool.poolAddress?.toLowerCase()
              ? "The pool now owns this claim. The seller received USDT immediately; the pool harvests the full settlement when the request becomes CLAIMABLE."
              : "Waiting for confirmation of pool ownership."}
          </p>
        </DataPanel>
      )}
    </div>
  );
}
