"use client";

import { useMemo, useState } from "react";
import { createPublicClient, erc20Abi, formatUnits, http, parseUnits } from "viem";
import { useAccount, useWriteContract } from "wagmi";
import { DataPanel, DefinitionRows, Metric, StateNotice } from "@/components/product/product-primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BOT_TESTNET_SETTLEMENT_TOKEN } from "@/lib/chain/settlement-token";
import { FRONTEND_POLICY } from "@/lib/chain/frontend-policy";
import { useBotNetwork } from "@/lib/chain/frontend-hooks";
import { botTestnet, BOT_TESTNET_RPC_URL } from "@/lib/chain/bot-testnet";
import {
  formatWithdrawalUnlockAt,
  resolveLpRedeemAvailability,
  useInstantPoolP6,
  usePreviewDeposit,
  usePreviewRedeemInput,
} from "@/lib/chain/instant-pool-p6-hooks";
import { nostosRedemptionTicketAbi } from "@/lib/contracts/nostos-redemption-ticket-abi";
import { nostosInstantPoolP6Abi } from "@/lib/contracts/nostos-instant-pool-p6-abi";

type Stage =
  | "idle"
  | "review"
  | "approve"
  | "deposit"
  | "redeem"
  | "sign"
  | "submitted"
  | "confirming"
  | "confirmed"
  | "failed";

const DEPOSIT_STAGE_TEXT: Record<Stage, string> = {
  idle: "",
  review: "REVIEW - confirm the deposit details.",
  approve: "APPROVE USDT - approve Testnet USDT for the pool.",
  deposit: "DEPOSIT - submit deposit to the pool.",
  redeem: "",
  sign: "APPROVE USDT - approve Testnet USDT for the pool.",
  submitted: "DEPOSIT - transaction broadcast.",
  confirming: "CONFIRMING - waiting for confirmation on BOT Testnet.",
  confirmed: "CONFIRMED - transaction mined.",
  failed: "FAILED",
};

const REDEEM_STAGE_TEXT: Record<Stage, string> = {
  idle: "",
  review: "REVIEW - confirm the redeem details.",
  approve: "",
  deposit: "",
  redeem: "REDEEM - submit redemption to the pool.",
  sign: "REDEEM - approve the transaction in your wallet.",
  submitted: "REDEEM - transaction broadcast.",
  confirming: "CONFIRMING - waiting for confirmation on BOT Testnet.",
  confirmed: "CONFIRMED - transaction mined.",
  failed: "FAILED",
};

const SALE_STAGE_TEXT: Record<Stage, string> = {
  idle: "",
  review: "REVIEW - confirm the instant sale details.",
  approve: "SIGN - approve the transaction(s) in your wallet.",
  deposit: "",
  redeem: "",
  sign: "SIGN - approve the transaction(s) in your wallet.",
  submitted: "SUBMITTED - transaction broadcast.",
  confirming: "CONFIRMING - waiting for confirmation on BOT Testnet.",
  confirmed: "CONFIRMED - transaction mined.",
  failed: "FAILED",
};

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const ASSET_DECIMALS = BOT_TESTNET_SETTLEMENT_TOKEN.decimals ?? 6;

function errorMessage(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  if (/user rejected|user denied|action rejected/i.test(message)) {
    return "Transaction rejected in wallet. No transaction was sent.";
  }
  return message;
}

function parsePositiveAmount(value: string, decimals: number): bigint | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    const parsed = parseUnits(trimmed, decimals);
    return parsed > BigInt(0) ? parsed : null;
  } catch {
    return null;
  }
}

function fmt(value: bigint | undefined, decimals: number): string {
  return value !== undefined ? formatUnits(value, decimals) : "-";
}

function bps(value: bigint | undefined): string {
  return value !== undefined ? `${Number(value) / 100}%` : "-";
}

