# P5 — Nostos InstantPool Core — Design Spec

## Context

P0–P4 are complete. P4 deployed a fresh `NostosAsyncVaultP4` + `NostosRedemptionTicket` (ERC-721) on BOT Testnet (968). A redemption request mints ticket #N to the controller; the request moves PENDING → CLAIMABLE (settler) → CLAIMED; the current ticket owner or approved operator claims USDT; the ticket burns at claim.

P5 makes waiting optional: a PENDING ticket holder sells the claim to a protocol-owned InstantPool at a deterministic discount, receives real USDT immediately, and the pool later harvests the full settlement when the underlying request becomes CLAIMABLE.

## Architecture

### `NostosInstantPool.sol` (new, non-upgradeable)

- Inherits `ERC165`? (not required), `AccessControl`, `Pausable`, `ReentrancyGuard`. Uses `SafeERC20` for USDT.
- **Immutable bindings** (constructor):
  - `IERC20 public immutable asset` — verified BOT Testnet USDT (`0x75ed…fe3`).
  - `INostosAsyncVaultP4 public immutable vault` — deployed P4 vault.
  - `INostosRedemptionTicket public immutable ticket` — deployed P4 ticket.
- Constructor validates on-chain: `ticket.vault() == address(vault)` and `vault.redemptionTicket() == address(ticket)`; otherwise reverts. No arbitrary ERC-721 claims are ever accepted.
- Roles (all granted to deployer):
  - `DEFAULT_ADMIN_ROLE` — pricing config, liquidity withdrawal.
  - `MANAGER_ROLE` — funding.
  - `PAUSER_ROLE` — pause/unpause purchases.
- `Pausable` gates purchases (`whenNotPaused` on `sellTicket` and `setPricing`); `harvest` is deliberately NOT paused.

### Eligibility and face value

Only tickets whose underlying P4 request is `RequestStatus.Pending` (status 1) are eligible. Rejected: CLAIMABLE, CLAIMED, invalid/nonexistent request, wrong ticket contract (impossible by construction), tickets already owned by the pool.

Face value is derived from authoritative P4 accounting: read `vault.requests(requestId, controller)` → stored `shares`; call `vault.sharesToAssets(shares)` (the P4 authoritative 1:1 demo rate). NEVER read `assetsClaimable` (it is 0 while PENDING). The pool calls the vault's public view rather than hardcoding the rate.

`ticketId == requestId` in P4; the pool resolves `controller = vault.requestController(ticketId)`.

### Quote engine (deterministic, basis-point integer math)

```
liquidAssets        = asset.balanceOf(address(this))            // real read
utilizationBps      = outstandingFaceValue * 10_000 / (liquidAssets + outstandingFaceValue)
sizeRatioBps        = faceValue * 10_000 / liquidAssets          // if liquidAssets == 0 → cap 10_000
utilizationAdjust   = utilizationBps * utilizationSlopeBps / 10_000
sizeAdjust          = min(sizeRatioBps, 10_000) * sizeSlopeBps / 10_000
rawDiscount         = baseDiscountBps + utilizationAdjust + sizeAdjust
discountBps         = clamp(rawDiscount, minDiscountBps, maxDiscountBps)
amountOut           = faceValue * (10_000 - discountBps) / 10_000
cashAfter           = liquidAssets - amountOut
faceAfter           = outstandingFaceValue + faceValue
postUtilization     = faceAfter * 10_000 / (cashAfter + faceAfter)
```

- Zero liquidity (liquid + outstanding == 0) → `quoteTicket` reverts `"InstantPool: no liquid assets"`.
- `sellTicket` rejects if `amountOut > asset.balanceOf(address(this))` or `postUtilization > maxUtilizationBps`.

Config struct (`baseDiscountBps, utilizationSlopeBps, sizeSlopeBps, minDiscountBps, maxDiscountBps, maxUtilizationBps`) set by admin via `setPricing(...)` with invariant checks (min ≤ base ≤ max, min ≤ max, maxUtilization ≤ 10_000) and an emitted `PricingUpdated` event. Admin sets global bounds, never per-user quotes.

### Public reads

