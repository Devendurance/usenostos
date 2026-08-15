# Nostos — Mainnet Product Requirements Document

**Version:** Hackathon Scope v2
**Target:** BOT Chain Builder Challenge #2 — RWA Applications
**Deployment:** BOT Chain Mainnet
**Product state at start:** Full UI shell already implemented
**Build principle:** Real data. Real contracts. Real assets. Real Mainnet transactions. No mock product state.

---

# 1. Product Definition

## Product

**Nostos**

## Category

**RWA redemption and settlement infrastructure**

## Primary tagline

**Capital on its way home.**

## One-line product description

Nostos gives tokenized real-world assets a visible asynchronous redemption queue and an optional instant-liquidity exit path on BOT Chain.

## Core proposition

Tokenized assets have made entering positions increasingly easy while redemption often remains slow, opaque and operationally awkward.

Nostos makes the exit visible.

A user should be able to answer:

* Where is my redemption?
* What state is it in?
* What can I claim?
* When is settlement expected?
* Can I leave before settlement?
* What will leaving early cost?
* Where is the on-chain proof?

Nostos turns a pending redemption into an explicit, inspectable claim rather than an unexplained "processing" state.

---

# 2. Hackathon Objective

The hackathon product must demonstrate a **real Mainnet lifecycle**, not a simulated financial dashboard.

The final demo must prove that Nostos can:

1. operate on BOT Chain Mainnet;
2. use real wallet balances and real deployed contracts;
3. create real redemption requests;
4. move requests through explicit settlement states;
5. represent a pending redemption as an on-chain claim;
6. fund and execute a real instant cashout;
7. transfer ownership of the pending claim;
8. allow the new claim owner to receive the eventual settlement;
9. produce an inspectable BOT Chain settlement receipt.

The primary judging story is:

> A tokenized asset can take time to settle. Nostos makes that wait visible and gives the holder another option.

---

# 3. Non-Negotiable Truth Rules

Nostos must never manufacture product state for presentation.

## Forbidden

* MockUSDT on Mainnet.
* Fake wallet balances.
* Fake transaction hashes.
* Hardcoded TVL presented as live TVL.
* Hardcoded APYs presented as current APYs.
* Fake queue positions.
* Fake LP balances.
* Fake pool utilization.
* Fake yield earned.
* Fake "live" countdowns.
* Fake settlement completion.
* Fabricated RWA backing.
* Fabricated issuer integrations.
* Calling a pending claim "cash".
* Claiming guaranteed or risk-free yield.
* Claiming liquidity is available when the pool cannot actually satisfy the quote.

## Required behavior

When live information is unavailable, Nostos displays:

**Unavailable**, **Not reported**, **Not currently supported**, or an equivalent truthful state.

It never silently substitutes fixture data.

Every significant financial number should have identifiable provenance:

* BOT Chain contract state;
* token balance;
* transaction/event;
* liquidity-pool balance;
* issuer/source-chain data;
* explicit protocol calculation.

---

# 4. Mainnet Environment

Nostos targets:

* **Network:** BOT Chain Mainnet
* **Chain ID:** `677`
* **Native gas token:** BOT
* **RPC:** official BOT Chain Mainnet RPC
* **Explorer:** BOT Chain Mainnet explorer
* **Settlement denomination:** real bridged USDT on BOT Chain, subject to canonical-token verification before deployment.

The frontend must reject transactions on the wrong chain and provide a BOT Chain network-switch flow.

No production transaction path may fall back to testnet.

---

# 5. Critical Asset Rule

Before any vault or pool is deployed, the implementation must establish and independently verify the canonical BOT Chain USDT contract intended for the protocol.

Verification must include:

* contract address;
* token symbol;
* decimals;
* `totalSupply()`;
* a known holder or live transfer;
* successful `balanceOf()`;
* successful small transfer using the builder wallet;
* source through BOT Bridge/BDEX or confirmation from the BOT team;
* explorer inspection.

The verified address becomes a single environment/config constant used by every Nostos contract and frontend transaction.

There will be **no Nostos-created USDT replacement**.

---

# 6. RWA Truth Boundary

Nostos separates two things carefully:

### RWA market information

Nostos may show real RWA products and data retrieved from genuine issuer, source-chain or market sources.

