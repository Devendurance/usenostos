# Nostos: Product Requirements Document (PRD)

## 1. Product Overview

- **Product Name**: Nostos (Greek for "homecoming" — capital's journey home)
- **One-line Pitch**: "Nostos is the Robinhood + Clearinghouse for tokenized real-world assets — bringing 1-click diversified RWA yields and instant-exit liquidity to BOT Chain."
- **Core Value Proposition**: Unifying fragmented RWA yield discovery with a frictionless deposit gateway, and completely solving the "capital lock-up" problem through an ERC-7540 asynchronous redemption vault paired with an instant cashout liquidity pool.
- **Target Deployment**: BOT Chain Mainnet (EVM-compatible Layer 1)

---

## 2. Problem Statement

The tokenized RWA market is expected to surpass $15B+ in 2026 and grow toward $50B+, yet user adoption is strangled by severe structural inefficiencies. Nostos solves the four major pain points:

1. **The Hotel California Trap**: Depositing into RWA vaults is easy, but leaving is notoriously difficult. Redemptions are bottlenecked by off-chain traditional finance settlement processes (e.g., T+2 or T+5 settlement), leaving users frustrated.
2. **Capital in Limbo**: During the multi-day redemption window, capital earns no yield and is completely illiquid, stranding millions of dollars in non-productive states.
3. **The Fragmented Yield Maze**: Retail savers and DAO treasuries must navigate dozens of disconnected RWA protocols, each with bespoke dashboards, varying risk profiles, and complex onboarding steps.
4. **The Emerging Chain Desert**: Newer L1s like BOT Chain lack mature, native RWA liquidity hubs, missing out on massive TVL inflows from risk-averse capital.

---

## 3. User Personas & Stories

### Persona 1: Retail Saver (Sarah)
- **Goal**: Wants safe 5-8% yield on stablecoins with the ability to instantly exit for emergencies.
- **Story**: "As a Retail Saver, I want to deposit my USDC into a top-rated T-Bill vault with 1-click, so that I can earn safe yield without complex bridging."
  - *Acceptance Criteria*: User can connect wallet, view a list of assets, approve USDC, and deposit in one transaction. User receives vault receipt tokens (e.g., nUSDY).
- **Story**: "As a Retail Saver, I want to sell my pending redemption instantly for a small fee, so that I don't have to wait 3 days to pay for an emergency expense."
  - *Acceptance Criteria*: User can initiate an Instant Cashout on a pending redemption ticket, receive USDC immediately (minus spread fee), and transfer the pending claim to the InstantPool.

### Persona 2: DAO Treasury Manager (David)
- **Goal**: Manages $1M+ idle funds; needs conservative yield but emergency liquidity.
- **Story**: "As a DAO Treasury Manager, I want to monitor aggregated yield, safety scores, and liquidity depth across RWA assets, so that I can allocate our treasury safely."
  - *Acceptance Criteria*: Dashboard displays Net APY, TVL, Safety Score (out of 10), and historical performance metrics.
- **Story**: "As a DAO Treasury Manager, I want to execute standard asynchronous redemptions, so that I can save on fees when instant liquidity is not required."
  - *Acceptance Criteria*: User can lock vault shares via `requestRedeem()`, track queue status, and `claimSettlement()` once the epoch finalizes.

### Persona 3: Liquidity Provider / Arbitrageur (Alex)
- **Goal**: Wants risk-free 15-25% APR from instant cashout spreads.
- **Story**: "As a Liquidity Provider, I want to deposit USDC into the Nostos InstantPool, so that I can earn spread fees from users choosing instant cashout."
  - *Acceptance Criteria*: LP can deposit stablecoins into the `NostosInstantPool`, view their share of the pool, and withdraw principal + earned fees.

### Persona 4: RWA Issuer (Ondo/Centrifuge equivalent)
- **Goal**: Wants a plug-and-play redemption widget to boost their token's utility.
- **Story**: "As an RWA Issuer, I want my token integrated into Nostos via ERC-7540, so that my users have a standardized way to request and claim redemptions."
  - *Acceptance Criteria*: Integration logic strictly adheres to ERC-7540 standards for interoperability.

---

## 4. Feature Specifications

### 4.1 RWA Discovery Explorer
- **Description**: The homepage and primary discovery engine.
- **Aggregated Yield Comparison Table**: Displays available RWA assets. Columns include Asset Name, Net APY, Settlement Time (e.g., T+2), Safety Score, Liquidity Depth.
- **Filter & Sort**: Users can filter by asset category (Treasuries, Private Credit, Commodities, Real Estate).
- **Data Feeds**: Real-time integration of APY and TVL metrics from the blockchain.

### 4.2 1-Click Gateway Deposit
- **Description**: Frictionless onboarding of capital.
- **Wallet Connection**: Support for MetaMask, OKX Wallet, and WalletConnect, configured specifically for BOT Chain.
- **Token Approval + Deposit**: UI groups token `approve()` and vault `deposit()` seamlessly.
- **Vault Share Minting**: Issues receipt tokens (nTokens) representing proportional ownership (e.g., nUSDY, nCREDIT).
- **Confirmation**: Displays transaction hash and links to the BOT Chain block explorer.

### 4.3 Portfolio Dashboard
- **Description**: User-specific asset overview.
- **Active Positions**: Displays current holdings, real-time yield accrual, and USD value.
- **Historical Yield Chart**: Visual representation of yield earned over time.
- **Pending Redemptions Tracker**: Lists all active redemption requests with their current status.

### 4.4 ERC-7540 Asynchronous Redemption
- **Description**: The core standard for handling off-chain RWA liquidations.
- **`requestRedeem()` Flow**: User requests to withdraw. Vault shares are locked in the contract, and a pending ticket/queue ID is generated.
- **Epoch-Based Batch Settlement**: Redemptions are batched. Off-chain keepers process the batch, returning liquid USDC to the vault for the epoch.
- **Live Queue Tracker**: UI shows queue position, countdown timer (estimated), and real-time status.
- **`claimSettlement()` Flow**: Once the epoch is resolved, the user can call this to burn their ticket and receive USDC.

### 4.5 Instant Cashout (The Core Innovation)
- **Description**: Bypasses the asynchronous wait time by utilizing a liquidity pool.
- **1-Click Sell**: User selects a pending redemption ticket and sells it to the `NostosInstantPool`.
- **Configurable Discount Spread**: The pool buys the ticket at a slight discount (default 0.3%). User receives `Ticket Value - (Ticket Value * 0.3%)`.
- **LP Mechanisms**: Liquidity Providers can deposit USDC into the pool to fund these instant buyouts, and withdraw their stake + accrued spread yield.
- **Protocol Fee Capture**: 10% of the generated spread fee goes to the Nostos Protocol Treasury; the remaining 90% goes to the LPs.

### 4.6 Keeper/Oracle System
- **Description**: Off-chain infrastructure linking RWA status to on-chain logic.
- **Automated Epoch Finalization**: Scripts to transition vault epochs and finalize batches.
- **NAV / Price Feed Updates**: Oracle scripts to securely push off-chain Net Asset Values to the smart contracts.
- **Settlement Fund Injection**: Off-chain entities transfer stablecoins back to the on-chain vault to fulfill `claimSettlement` requirements.

---

## 5. Non-Functional Requirements

- **Performance**: Sub-3-second UI response time for data loading. Smart contract calls must leverage BOT Chain's sub-second finality.
- **Security**: Must utilize OpenZeppelin standard libraries (ERC20, SafeERC20, ReentrancyGuard, Pausable, Ownable). Critical paths must strictly prevent reentrancy and manipulation.
- **Responsiveness**: The front-end must employ a mobile-first responsive design (Tailwind CSS).
- **Accessibility**: UI must adhere to WCAG 2.1 AA standards (sufficient contrast, aria-labels, keyboard navigability).

---

## 6. Success Metrics

1. **Total Value Locked (TVL)**: Aggregate capital deposited across all vaults and the InstantPool.
2. **Redemption Queue Throughput**: Volume of capital successfully processed through the ERC-7540 async redemption flow.
3. **Instant Cashout Adoption Rate**: Percentage of overall redemption requests that opt for the Instant Cashout pool vs. standard asynchronous waiting.
4. **Average Settlement Time Reduction**: Effective wait time reduction for end-users utilizing the InstantPool.

---

## 7. Out of Scope (v1)

- Cross-chain bridging and omnichain deposits (planned for future).
- Issuance of a native Governance Token ($NOSTOS).
- Mobile native application (iOS/Android).
- Real KYC/AML identity integration (v1 will assume permissionless mock assets or utilize pre-whitelisted wallets).

---

## 8. Technical Constraints

- **Blockchain Environment**: Must deploy exclusively on BOT Chain Mainnet.
- **Standards**: Must rigorously implement ERC-7540 standard interfaces for all vault redemption operations.
- **Timeline & Feasibility**: Scope is restricted to what can be built and deployed in ~48 hours by AI coding agents (Hackathon constraint).
- **Architecture**: 100% wallet-connected flows; strictly zero centralized document upload or traditional Web2 account creation required.