- `quoteTicket(uint256 ticketId) returns (Quote memory)` → `{ faceValue, amountOut, discountBps, utilizationBps, sizeRatioBps, postTradeUtilizationBps }`, computed from current state. Reverts for ineligible/zero-liquidity states.
- `liquidAssets()`, `outstandingFaceValue()`, `outstandingCostBasis()`, `realizedSpread()`, `positions(uint256 ticketId)`, `positionCount()`, config getters.

### Atomic purchase — `sellTicket(uint256 ticketId, uint256 minAmountOut)`

```
validate request PENDING + ticket exists + pool does not already own it
verify msg.sender is current ticket owner (or ERC-721 approved) → ticket.isAuthorized(msg.sender, ticketId)
compute quote from current state
require amountOut >= minAmountOut
require amountOut <= liquidAssets and postUtilization <= maxUtilizationBps
set expected-transfer context (internal storage: expected ticketId + active flag)
ticket.safeTransferFrom(seller, address(this), ticketId)   // pool is caller; seller must have approved pool
clear expected-transfer context
asset.safeTransfer(seller, amountOut)                       // pay seller immediately
record InstantPosition{ACTIVE}, increment outstandingFaceValue/outstandingCostBasis
emit InstantPurchased(ticketId, requestId, seller, faceValue, amountOut, discountBps)
```

Atomicity: any failure (NFT transfer, USDT transfer, ERC721Receiver, approval) reverts the whole transaction. CEI: state updates happen before external calls; `ReentrancyGuard` protects entry.

### `onERC721Received` (unsolicited-ticket protection)

Accepts ONLY when: `msg.sender == address(ticket)`, the expected-transfer context is active, and `tokenId == expected ticketId`. All other transfers revert with `InstantPool: unsolicited ticket`. The context is set/cleared only inside `sellTicket` (nonReentrant), so a stray `safeTransferFrom` into the pool strands nothing and pays nothing.

### Position / accounting

```
struct InstantPosition {
    uint256 ticketId;
    uint256 requestId;
    address seller;
    uint256 faceValue;
    uint256 costBasis;
    uint256 discountBps;
    uint64  acquiredAt;
    uint64  settledAt;
    Status  status;      // ACTIVE, SETTLED
}
```

Global: `outstandingFaceValue`, `outstandingCostBasis`, `realizedSpread`. Discount is NOT counted as profit at purchase (example: face 100, price 99.20 → potential 0.80, realized 0).

### Harvest — `harvest(uint256 ticketId)` (permissionless, not paused)

```
position exists && status == ACTIVE
ticket.ownerOf(ticketId) == address(this)
vault request status == Claimable
vault.claimRedeem(requestId, address(this))    // payout ALWAYS the pool; ticket burns
position.status = SETTLED; settledAt = now
outstandingFaceValue -= faceValue
outstandingCostBasis -= costBasis
realizedSpread += faceValue - costBasis
emit TicketHarvested(ticketId, requestId, faceValue, costBasis, realizedSpread)
```

Double harvest reverts (ACTIVE check). Random keepers may pay gas; funds cannot be redirected (payout is contract-fixed; nobody else holds ticket auth).

### Funding / withdrawal

- `fund(uint256 amount)` — `onlyRole(MANAGER_ROLE)`, `whenNotPaused`? (funding is safe while paused; allow it), transfers `amount` USDT from manager into pool, emits `LiquidityFunded`.
- `withdrawLiquidity(uint256 amount)` — `onlyRole(DEFAULT_ADMIN_ROLE)`, requires `outstandingFaceValue == 0`, transfers `amount` USDT to `msg.sender`, emits `LiquidityWithdrawn`. Conservative: no withdrawal while any exposure exists.

## Frontend

Wire the existing `app/(product)/pool/page.tsx` (no duplicate route). Add:

- `lib/contracts/nostos-instant-pool-abi.ts` — hand-written minimal ABI matching the pool.
- `lib/chain/instant-pool-hooks.ts` — client hook with real reads gated by BOT Testnet + connected wallet + persisted pool address: `liquidAssets`, `outstandingFaceValue`, `outstandingCostBasis`, `realizedSpread`, utilization (computed), config, and the connected user's eligible PENDING ticket (reusing `useTicketedVault` owned-ticket logic) + `quoteTicket` read.
- `components/product/instant-pool-panel.tsx` — metrics panel + quote card + sale flow:

```
AVAILABLE LIQUIDITY / OUTSTANDING CLAIM FACE VALUE / OUTSTANDING COST BASIS / UTILIZATION / REALIZED SPREAD
Ticket #N · Face value · Status (PENDING)
INSTANT QUOTE: You receive now / Discount / Pool utilization / Trade-size impact
[Get instant liquidity]
REVIEW → (APPROVE TICKET if required) → SIGN SALE → SUBMITTED → CONFIRMING → CONFIRMED/FAILED
```

- After success: `refetchAll`; show `ticket owner = InstantPool`, seller received USDT. Never mark success before receipt confirmation.
- If the ticket is CLAIMABLE, disable Instant sale and tell the user to claim normally.
- Preserve wrong-network/disconnected behavior (P1 pattern).
- The deployed pool address comes from the persisted `p5.instantPool` (E2E fixture injects a fake one, ignored in production).

## Tooling / deployment

- `scripts/registry/p5-plan.ts` — `buildP5DeployPlan` / `buildP5FundingPlan` / `buildP5HarvestPlan` gated by `P5_ENABLE_TESTNET_DEPLOY=true`, require `BOT_TESTNET_PRIVATE_KEY`, verified Testnet USDT, chain 968, and persisted P4 `asyncVault` + `redemptionTicket` (refuse inconsistent/incomplete P4 records).
- `scripts/registry/deploy-instant-pool.ts` — deploys pool with constructor args `[asset, vault, ticket]`, waits for success receipt, verifies code, persists nested `p5` record (P3/P4 keys untouched), prints tx/address/block/explorer. Idempotent: reuses persisted pool address after confirming code.
- `scripts/registry/fund-instant-pool.ts` — manager funds the pool.
- `scripts/registry/harvest-instant-pool.ts` — optional permissionless harvest helper (guarded read of positions; may be called by anyone).
- Reuse `sendP4Transaction`/`waitForP4Receipt`/RPC health protections (P0.5 stale-RPC + nonce/balance consistency). Fail closed before network writes without opt-in.
- `lib/chain/deployed-addresses.ts` gains `p5?: P5Deployment` type; `scripts/registry/artifact.ts` gains `instantPoolAbi`/`instantPoolBytecode` via `readOptionalArtifact`.

## Tests

Foundry `contracts/test/NostosInstantPool.t.sol` covering at minimum the 27 required cases (funding, quote base/utilization/size/clamps/zero-liquidity/max-utilization, eligibility PENDING-only, CLAIMABLE/wrong/nonexistent rejection, minAmountOut, seller-owns, missing approval atomicity, atomic transfer both directions, unsolicited safeTransferFrom rejected, position/exposure accounting, discount-not-realized, seller-cannot-claim, harvest-before-claimable reverts, permissionless harvest, payout-fixed, ticket burns, realizedSpread exact, no double harvest, multi-position isolation, withdrawal blocked with exposure, harvest while paused). All P3/P4 Foundry tests preserved.

Vitest: `tests/unit/p5-plan.test.ts` (fail-closed plans, provenance, chain 968, verified USDT, P4 record validation), quote/pool hook unit helpers. E2E: `tests/e2e/p5-rpc-fixture.ts` + `p5-instant-pool.spec.ts` with isolated RPC interception only (approval/sale lifecycle, quote rendering, wrong network, real-read behavior, truthful failure states).

## Verification gates

```
npm test
npx tsc --noEmit
npm run lint
rm -rf .next && npm run build
npm run test:e2e
forge build --root contracts
forge test --root contracts -vv
forge fmt --check on new/modified P5 Solidity files
```

## Scope guards

No deploy, no funding, no transactions during implementation. No LP shares / ERC-4626 / P6. No RFQ/order books/oracle/fake ETA. No per-user admin pricing. P3/P4 provenance untouched. P4 claim ownership not weakened. No secrets. Nothing committed.