Every displayed product must state its source and update time.

### Nostos Mainnet settlement infrastructure

Nostos contracts run on BOT Chain and provide:

* request creation;
* queue state;
* settlement accounting;
* transferable claim ownership;
* liquidity quotes;
* instant cashout;
* settlement receipts.

Nostos must not imply that a displayed RWA is natively deposited into a BOT Chain Nostos vault unless an actual asset/issuer adapter exists and the corresponding capital movement is real.

A live external RWA listing can therefore be **discoverable but not executable** until integrated.

This keeps the demo truthful without inventing RWA backing.

---

# 7. Primary Users

## 7.1 Treasury operator / serious RWA investor

Needs conservative capital deployment while preserving visibility over exits.

Primary jobs:

* inspect RWA terms;
* understand settlement behavior before entering;
* see existing positions;
* request redemption;
* track settlement;
* compare waiting against early liquidity.

## 7.2 RWA issuer / asset manager

Needs reusable redemption infrastructure rather than building queue, claim, settlement and user-tracking systems independently.

Primary jobs:

* register an integration;
* specify settlement rules;
* process redemption batches;
* fund completed settlement;
* expose verifiable settlement history.

## 7.3 Liquidity provider

Provides real USDT liquidity to acquire eligible pending redemption claims at a disclosed discount.

Primary jobs:

* deposit liquidity;
* inspect available and committed capital;
* acquire claims;
* receive eventual settlement;
* withdraw available liquidity and realized earnings.

---

# 8. Product Modules

Nostos consists of five product modules.

## 8.1 Nostos Gateway

Discovery and entry surface.

Displays genuine RWA opportunities and integration status.

## 8.2 Nostos Vaults

The contract layer representing supported asset integrations and their settlement rules.

## 8.3 Nostos Queue

The asynchronous redemption system.

States:

`PENDING → CLAIMABLE → CLAIMED`

An instant exit adds claim ownership transfer without pretending the underlying settlement has already occurred.

## 8.4 Nostos Instant

A prefunded USDT liquidity pool capable of purchasing eligible pending claims.

## 8.5 Nostos Registry

Public metadata and settlement records connecting vaults, requests, claims and transactions.

---

# 9. Main User Flow

The hackathon's defining lifecycle is:

```text
REAL ASSET / POSITION
        ↓
REQUEST REDEMPTION
        ↓
PENDING CLAIM CREATED
        ↓
┌─────────────────────┬───────────────────────────┐
│ STANDARD SETTLEMENT │ INSTANT CASHOUT           │
│                     │                           │
│ Wait                │ Pool quotes claim         │
│ ↓                   │ ↓                         │
│ Claimable           │ User accepts discount     │
│ ↓                   │ ↓                         │
│ Redeem              │ Real USDT paid immediately│
│ ↓                   │ ↓                         │
│ User receives USDT  │ Claim ownership → Pool    │
└─────────────────────┴────────────┬──────────────┘
                                   ↓
                         Underlying settles later
                                   ↓
                          Pool claims settlement
```

A claim bought by the pool remains **pending settlement** until settlement genuinely occurs.

---

# 10. RWA Explorer Requirements

The existing explorer UI remains, but all cards become provenance-driven.

Each asset may contain:

* issuer;
* product name;
* category;
* network;
* underlying asset;
* current reported yield/APY where available;
* data source;
* last updated timestamp;
* stated settlement window;
* minimum;
* fees;
* TVL/AUM where available;
* Nostos integration state.

Integration states:

* `DISCOVERY_ONLY`
* `DEPOSIT_SUPPORTED`
* `REDEMPTION_SUPPORTED`
* `INSTANT_LIQUIDITY_SUPPORTED`
* `PAUSED`

A product that hasn't been integrated must not show an actionable deposit button.

---

# 11. Vault Detail Requirements

Each vault page displays:

### Identity

Issuer, asset, category and source.

### Yield

Latest reported yield plus:

* source;
* timestamp;
* methodology where required.

### Exit terms

This is more important than the headline yield.

Display:

* standard settlement estimate;
* redemption mechanism;
* known fees;
* current Nostos support;
* instant-liquidity eligibility.

### Live protocol data

Where integrated:

* contract address;
* current assets;
* share balance;
* redemption capacity;
* active request count;
* pool liquidity;
* explorer links.

---

# 12. Wallet Requirements

Support standard EVM wallets through Wagmi/Viem.

Minimum:

* injected MetaMask-compatible wallet;
* WalletConnect-compatible wallets where the existing shell supports them.

Wallet state is the source of truth.

The application must:

* detect connection;
* display real connected address;
* detect chain;
* switch/add BOT Chain;
* read real BOT balance;
* read real settlement-token balance;
* refresh after confirmed transactions;
* never invent disconnected-wallet portfolio state.

---

# 13. Smart Contract Architecture

The Mainnet protocol contains four primary components.

## 13.1 `NostosRegistry`

Purpose:

Canonical registry of Nostos-supported integrations.

Responsibilities:

* register vault;
* store immutable identifiers;
* store integration status;
* store settlement configuration;
* expose vault list;
* pause/deactivate integrations;
* emit registration/update events.

Dynamic market data such as APY should not be presented as trustworthy merely because an admin wrote a number on-chain.

Where possible it comes directly from the actual source and retains provenance.

---

## 13.2 `NostosAsyncVault`

Purpose:

Asynchronous redemption vault following ERC-4626/ERC-7540 semantics.

Required redemption interface includes the ERC-7540 request lifecycle:

```solidity
requestRedeem(...)
pendingRedeemRequest(...)
claimableRedeemRequest(...)
```

Once the request becomes claimable, the standard ERC-4626 `redeem()` / `withdraw()` flow is used to claim the assets.

Nostos should not invent `claimRedeem()` and call it strict ERC-7540 compliance.

### Request lifecycle

`PENDING`

Shares have been committed and settlement has not been funded/finalized.

`CLAIMABLE`

Real settlement assets are available and reserved for the request.

`CLAIMED`

The controller/claim holder has pulled the corresponding assets.

### Fundamental invariant

A keeper cannot manufacture settlement by changing a status variable.

A request becomes claimable only when the protocol has sufficient real settlement assets available/reserved for it.

---

# 14. Redemption Claim Ticket

Nostos may wrap a pending redemption claim in an ERC-721 ticket.

The ticket represents:

* request ID;
* vault;
* request controller/current claim owner;
* shares committed;
* creation timestamp;
* applicable settlement batch;
* current lifecycle.

The ticket does **not** represent cash.

The ERC-721 exists to make the pending claim transferable to the Instant Pool.

### Transfer restrictions

Transfer must preserve the right to the eventual underlying settlement.

There can never be two owners capable of claiming the same settlement.

After Instant Cashout:

* previous holder loses settlement rights;
* Instant Pool becomes the claim holder;
* the original request remains pending;
* settlement status does not magically change.

---

# 15. Nostos Instant Pool

`NostosInstantPool` holds real BOT Chain USDT supplied by LPs.

It purchases qualifying pending redemption tickets.

## Quote

For an estimated settlement value `G` and configured discount `d`:

```text
discount = G × d
netToUser = G - discount
```

Default hackathon parameter:

```text
discount = 30 bps = 0.30%
```

The protocol receives 10% of the realized spread and LPs receive 90%, subject to the implemented fee contract.

All values must be shown before confirmation.

## Quote response

```text
GROSS CLAIM VALUE
DISCOUNT %
DISCOUNT AMOUNT
NET TO USER
POOL AVAILABLE LIQUIDITY
QUOTE EXPIRY
```

## Execution preconditions

Instant cashout reverts if:

* ticket doesn't exist;
* ticket isn't eligible;
* ticket isn't pending;
* caller doesn't control the ticket;
* quote expired;
* pool lacks sufficient available USDT;
* contract is paused;
* settlement valuation changed beyond allowed tolerance.

## Execution

In one successful state transition:

1. validate claim;
2. validate liquidity;
3. transfer claim ownership to pool;
4. transfer real USDT from pool to user;
5. record acquisition;
6. emit event.

The UI only displays **Cashout confirmed** after transaction confirmation.

---

# 16. LP Mechanics

LPs provide the actual capital enabling Nostos Instant.

Required actions:

