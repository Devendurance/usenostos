# 📚 Nostos: Research Notes, Architecture Patterns & GitHub References


## Brand decision

**Nostos** (pronounced *NOS-tos*) comes from Greek *nostos*, meaning a return or homecoming. It frames the product’s central promise: capital should have a visible, reliable way home after a user requests redemption.

The name is designed to cover the full product system—RWA yield discovery, asynchronous redemption queues, settlement tracking and instant cashout—without being trapped by the mechanism currently used to deliver it. This is strategic naming rationale, not trademark, domain, social-handle or legal clearance.

This document serves as the permanent reference library for the design, open-source codebases, and architectural patterns behind **Nostos** on BOT Chain.

---

## 🏛️ 1. Essential GitHub Repositories & Reference Implementations

### A. Core ERC-7540 Asynchronous Vaults & Standards
1. **Centrifuge Liquidity Pools (ERC-7540 Institutional Reference)**
   * **GitHub**: [https://github.com/centrifuge/liquidity-pools](https://github.com/centrifuge/liquidity-pools)
   * **Key Components**: `ERC7540Vault.sol`, `TrancheToken.sol`, Epoch-based asynchronous settlement.
   * **Why it matters**: Centrifuge co-authored ERC-7540 specifically to bridge real-world credit with delayed on-chain settlements.
   * **Patterns to Reuse**: Standard ERC-7540 interface (`requestRedeem`, `claimRedeem`, `pendingRedeemRequest`, `claimableRedeemRequest`).

2. **Amphor Protocol Asynchronous Vault**
   * **GitHub**: [https://github.com/AmphorProtocol/asynchronous-vault](https://github.com/AmphorProtocol/asynchronous-vault)
   * **Key Components**: Minimal, modular Solidity implementation of ERC-7540 without Substrate bloat.
   * **Patterns to Reuse**: Clean state transitions (`Pending` ➔ `Claimable` ➔ `Claimed`).

3. **Viem ERC-7540 Client Library (Hemi Labs)**
   * **GitHub**: [https://github.com/hemilabs/viem-erc7540](https://github.com/hemilabs/viem-erc7540)
   * **Key Components**: TypeScript / Viem helper functions for interacting with ERC-7540 contracts in React/Next.js.
   * **Patterns to Reuse**: Frontend hooks for reading asynchronous queue status and estimating claimable balances.

4. **Ethereum Improvement Proposal ERC-7540 Official Standard**
   * **EIP Repository**: [https://github.com/ethereum/ERCs/blob/master/ERCS/erc-7540.md](https://github.com/ethereum/ERCs/blob/master/ERCS/erc-7540.md)
   * **Discussion Forum**: [https://ethereum-magicians.org/t/eip-7540-asynchronous-erc-4626-tokenized-vaults/16153](https://ethereum-magicians.org/t/eip-7540-asynchronous-erc-4626-tokenized-vaults/16153)

---

### B. Asynchronous Queue Architecture & Ticket Tokenization
5. **Lido DAO Core — `WithdrawalQueueERC721.sol`**
   * **GitHub**: [https://github.com/lidofinance/core](https://github.com/lidofinance/core) (specifically `contracts/0.8.9/WithdrawalQueueERC721.sol`)
   * **Key Components**: FIFO queue data structures, Tokenized Request Tickets (ERC-721 / queue IDs), Finalization Oracle accounting.
   * **Why it matters**: The gold-standard production contract managing billions in asynchronous exits.
   * **Patterns to Reuse**: Tokenizing the pending redemption claim so it can be transferred or sold to instant liquidity providers.

6. **Ondo Finance RWA Contracts & Instant Redemption Pools**
   * **Audit & Source**: [https://github.com/code-423n4/2023-09-ondo](https://github.com/code-423n4/2023-09-ondo) and [https://github.com/code-423n4/2024-03-ondo-finance](https://github.com/code-423n4/2024-03-ondo-finance)
   * **Key Components**: `USDY_InstantManager.sol`, `OUSGInstantManager.sol`, `rUSDYFactory.sol`.
   * **Patterns to Reuse**: The on-chain instant liquidity reserve buffer that satisfies small redemptions instantly while queueing large batches.
   * **Pitfalls to Avoid**: Do not copy Ondo's centralized permissioned KYC blacklist gates (`OndoIDRegistry`) that brick permissionless composability.

---

### C. Multi-Chain Routing & Intent Architecture
7. **Superform Protocol (`v2-core` & `superform-core`)**
   * **GitHub**: [https://github.com/superform-xyz/v2-core](https://github.com/superform-xyz/v2-core) and [https://github.com/superform-xyz/superform-core](https://github.com/superform-xyz/superform-core)
   * **Key Components**: `SuperLedger.sol`, `AccountingOracle.sol`, Form/Adapter pattern for ERC-4626 and ERC-7540 vaults.
   * **Why it matters**: Modular cross-chain yield routing architecture that separates user execution on Chain A from settlement on Chain B.
   * **Patterns to Reuse**: The Gateway router concept where BOT Chain acts as the unified capital entry and exit terminal.

---

## 🎯 2. Architectural Do's and Don'ts

| Component | What to Reuse (Best Practice) | What to Avoid (Anti-Pattern) |
| :--- | :--- | :--- |
| **Vault Standard** | Follow official **ERC-7540** method names and event signatures. | Do NOT create non-standard bespoke function names like `queueMyTokens()`. |
| **Queue Management** | Store requests in fixed-size arrays with indexed request IDs. | Do NOT use unbounded dynamic loops or linked-lists in Solidity that hit gas limits. |
| **Instant Liquidity** | Use a dedicated **Instant Buffer / RFQ Pool** where LPs buy pending tickets at a configurable discount spread (0.2%–0.5%). | Do NOT allow instant redemptions to drain the core vault's reserves if backing hasn't arrived. |
| **Access Control** | Use standard OpenZeppelin `Ownable2Step` or `AccessControl` for keeper roles. | Do NOT hardcode single wallet admin addresses or un-pausable withdrawal locks. |
| **User Experience** | 100% wallet-connected, zero document uploads, real-time live queue status and arrival estimate. | Do NOT force users into email forms, KYC upload portals, or manual off-chain wire confirmations. |