function StageLine({
  testId,
  stage,
  labels,
  error,
  txHash,
}: {
  testId: string;
  stage: Stage;
  labels: Record<Stage, string>;
  error: string | null;
  txHash: string | null;
}) {
  return (
    <p className="mt-3 text-xs leading-5 text-muted-foreground" data-testid={testId} aria-live="polite">
      {stage !== "idle" && labels[stage]}
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

export function InstantPoolP6Panel() {
  const { address } = useAccount();
  const { isBotTestnet, chainId } = useBotNetwork();
  const [soldTicketId, setSoldTicketId] = useState<bigint | undefined>();
  const [depositAmount, setDepositAmount] = useState("");
  const [redeemShares, setRedeemShares] = useState("");
  const [depositStage, setDepositStage] = useState<Stage>("idle");
  const [redeemStage, setRedeemStage] = useState<Stage>("idle");
  const [saleStage, setSaleStage] = useState<Stage>("idle");
  const [depositHash, setDepositHash] = useState<string | null>(null);
  const [redeemHash, setRedeemHash] = useState<string | null>(null);
  const [saleHash, setSaleHash] = useState<string | null>(null);
  const [depositError, setDepositError] = useState<string | null>(null);
  const [redeemError, setRedeemError] = useState<string | null>(null);
  const [saleError, setSaleError] = useState<string | null>(null);
  const [usdtApproveHash, setUsdtApproveHash] = useState<string | null>(null);
  const [ticketApproveHash, setTicketApproveHash] = useState<string | null>(null);

  const pool = useInstantPoolP6(soldTicketId);
  const usdtWrite = useWriteContract();
  const poolWrite = useWriteContract();
  const ticketWrite = useWriteContract();

  const publicClient = createPublicClient({ chain: botTestnet, transport: http(BOT_TESTNET_RPC_URL) });
  const shareDecimals = pool.shareDecimals ?? 18;
  const assetDecimals = ASSET_DECIMALS;
  const settlementAsset = pool.assetAddress ?? BOT_TESTNET_SETTLEMENT_TOKEN.address ?? undefined;
  const depositAssets = useMemo(() => parsePositiveAmount(depositAmount, assetDecimals), [depositAmount, assetDecimals]);
  const redeemShareAmount = useMemo(
    () => parsePositiveAmount(redeemShares, shareDecimals),
    [redeemShares, shareDecimals],
  );
  const previewDeposit = usePreviewDeposit(depositAssets ?? undefined);
  const previewRedeemInput = usePreviewRedeemInput(redeemShareAmount ?? undefined);

  const unlockIso = formatWithdrawalUnlockAt(pool.withdrawalUnlockAt);
  const redeemGate = resolveLpRedeemAvailability({
    unlockAt: pool.withdrawalUnlockAt,
    maxRedeem: pool.maxRedeem,
    previewAssets: previewRedeemInput.data as bigint | undefined,
    availableLiquidity: pool.availableLiquidity,
    shares: pool.lpShares,
  });

  const depositBusy =
    depositStage === "approve" ||
    depositStage === "deposit" ||
    depositStage === "sign" ||
    depositStage === "submitted" ||
    depositStage === "confirming";
  const redeemBusy =
    redeemStage === "redeem" ||
    redeemStage === "sign" ||
    redeemStage === "submitted" ||
    redeemStage === "confirming";
  const saleBusy = saleStage === "sign" || saleStage === "submitted" || saleStage === "confirming";
  const eligible = pool.eligibleTicket;

  async function waitMined(hash: `0x${string}`, setStage: (stage: Stage) => void, setHash: (hash: string) => void) {
    setStage("confirming");
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    if (receipt.status !== "success") throw new Error("Transaction reverted on BOT Testnet.");
    setHash(hash);
  }

  async function handleDeposit() {
    if (!address || !pool.poolAddress || !settlementAsset) return;
    if (depositAssets === null) {
      setDepositError("Enter a positive USDT amount.");
      return;
    }
    const minSharesOut = previewDeposit.data as bigint | undefined;
    if (minSharesOut === undefined) {
      setDepositError("Deposit preview is unavailable.");
      return;
    }
    setDepositError(null);
    if (depositStage !== "review") {
      setDepositStage("review");
      return;
    }

    try {
      const allowance = (await publicClient.readContract({
        address: settlementAsset,
        abi: erc20Abi,
        functionName: "allowance",
        args: [address, pool.poolAddress],
      })) as bigint;
      if (allowance < depositAssets) {
        setDepositStage("approve");
        const nextApproveHash = await usdtWrite.writeContractAsync({
          address: settlementAsset,
          abi: erc20Abi,
          functionName: "approve",
          args: [pool.poolAddress, depositAssets],
          chainId: FRONTEND_POLICY.requiredChainId,
        });
        setUsdtApproveHash(nextApproveHash);
        setDepositHash(nextApproveHash);
        setDepositStage("submitted");
        await waitMined(nextApproveHash, setDepositStage, setDepositHash);
      }

      setDepositStage("deposit");
      const hash = await poolWrite.writeContractAsync({
        address: pool.poolAddress,
        abi: nostosInstantPoolP6Abi,
        functionName: "deposit",
        args: [depositAssets, minSharesOut],
        chainId: FRONTEND_POLICY.requiredChainId,
      });
      setDepositHash(hash);
      setDepositStage("submitted");
      await waitMined(hash, setDepositStage, setDepositHash);
      setDepositStage("confirmed");
      setDepositAmount("");
      pool.refetchAll();
    } catch (err) {
      setDepositStage("failed");
      setDepositError(errorMessage(err));
    }
  }

  async function handleRedeem() {
    if (!address || !pool.poolAddress) return;
    if (redeemShareAmount === null) {
      setRedeemError("Enter a positive share amount.");
      return;
    }
    if (!redeemGate.available) {
      setRedeemError(
        redeemGate.reason === "cooldown"
          ? `Withdrawal cooldown is active until ${unlockIso ?? "the on-chain unlock time"}.`
          : redeemGate.reason === "no-liquidity"
            ? "Withdrawal is not available. Cash is deployed or max redeemable shares are 0."
            : "Withdrawal is not available.",
      );
      return;
    }
    const minAssetsOut = previewRedeemInput.data as bigint | undefined;
    if (minAssetsOut === undefined) {
      setRedeemError("Redeem preview is unavailable.");
      return;
    }
    if (pool.maxRedeem !== undefined && redeemShareAmount > pool.maxRedeem) {
      setRedeemError("Requested shares exceed max redeemable now.");
      return;
    }
    setRedeemError(null);
    if (redeemStage !== "review") {
      setRedeemStage("review");
      return;
    }

    try {
      setRedeemStage("redeem");
      const hash = await poolWrite.writeContractAsync({
        address: pool.poolAddress,
        abi: nostosInstantPoolP6Abi,
        functionName: "redeem",
        args: [redeemShareAmount, minAssetsOut],
        chainId: FRONTEND_POLICY.requiredChainId,
      });
      setRedeemHash(hash);
      setRedeemStage("submitted");
      await waitMined(hash, setRedeemStage, setRedeemHash);
      setRedeemStage("confirmed");
      setRedeemShares("");
      pool.refetchAll();
    } catch (err) {
      setRedeemStage("failed");
      setRedeemError(errorMessage(err));
    }
  }

  async function handleSale() {
    if (!address || !pool.poolAddress || !eligible || !eligible.quote) return;
    if (eligible.quote.amountOut <= BigInt(0)) {
      setSaleError("Quote is zero; the pool cannot buy this ticket.");
      return;
    }
    setSaleError(null);

    if (saleStage !== "review") {
      setSaleStage("review");
      return;
    }

    setSaleStage("sign");
    try {
      const approved = (await publicClient.readContract({
        address: pool.ticketAddress!,
        abi: nostosRedemptionTicketAbi,
        functionName: "getApproved",
        args: [eligible.ticketId],
      })) as string;
      if (approved.toLowerCase() === ZERO_ADDRESS) {
        setTicketApproveHash(null);
        const nextApproveHash = await ticketWrite.writeContractAsync({
          address: pool.ticketAddress!,
          abi: nostosRedemptionTicketAbi,
          functionName: "approve",
          args: [pool.poolAddress, eligible.ticketId],
          chainId: FRONTEND_POLICY.requiredChainId,
        });
        setTicketApproveHash(nextApproveHash);
        setSaleStage("submitted");
        await waitMined(nextApproveHash, setSaleStage, setSaleHash);
        setSaleStage("sign");
      }

      const nextSaleHash = await poolWrite.writeContractAsync({
        address: pool.poolAddress,
        abi: nostosInstantPoolP6Abi,
        functionName: "sellTicket",
        args: [eligible.ticketId, eligible.quote.amountOut],
        chainId: FRONTEND_POLICY.requiredChainId,
      });
      setSaleHash(nextSaleHash);
      setSaleStage("submitted");
      await waitMined(nextSaleHash, setSaleStage, setSaleHash);
      setSoldTicketId(eligible.ticketId);
      setSaleStage("confirmed");
      pool.refetchAll();
    } catch (err) {
      setSaleStage("failed");
      setSaleError(errorMessage(err));
    }
  }

  const statusLabel = ["None", "PENDING", "CLAIMABLE", "CLAIMED"][pool.selectedTicketStatus ?? 0] ?? "UNKNOWN";
  const isClaimable = pool.selectedTicketStatus === 2;
  const cooldownActive =
    pool.withdrawalUnlockAt !== undefined &&
    pool.withdrawalUnlockAt > BigInt(0) &&
    redeemGate.reason === "cooldown";
  const redeemDisabled = !isBotTestnet || redeemBusy || !redeemGate.available || cooldownActive;

  return (
    <div className="grid gap-6 xl:grid-cols-[1.1fr_.9fr]">
      <DataPanel
        title="Public LP pool"
        description="Permissionless LP capital. Metrics are live contract reads, not protocol-owned inventory."
        className="xl:col-span-2"
      >
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <Metric label="LP NAV" value={`${fmt(pool.lpNav, assetDecimals)} USDT`} />
          <Metric label="Available liquidity" value={`${fmt(pool.availableLiquidity, assetDecimals)} USDT`} />
          <Metric label="Total LP shares" value={fmt(pool.totalSupply, shareDecimals)} />
          <Metric label="Share price" value={`${fmt(pool.sharePrice, assetDecimals)} USDT`} />
          <Metric label="Outstanding face value" value={`${fmt(pool.outstandingFaceValue, assetDecimals)} USDT`} />
          <Metric label="Outstanding cost basis" value={`${fmt(pool.outstandingCostBasis, assetDecimals)} USDT`} />
          <Metric label="Utilization" value={bps(pool.utilizationBps)} />
          <Metric label="Gross realized spread" value={`${fmt(pool.cumulativeGrossSpread, assetDecimals)} USDT`} />
          <Metric label="Protocol fees accrued" value={`${fmt(pool.accruedProtocolFees, assetDecimals)} USDT`} />
          <Metric label="LP realized profit" value={`${fmt(pool.lpRealizedProfit, assetDecimals)} USDT`} />
        </div>
        {!isBotTestnet ? (
          <div className="mt-6">
            <StateNotice
              title="BOT TESTNET REQUIRED"
              message={`You are on chain ${chainId ?? "unknown"}. Connect on BOT Testnet (${FRONTEND_POLICY.requiredChainId}) to use public LP capital or instant liquidity.`}
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
              {
                label: "Your LP shares",
                value: fmt(pool.lpShares, shareDecimals),
              },
              {
                label: "Your NAV value",
                value: `${fmt(pool.previewRedeemUser, assetDecimals)} USDT`,
              },
              {
                label: "Max withdrawable now",
                value: fmt(pool.maxRedeem, shareDecimals),
              },
              {
                label: "Cooldown / unlock time",
                value: cooldownActive ? (unlockIso ?? "-") : pool.withdrawalUnlockAt === undefined ? "-" : "Unlocked",
              },
            ]}
          />
        )}
      </DataPanel>

      <DataPanel
        title="Provide LP capital"
        description="Deposit Testnet USDT for non-transferable nLP shares. A 24-hour withdrawal cooldown starts on each deposit."
      >
        <Input
          id="p6-deposit-amount"
          name="p6-deposit-amount"
          label="USDT amount"
          inputMode="decimal"
          autoComplete="off"
          value={depositAmount}
          onChange={(event) => {
            setDepositAmount(event.target.value);
            if (depositStage === "review") setDepositStage("idle");
          }}
          placeholder="0.00"
          hint={
            previewDeposit.data !== undefined
              ? `Preview shares: ${formatUnits(previewDeposit.data, shareDecimals)}`
              : "Preview uses the live pool convert function. This is not a yield."
          }
        />
        <Button onClick={handleDeposit} disabled={!isBotTestnet || depositBusy} className="mt-6">
          {depositStage === "review" ? "Approve USDT" : "Deposit USDT"}
        </Button>
        {usdtApproveHash && depositStage !== "idle" && (
          <p className="mt-2 text-xs text-muted-foreground">USDT approval submitted for the pool.</p>
        )}
        {depositError && (
          <p className="mt-3 text-sm text-[var(--ink)]" role="alert">
            {depositError}
          </p>
        )}
        <StageLine
          testId="p6-lp-deposit-stage"
          stage={depositStage}
          labels={DEPOSIT_STAGE_TEXT}
          error={depositError}
          txHash={depositHash}
        />
      </DataPanel>

      <DataPanel
        title="Withdraw LP capital"
        description="Redeem nLP for Testnet USDT only after the cooldown and only against available cash, not outstanding claims."
      >
        <Input
          id="p6-redeem-shares"
          name="p6-redeem-shares"
          label="Share amount"
          inputMode="decimal"
          autoComplete="off"
          value={redeemShares}
          onChange={(event) => {
            setRedeemShares(event.target.value);
            if (redeemStage === "review") setRedeemStage("idle");
          }}
          placeholder="0.00"
          hint={
            previewRedeemInput.data !== undefined
              ? `Preview USDT: ${formatUnits(previewRedeemInput.data, assetDecimals)}`
              : "Preview USDT comes from the live pool convert function."
          }
        />
        {cooldownActive && (
          <div className="mt-4">
            <StateNotice
              title="Withdrawal cooldown"
              message={`Redeem is blocked until the on-chain unlock time ${unlockIso ?? "(unavailable)"}.`}
              tone="warning"
            />
          </div>
        )}
        {!cooldownActive && redeemGate.reason === "no-liquidity" && (
          <div className="mt-4">
            <StateNotice
              title="Withdrawal unavailable"
              message="Cash is deployed against outstanding claims or max redeemable shares are 0. This page does not treat the position as withdrawable."
              tone="warning"
            />
          </div>
        )}
        <Button onClick={handleRedeem} disabled={redeemDisabled} className="mt-6">
          {redeemStage === "review" ? "Confirm redeem" : "Redeem shares"}
        </Button>
        {redeemError && (
          <p className="mt-3 text-sm text-[var(--ink)]" role="alert">
            {redeemError}
          </p>
        )}
        <StageLine
          testId="p6-lp-redeem-stage"
          stage={redeemStage}
          labels={REDEEM_STAGE_TEXT}
          error={redeemError}
          txHash={redeemHash}
        />
      </DataPanel>

      <DataPanel
        title="Instant liquidity"
        description="Sell an eligible PENDING redemption ticket to the public LP pool at a disclosed discount."
        className="xl:col-span-2"
      >
        <StateNotice
          title="INSTANT LIQUIDITY"
          message="Only PENDING redemption tickets are eligible. Payouts come from permissionless LP capital, not protocol-owned inventory. A CLAIMABLE ticket should be redeemed normally for full value."
          tone="warning"
        />
        {!isBotTestnet ? (
          <StateNotice title="No quote" message="Connect on BOT Testnet to see your eligible pending tickets and instant quote." />
        ) : eligible && eligible.quote ? (
          <>
            <DefinitionRows
              rows={[
                { label: "Ticket", value: `#${eligible.ticketId.toString()}` },
                { label: "Face value", value: `${fmt(eligible.faceValue, assetDecimals)} USDT` },
                { label: "Status", value: statusLabel },
              ]}
            />
            <p className="eyebrow mt-6 text-muted-foreground">INSTANT QUOTE</p>
            <DefinitionRows
              rows={[
                { label: "You receive now", value: `${fmt(eligible.quote.amountOut, assetDecimals)} USDT` },
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
                <Button onClick={handleSale} disabled={saleBusy} className="mt-6">
                  {saleStage === "review" ? "Confirm sale" : "Get instant liquidity"}
                </Button>
                {ticketApproveHash && (
                  <p className="mt-2 text-xs text-muted-foreground">Ticket approved for the pool.</p>
                )}
              </>
            )}
            {saleError && (
              <p className="mt-3 text-sm text-[var(--ink)]" role="alert">
                {saleError}
              </p>
            )}
            <StageLine
              testId="p6-tx-stage"
              stage={saleStage}
              labels={SALE_STAGE_TEXT}
              error={saleError}
              txHash={saleHash}
            />
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
                  <span className="break-all font-mono text-xs">{pool.soldTicketOwner ?? "reading…"}</span>
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
              ? "The public LP pool now owns this claim. The seller received USDT immediately; the pool harvests the full settlement when the request becomes CLAIMABLE."
              : "Waiting for confirmation of pool ownership."}
          </p>
        </DataPanel>
      )}
    </div>
  );
}