```text
Approve USDT
→ Deposit USDT
→ Receive pool accounting position
→ Capital becomes available
→ Claims consume available liquidity
→ Claims settle
→ Capital + realized spread returns to pool
→ LP withdraws available position
```

Pool accounting must distinguish:

* total assets;
* available liquidity;
* capital committed to pending claims;
* realized spread;
* protocol fees;
* withdrawable liquidity.

The frontend must never calculate an imaginary "15–25% risk-free APR."

If an APR is eventually displayed, it must be derived from realized historical fee income and clearly labelled as historical, not guaranteed.

---

# 17. Settlement Coordinator

An authorized coordinator/keeper handles asynchronous settlement administration.

It may:

* detect settlement batches;
* submit actual settlement assets;
* finalize a funded batch;
* update verified metadata where required.

It may **not** create money through bookkeeping.

Correct settlement sequence:

```text
Underlying/issuer settlement occurs
        ↓
Real USDT reaches the settlement path
        ↓
On-chain balance is verified
        ↓
Assets reserved against requests
        ↓
Requests become CLAIMABLE
```

Keeper keys must use a dedicated role separate from protocol ownership.

All privileged transitions emit events.

---

# 18. Standard Redemption UX

When the user requests redemption:

### Before confirmation

Display:

```text
SHARES
ESTIMATED VALUE
ESTIMATED SETTLEMENT
KNOWN FEES
REQUEST PATH
```

Settlement timing is explicitly an estimate.

### After confirmation

Display:

* request ID;
* transaction hash;
* vault;
* shares;
* estimated assets;
* state: `PENDING`;
* request timestamp;
* settlement estimate;
* explorer link.

### Claimable

Display:

> Settlement is available. Claim your eligible amount from this request.

### Claimed

Display actual:

* gross assets;
* amount received;
* claim transaction;
* settlement timestamp.

---

# 19. Instant Cashout UX

Instant liquidity appears only if a real quote can currently be fulfilled.

Before confirmation:

```text
CLAIM VALUE       10,000 USDT
DISCOUNT          0.30%
NET               9,970 USDT
POOL LIQUIDITY    live value
QUOTE EXPIRES     real expiry
```

Required warning:

> You are transferring the pending redemption claim to the liquidity pool. You receive the quoted net amount now; the pool receives the underlying settlement later.

After execution, the user's portfolio distinguishes:

**Cashout received**

from:

**Underlying claim settled**

Those are different events.

---

# 20. Portfolio

Portfolio is entirely wallet-derived.

It contains:

### Active Positions

Real balances only.

### Pending Redemptions

Requests controlled by the connected wallet.

### Purchased/Sold Claims

If applicable.

### Transaction History

Confirmed Mainnet actions connected to the wallet.

No sample users or sample positions appear in production.

---

# 21. Redemption Queue

Each request exposes:

* request ID;
* owner/controller;
* current claim owner;
* vault;
* shares;
* estimated assets;
* final assets once determined;
* epoch/batch;
* requested timestamp;
* status;
* standard settlement estimate;
* instant-liquidity eligibility;
* request transaction;
* cashout transaction when applicable;
* settlement/claim transaction.

Queue states must be derived from contract state.

"Queue position" may only be shown if it can actually be calculated from protocol ordering.

---

# 22. Nostos Receipt

Every completed path gets a human-readable receipt.

Example:

```text
NOSTOS SETTLEMENT / #0041

VAULT          [REAL VAULT]
REQUEST        #0041
PATH           INSTANT CASHOUT

GROSS          10,000 USDT
DISCOUNT       0.30%
NET            9,970 USDT

CLAIM OWNER    NOSTOS INSTANT POOL
CASHOUT        CONFIRMED
UNDERLYING     PENDING / SETTLED

NETWORK        BOT CHAIN MAINNET

REQUEST TX     0x...
CASHOUT TX     0x...
SETTLEMENT TX  0x...
```

Receipt pages are shareable without requiring wallet connection.

---

# 23. Data Architecture

There are three classes of data.

## Class A — Direct on-chain state

Read through Viem/RPC:

* balances;
* allowances;
* shares;
* request state;
* pool assets;
* ticket ownership;
* configured parameters.

## Class B — Mainnet transaction history

Indexed from confirmed BOT Chain transactions/events.

The indexer exists for query performance; it is not the authority over financial state.

## Class C — External RWA information

Fetched from the real issuer/protocol/source.

Each record stores:

```text
source
source identifier
retrievedAt
asOf
raw value
normalized value
```

Stale source data must be labelled stale rather than replaced with a default.

---

# 24. Off-Chain Database

The database is a read/indexing layer.

Minimum entities:

* `vaults`
* `market_snapshots`
* `deposits`
* `redemption_requests`
* `redemption_tickets`
* `epochs`
* `instant_cashouts`
* `lp_positions`
* `settlement_receipts`
* `sync_cursors`

Every transactional record includes:

* chain ID;
* contract address;
* tx hash;
* block number;
* block timestamp.

The database may enrich blockchain state but must never invent or override it.

---

# 25. BOT RPC Constraint

The implementation must account for BOT Chain RPC behavior during P0.

If the official endpoint cannot service historical log queries required by the indexer, use an explicitly configured indexer/WebSocket/explorer provider.

This must be solved deliberately rather than discovering it during final integration.

Direct contract reads remain the authoritative fallback for current user state.

---

# 26. Security Requirements

Contracts use established OpenZeppelin components where applicable.

Required protections:

* `SafeERC20`;
* reentrancy protection;
* pausing;
* explicit roles;
* two-step ownership where appropriate;
* fee caps;
* discount caps;
* checks-effects-interactions;
* no unbounded state-changing loops;
* pull-based settlement claims;
* duplicate-claim protection;
* double-cashout protection;
* quote expiry;
* pool solvency checks.

### Critical invariants

1. A request can settle once.
2. A ticket can be sold once while pending.
3. The original owner cannot claim after selling the claim.
4. The pool cannot cash out more USDT than it has available.
5. LP committed capital cannot be withdrawn as available capital.
6. Keeper actions cannot create unfunded claimable assets.
7. Protocol fee cannot exceed configured cap.
8. Pausing new activity does not strand already-funded user claims where technically avoidable.

---

# 27. Product Error States

Every write flow must cover:

* wallet disconnected;
* wrong network;
* insufficient BOT gas;
* insufficient USDT;
* insufficient allowance;
* insufficient shares;
* quote expired;
* pool insufficient;
* request already processed;
* request not claimable;
* rejected signature;
* reverted transaction;
* RPC unavailable;
* stale external data;
* unsupported integration.

Failures remain visible and actionable.

---

# 28. Transaction UX Standard

Every financial transaction follows:

```text
REVIEW
→ SIGN
→ SUBMITTED
→ CONFIRMING
→ CONFIRMED / FAILED
```

After confirmation the UI displays:

* operation;
* amount;
* transaction hash;
* block explorer;
* resulting protocol state.

Optimistic UI must not represent financial completion as confirmed before chain confirmation.

---

# 29. Mainnet Demo Lifecycle

The submission must contain at least one complete genuine lifecycle.

Preferred demo:

```text
Wallet A
   ↓
Real Mainnet position / supported vault
   ↓
requestRedeem()
   ↓
Pending claim created

Wallet B / LP
   ↓
Deposits real USDT into InstantPool

Wallet A
   ↓
Gets real quote
   ↓
Accepts Instant Cashout
   ↓
Receives real USDT
   ↓
Claim transfers to pool

Settlement coordinator
   ↓
Funds/finalizes real settlement

InstantPool
   ↓
Claims settlement

Receipt
   ↓
Shows entire lifecycle + Mainnet transactions
```

A second request should demonstrate the standard settlement path.

That gives judges the comparison immediately.

---

# 30. Current Hackathon Scope

## Must ship

* BOT Mainnet configuration.
* Real wallet integration.
* Canonical real settlement token.
* Real contract deployment.
* RWA Registry.
* At least one genuine data-source integration.
* Async redemption request lifecycle.
* Pending claim/ticket.
* Standard settlement.
* Instant Cashout pool.
* LP deposit.
* LP withdrawal of available liquidity.
* Real cashout.
* Claim transfer.
* Pool settlement.
* Portfolio.
* Queue tracker.
* Public receipt.
* Explorer links.
* Production deployment.
* Documented Mainnet transaction hashes.

## Ship if the underlying integration actually supports it

* Direct RWA deposits from BOT Chain.
* Real yield accrual.
* multiple RWA issuers.

## Explicitly not required for this hackathon version

* cross-chain routing engine;
* generalized bridge architecture;
* governance token;
* DAO governance;
* secondary open claim marketplace;
* dynamic RFQ market makers;
* automated underwriting;
* complex oracle network;
* mobile app;
* full issuer onboarding portal;
* KYC/AML platform;
* dozens of asset integrations.

One convincing real lifecycle is more valuable than ten fake vault cards.

---

# 31. Build Sequence

## P0 — Mainnet Reality Check

Establish the ground truth before protocol development.

Deliver:

* BOT Mainnet chain config;
* working RPC;
* explorer;
* funded builder wallet;
* real BOT balance;
* canonical USDT verification;
* real USDT balance;
* successful tiny Mainnet transfer;
* RPC/indexing capability audit;
* env/config layer.

**Exit condition:** the application can read and transact with actual BOT Mainnet assets.

---

## P1 — Wallet + Live Data Foundation

Connect the existing UI shell to:

* real wallet;
* chain state;
* BOT balance;
* USDT balance;
* transaction lifecycle;
* explorer URLs.

Remove every wallet-related fixture.

**Exit condition:** refreshing the app reproduces state directly from Mainnet.

---

## P2 — Registry + Real RWA Data

Implement:

* source adapters;
* data provenance;
* Nostos Registry;
* integration states;
* live explorer;
* vault detail data.

Remove fake APY, TVL, health scores and settlement terms.

**Exit condition:** every displayed market value can be traced to an actual source.

---

## P3 — Core Async Vault

Implement and test:

* vault shares where applicable;
* ERC-7540 redeem request interface;
* Pending state;
* Claimable state;
* settlement funding;
* standard claim;
* request events;
* request reads.

Deploy to Mainnet after local testing.

**Exit condition:** one real request can be created, funded and claimed on BOT Mainnet.

---

## P4 — Claim Ticket + Queue

Implement:

* ticket creation;
* ownership;
* transfer rights;
* queue UI;
* lifecycle state;
* portfolio integration.

**Exit condition:** pending claims are real inspectable Mainnet objects.

---

## P5 — Nostos Instant

Implement:

* real LP funding;
* live pool liquidity;
* quote calculation;
* quote expiry;
* claim acquisition;
* real USDT payout;
* fee accounting.

**Exit condition:** a user sells a pending claim and receives actual USDT on Mainnet.

---

## P6 — Settlement + LP Completion

Implement:

* settlement coordinator;
* settlement funding;
* pool claim;
* realized spread;
* LP accounting;
* safe withdrawals.

**Exit condition:** the acquired claim completes the entire lifecycle and its proceeds return to the pool.

---

## P7 — Indexing, Receipts + Judge Mode

Implement:

* durable history;
* public settlement receipt;
* transaction links;
* production error states;
* seeded **real** Mainnet history;
* README;
* architecture;
* contract addresses;
* demo script;
* final Vercel production QA.

**Exit condition:** a judge can understand and verify Nostos without trusting the presentation.

---

# 32. Definition of Done

Nostos is hackathon-ready only when:

* production UI connects to BOT Chain Mainnet;
* all product balances are real;
* no mock financial data remains;
* contracts are deployed and inspectable;
* a genuine Mainnet settlement asset is used;
* at least one real external RWA data source powers discovery;
* a redemption request exists on-chain;
* its state transitions are inspectable;
* a standard redemption can complete;
* an LP can fund the Instant Pool;
* a pending claim can be sold;
* real USDT reaches the seller;
* claim ownership transfers correctly;
* the pool can receive subsequent settlement;
* a public receipt reconstructs the lifecycle;
* transaction hashes are included in submission material;
* no unsupported yield, safety, backing or liquidity claim appears anywhere in the product.

---

# 33. Product Success for This Hackathon

The win condition isn't:

> We built the biggest RWA dashboard.

It is:

> We proved a missing piece of RWA infrastructure on BOT Chain with real Mainnet capital.

A judge should be able to watch a pending redemption appear, see exactly where the capital sits, compare waiting against instant liquidity, execute the instant path and verify every material transition independently on BOT Chain.

That is Nostos.

**Capital on its way home.**
