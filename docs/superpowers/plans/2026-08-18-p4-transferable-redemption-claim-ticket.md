# P4 Transferable Redemption Claim Ticket Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` to implement this plan task-by-task. Do not commit any changes.

**Goal:** Add a fresh, non-upgradeable P4 async vault whose ERC-721 ticket is the live economic owner of each redemption claim, while preserving the deployed P3 vault and all existing accounting behavior.

**Architecture:** Create `NostosRedemptionTicket.sol` with immutable vault binding and vault-only mint/burn. Create a separate `NostosAsyncVaultP4.sol` based on the verified P3 logic, adding one-time ticket configuration, atomic ticket minting, ticket-authorized claim wrappers, and `claimRedeem(requestId, receiver)`. Keep P3 address fields and frontend fallback intact; add versioned P4 deployment records, guarded scripts, ticket-aware hooks/UI, metadata, and tests.

**Tech Stack:** Solidity `^0.8.24`, Foundry, OpenZeppelin Contracts `5.3.0` ERC721, Next.js `16.3.1` App Router, TypeScript, Wagmi `3.7.6`, Viem `2.55.17`, Vitest, Playwright.

## Global Constraints

- Keep all changes uncommitted.
- Do not deploy, register, settle, transfer USDT, or send any blockchain transaction.
- Do not mutate or imply an upgrade to the deployed P3 `NostosAsyncVault`.
- Preserve BOT Testnet chain ID `968`, verified Testnet USDT, stale-RPC safeguards, and no Mainnet frontend writes.
- Preserve P3 source, ABI, tests, CLI behavior, and top-level address provenance.
- Ticket ownership is authoritative for claim authorization; do not add mutable vault-side claim-owner storage.
- `ticketId == requestId`.
- Ticket mint and burn are callable only by the bound vault.
- `requestRedeem` must revert while the ticket address is missing.
- Ticket configuration is one-time and cannot be replaced.
- PENDING and CLAIMABLE tickets transfer; CLAIMED tickets are burned.
- P3 full-only claim behavior remains; no cancellation, partial claims, batching, marketplace, or P5 work.
- Use real contract reads in production UI; test-only RPC fixtures must not be exposed as production configuration.
- Run Foundry `forge build` after Solidity changes before TypeScript artifact consumers are tested.

## File Map

### New contract files

- `contracts/src/interfaces/INostosRedemptionTicket.sol`: narrow vault-facing ticket interface containing `vault`, `mint`, `burn`, and `isAuthorized`.
- `contracts/src/NostosRedemptionTicket.sol`: OpenZeppelin ERC721 claim ticket with immutable vault authorization.
- `contracts/src/NostosAsyncVaultP4.sol`: versioned fresh P4 vault containing copied P3 lifecycle/accounting plus ticket integration.
- `contracts/test/NostosRedemptionTicket.t.sol`: isolated ERC721 behavior and vault-only authority tests.
- `contracts/test/NostosAsyncVaultP4.t.sol`: P4 request, transfer, settlement, claim, accounting, pause, and receiver tests.

### Modified contract/tooling files

- `scripts/registry/artifact.ts`: load P4 vault and ticket artifacts without changing P3 artifact exports.
- `scripts/registry/p4-plan.ts`: P4 opt-in, chain, key, asset, address, and registry plan types.
- `scripts/registry/deploy-vault-p4.ts`: guarded vault -> ticket -> one-time configure deployment sequence with nested P4 persistence.
- `scripts/registry/register-vault-p4.ts`: guarded registry registration/update using the P4 vault and updated metadata hash.
- `scripts/registry/settle-p4.ts`: guarded P4 settlement CLI with ticket/current-owner reporting.
- `package.json`: P4 deployment, registry, and settlement commands.
- `contracts/addresses/bot-testnet.json`: do not add fake P4 addresses; only the guarded script may add a real nested `p4` record later.

### New/modified frontend files

- `lib/contracts/nostos-async-vault-p4-abi.ts`: P4 vault read/write ABI.
- `lib/contracts/nostos-redemption-ticket-abi.ts`: ERC721/ticket ABI.
- `lib/chain/deployed-addresses.ts`: optional nested P4 address schema while preserving P3 fields.
- `lib/chain/ticketed-vault-hooks.ts`: real P4 vault/ticket reads, owned-ticket discovery, authorization, and refetching.
- `components/product/ticketed-demo-vault-panel.tsx`: P4 ticket display, transfer, claim, deposit, request, and transaction-stage UI.
- `app/(product)/vaults/[address]/page.tsx`: render P4 panel only when a complete persisted P4 deployment record exists; otherwise retain P3 panel.

### New/modified metadata and tests

- `lib/rwa/opportunities/demo-vault.ts`: truthful transferable-ticket metadata only for the Nostos demo.
- `tests/unit/p4-plan.test.ts`: P4 guard, address schema, and metadata plan behavior.
- `tests/unit/rwa-opportunities.test.ts`: P4 metadata assertions while preserving OUSG/TBILL status.
- `tests/e2e/nostos.spec.ts`: P4 fallback and ticket UI coverage.
- `tests/e2e/p4-rpc-fixture.ts`: isolated deterministic RPC fixture for UI mechanics only.
- `playwright.config.ts`: test-only fixture environment wiring for the P4 E2E suite.
- `.agent-state/left-off.md`: current P4 status, files, verification, and blockers.

## Task 1: Implement the ERC-721 Ticket

**Files:**
- Create: `contracts/src/interfaces/INostosRedemptionTicket.sol`
- Create: `contracts/src/NostosRedemptionTicket.sol`
- Create: `contracts/test/NostosRedemptionTicket.t.sol`

**Interfaces:**
- Consumes: OpenZeppelin `ERC721`, `IERC721`, `IERC721Receiver`, and Foundry test utilities.
- Produces: `INostosRedemptionTicket.vault()`, `mint(address,uint256)`, `burn(uint256)`, and `isAuthorized(address,uint256)` for `NostosAsyncVaultP4`.

- [ ] **Step 1: Write failing ticket tests.**

  Cover these exact behaviors in `NostosRedemptionTicket.t.sol`:

  ```solidity
  function test_ConstructorRejectsZeroVault() public;
  function test_OnlyVaultCanMint() public;
  function test_OnlyVaultCanBurn() public;
  function test_MintSetsOwnerAndSupportsApprovals() public;
  function test_TransferAndSafeTransferFollowERC721Rules() public;
  function test_IsAuthorizedRecognizesOwnerApprovalAndOperator() public;
  function test_SafeTransferToInvalidReceiverReverts() public;
  function test_SupportsERC721AndERC165() public;
  ```

  Use a test-only `MockVaultCaller` contract or `vm.prank(vault)` for vault authority. Use a receiver contract implementing `IERC721Receiver` and a non-receiver contract for safe-transfer checks. Assert standard `Transfer`, `Approval`, and `ApprovalForAll` behavior through inherited ERC721 methods.

- [ ] **Step 2: Run the focused tests and verify the expected failure.**

  Run from `contracts`:

  ```bash
  forge test --match-path test/NostosRedemptionTicket.t.sol
  ```

  Expected: compilation/test failure because the ticket interface and implementation do not exist yet.

- [ ] **Step 3: Add the ticket interface.**

  Define `INostosRedemptionTicket` with:

  ```solidity
  interface INostosRedemptionTicket {
      function vault() external view returns (address);
      function mint(address to, uint256 tokenId) external;
      function burn(uint256 tokenId) external;
      function isAuthorized(address spender, uint256 tokenId) external view returns (bool);
  }
  ```

- [ ] **Step 4: Implement the ticket contract.**

  Inherit `ERC721`, set the exact name/symbol `Nostos Redemption Claim Ticket` / `NOSTOS-CLAIM`, store `address public immutable vault`, and reject zero in the constructor.

  Add a custom `OnlyVault()` error and gate `mint`/`burn` with `msg.sender == vault`. Implement `mint` with `_safeMint(to, tokenId)` and `burn` with `_burn(tokenId)`. Implement `isAuthorized` by reading the current `ownerOf`, `getApproved`, and `isApprovedForAll` state. Do not add request/status/amount mappings.

- [ ] **Step 5: Run the focused tests and confirm green.**

  Run:

  ```bash
  forge test --match-path test/NostosRedemptionTicket.t.sol
  ```

  Expected: all ticket tests pass, including standard ERC721 transfer, approval, safe receiver, burn, and interface behavior.

- [ ] **Step 6: Leave the ticket changes uncommitted.**

  Verify `git status --short` shows only intended P4 work; do not run `git commit`.

## Task 2: Implement the Fresh P4 Vault

**Files:**
- Create: `contracts/src/NostosAsyncVaultP4.sol`
- Use: `contracts/src/interfaces/INostosRedemptionTicket.sol` with the exact signatures defined in Task 1.
- Create: `contracts/test/NostosAsyncVaultP4.t.sol`
- Read-only reference: `contracts/src/NostosAsyncVault.sol`, `contracts/test/NostosAsyncVault.t.sol`

**Interfaces:**
- Consumes: P3 request/accounting semantics and `INostosRedemptionTicket` from Task 1.
- Produces: P4 constructor, P3-compatible ERC4626/ERC7540-style methods, `configureRedemptionTicket(address)`, `redemptionTicket()`, and `claimRedeem(uint256,address)`.

- [ ] **Step 1: Write failing P4 tests before copying implementation.**

  Add test fixtures for MockUSDT, P4 vault, P4 ticket, admin, settler, Alice, Bob, Carol, stranger, valid ERC721 receiver, and invalid receiver. Cover at minimum:

  ```solidity
  function test_RequestRevertsBeforeTicketConfiguration() public;
  function test_ConfigurationBindsTicketOnce() public;
  function test_RequestMintsTicketWithRequestId() public;
  function test_RequestMintFailureRevertsShareLockAndRequest() public;
  function test_PendingTicketTransfersWithoutChangingRequest() public;
  function test_ClaimableTicketTransfersWithoutChangingSettlement() public;
  function test_AliceCannotClaimAfterTransferToBob() public;
  function test_CurrentTicketOwnerCanClaim() public;
  function test_ApprovedTicketOperatorCanClaim() public;
  function test_ERC721ApprovalForAllOperatorCanClaim() public;
  function test_ERC7540OperatorWithoutTicketApprovalCannotClaim() public;
  function test_UnauthorizedWalletCannotClaim() public;
  function test_ClaimBurnsTicketAndPreventsDoubleClaim() public;
  function test_ReservedLiquidityInvariantSurvivesTransferAndClaim() public;
  function test_MultiUserClaimsDoNotCrossRequests() public;
  function test_PauseDoesNotTrapClaimableRequest() public;
  function test_SafeTransferFromToReceiverWorks() public;
  function test_SafeTransferFromToInvalidReceiverReverts() public;
  function test_RequestToInvalidReceiverRevertsAtomically() public;
  function test_StandardClaimWrappersUseTicketAuthorization() public;
  function test_ClaimRedeemUsesExplicitRequestId() public;
  ```

  Each test must assert request status, `activeRequestId`, locked shares, ticket ownership, and `reservedClaimableAssets` where applicable. The transfer test must explicitly prove Alice's claim reverts and Bob's claim succeeds after settlement.

- [ ] **Step 2: Run the focused P4 tests and verify they fail for the missing contract.**

  Run:

  ```bash
  forge test --match-path test/NostosAsyncVaultP4.t.sol
  ```

  Expected: failure because `NostosAsyncVaultP4` does not exist.

- [ ] **Step 3: Create `NostosAsyncVaultP4` from the P3 lifecycle with explicit versioning.**

  Copy the P3 contract structure into the new file rather than changing `NostosAsyncVault.sol`. Preserve:

  - ERC20/ ERC4626 inheritance and verified asset constructor;
  - `RequestStatus`, `RedemptionRequest`, `requestController`, `requests`, `activeRequestId`, and `reservedClaimableAssets`;
  - P3 events and request/settlement behavior;
  - `SETTLER_ROLE`, `Pausable`, `ReentrancyGuard`, `AccessControl`, `SafeERC20`;
  - `share`, decimals, preview reverts, operator request behavior, and interface support.

  Add `address public redemptionTicket`, `RedemptionTicketConfigured` event, and custom errors or exact revert strings for missing/invalid/already-configured ticket.

- [ ] **Step 4: Implement one-time ticket configuration.**

  Implement:

  ```solidity
  function configureRedemptionTicket(address ticket) external onlyRole(DEFAULT_ADMIN_ROLE) {
      require(redemptionTicket == address(0), "NostosAsyncVaultP4: ticket configured");
      require(ticket != address(0), "NostosAsyncVaultP4: zero ticket");
      require(INostosRedemptionTicket(ticket).vault() == address(this), "NostosAsyncVaultP4: wrong ticket vault");
      redemptionTicket = ticket;
      emit RedemptionTicketConfigured(ticket);
  }
  ```

  Use the project’s established revert style consistently if custom errors are selected. Do not add an admin setter or upgrade hook.

- [ ] **Step 5: Override request creation with atomic ticket minting.**

  Require ticket configuration before any share transfer. Preserve P3 validation and active-request rules. Store the request using the same `controller` and original `owner` fields, then call `INostosRedemptionTicket(redemptionTicket).mint(controller, requestId)` under the request’s existing `nonReentrant` guard. Ensure `controller != address(0)` so the ticket cannot mint to zero.

  The call order must make any `_safeMint` receiver failure revert the entire request. Do not catch or swallow ticket mint errors.

- [ ] **Step 6: Implement dynamic ticket authorization and claim paths.**

  Add an internal `_requireTicketAuthorization(requestId)` that calls the ticket’s `isAuthorized(_msgSender(), requestId)`. Do not consult the stored request owner for claim authority.

  Implement `claimRedeem(requestId, receiver)` by resolving `requestController[requestId]`, checking Claimable/full claim, validating receiver, checking ticket authorization, and converging on one internal claim function.

  Keep `redeem` and `withdraw` signatures and controller-based request lookup. Replace P3’s claim-only `_requireOperator` authorization for P4 with ticket authorization. Retain ERC-7540 operator validation for request creation.

  Make `pendingRedeemRequest` and `claimableRedeemRequest` return current ticket ownership as the dynamic economic owner while retaining the stored original owner as request provenance/sender. If `ownerOf` is needed, call it only for an existing Pending/Claimable request before burn.

- [ ] **Step 7: Implement final claim effects and ticket burn.**

  In the shared claim implementation, preserve P3 full-only checks and CEI order. Decrease reservations, mark the request Claimed, clear the controller’s active request, burn locked shares, call ticket `burn(requestId)`, emit existing/new claim events, and SafeERC20-transfer assets. Keep claims available while paused and protect the full path with `nonReentrant`.

- [ ] **Step 8: Run the focused P4 tests and fix only contract defects.**

  Run:

  ```bash
  forge test --match-path test/NostosAsyncVaultP4.t.sol
  forge test --match-path test/NostosRedemptionTicket.t.sol
  ```

  Expected: all P4 lifecycle, transfer, approval, receiver, pause, multi-user, reserve, and double-claim tests pass. Do not modify the P3 contract to make these tests pass.

- [ ] **Step 9: Run all existing Foundry tests.**

  Run from `contracts`:

  ```bash
  forge test
  ```

  Expected: existing P3 and registry tests remain green in addition to the P4 tests.

## Task 3: Generate P4 Artifacts and Add Guarded Deployment Plans

**Files:**
- Modify: `scripts/registry/artifact.ts`
- Create: `scripts/registry/p4-plan.ts`
- Create: `scripts/registry/deploy-vault-p4.ts`
- Modify: `lib/chain/deployed-addresses.ts`
- Modify: `package.json`
- Create: `tests/unit/p4-plan.test.ts`
- Do not modify: `contracts/addresses/bot-testnet.json` with synthetic P4 values.

**Interfaces:**
- Consumes: Foundry artifacts for `NostosAsyncVaultP4` and `NostosRedemptionTicket`, `botTestnet`, `assertBotTestnetChain`, `getTestnetPrivateKey`, and existing script env loader.
- Produces: `P4_ENABLE_TESTNET_DEPLOY_ENV`, `P4DeployPlan`, optional `DeployedTestnetAddresses.p4`, `deploy:vault:p4:testnet`, and testable plan functions.

- [ ] **Step 1: Add failing plan tests.**

  In `tests/unit/p4-plan.test.ts`, assert:

  ```typescript
  buildP4DeployPlan({}).enabled === false
  buildP4DeployPlan({ P4_ENABLE_TESTNET_DEPLOY: "true" }).ok === false
  buildP4DeployPlan({ P4_ENABLE_TESTNET_DEPLOY: "true", BOT_TESTNET_PRIVATE_KEY: TEST_KEY }).chainId === 968
  buildP4DeployPlan(...).asset === BOT_TESTNET_SETTLEMENT_TOKEN.address
  buildP4RegistrationPlan(...).nostosVault === suppliedP4Address
  buildP4RegistrationPlan(...).metadataHash === metadataHashFor(updatedDemoVaultOpportunity)
  ```

  Add address-schema parsing tests that preserve top-level `asyncVault` and read nested `p4` independently.

- [ ] **Step 2: Run the plan tests and verify the expected failure.**

  Run:

  ```bash
  npx vitest run tests/unit/p4-plan.test.ts
  ```

  Expected: failure because the P4 plan module and nested address type do not yet exist.

- [ ] **Step 3: Generate artifacts and expose versioned exports.**

  Run from `contracts`:

  ```bash
  forge build
  ```

  Extend `scripts/registry/artifact.ts` with `p4VaultAbi`, `p4VaultBytecode`, `redemptionTicketAbi`, and `redemptionTicketBytecode` loaded from:

  ```text
  contracts/out/NostosAsyncVaultP4.sol/NostosAsyncVaultP4.json
  contracts/out/NostosRedemptionTicket.sol/NostosRedemptionTicket.json
  ```

  Leave existing `vaultAbi`, `vaultBytecode`, `registryAbi`, and `registryBytecode` exports unchanged.

- [ ] **Step 4: Add the P4 plan module.**

  Use `P4_ENABLE_TESTNET_DEPLOY = "P4_ENABLE_TESTNET_DEPLOY"`. The plan must fail closed unless the value is exactly `"true"`, require `BOT_TESTNET_PRIVATE_KEY`, require the verified Testnet USDT address, and return deployer address, chain ID `968`, and asset address.

  Add plan functions that accept an environment object and explicit P4 address inputs so tests never read or write real deployment files. Include a registration plan using the updated demo metadata and `REDEMPTION_SUPPORTED` status.

- [ ] **Step 5: Extend the address type without changing current JSON provenance.**

  Add an optional nested type:

  ```typescript
  type P4Deployment = {
    asyncVault?: string | null;
    asyncVaultTx?: string | null;
    asyncVaultBlock?: string | null;
    asyncVaultDeployedAt?: string | null;
    redemptionTicket?: string | null;
    redemptionTicketTx?: string | null;
    redemptionTicketBlock?: string | null;
    redemptionTicketDeployedAt?: string | null;
    configureTx?: string | null;
    configuredAt?: string | null;
  };
  ```

  Keep existing top-level P3 properties and make `p4?: P4Deployment` optional.

- [ ] **Step 6: Implement the guarded deployment sequence.**

  `deploy-vault-p4.ts` must:

  1. load script env;
  2. build the P4 plan and exit cleanly when opt-in is absent;
  3. read the existing address file without overwriting top-level P3 fields;
  4. chain-check the live RPC before any write;
  5. resume/verify an existing nested P4 vault record if present, otherwise deploy `NostosAsyncVaultP4(asset)`;
  6. persist the P4 vault receipt before the next write;
  7. resume/verify an existing ticket record if present, otherwise deploy `NostosRedemptionTicket(p4Vault)`;
  8. verify `ticket.vault() == p4Vault`;
  9. persist the ticket receipt;
  10. call `configureRedemptionTicket(ticket)` only if the vault read is zero;
  11. verify the configured address after confirmation;
  12. persist `configureTx` and timestamps;
  13. print addresses, transaction hashes, blocks, and explorer URLs.

  Persist through a safe read/merge/write helper so a P4 write cannot erase P3 history. Refuse ambiguous partial records rather than silently deploying over an existing address. No idempotent retry may send a second transaction when a confirmed receipt/address is already recorded.

- [ ] **Step 7: Add scripts and test disabled behavior.**

  Add to `package.json`:

  ```json
  "deploy:vault:p4:testnet": "tsx scripts/registry/deploy-vault-p4.ts"
  ```

  Run with no opt-in:

  ```bash
  npm run deploy:vault:p4:testnet
  ```

  Expected: `P4_ENABLE_TESTNET_DEPLOY=true is required` and no RPC write.

- [ ] **Step 8: Run plan tests and typecheck the scripts.**

  Run:

  ```bash
  npx vitest run tests/unit/p4-plan.test.ts
  npx tsc --noEmit
  ```

  Expected: plan tests pass and TypeScript reports no errors.

## Task 4: Add P4 Registry and Settlement Tooling

**Files:**
- Create: `scripts/registry/register-vault-p4.ts`
- Create: `scripts/registry/settle-p4.ts`
- Modify: `scripts/registry/p4-plan.ts`
- Modify: `lib/contracts/nostos-async-vault-p4-abi.ts` so the frontend and guarded CLI share the exact P4 vault ABI.
- Modify: `package.json`
- Extend: `tests/unit/p4-plan.test.ts`

**Interfaces:**
- Consumes: nested `addresses.p4`, P4 metadata hash, `registryAbi`, P4 vault ABI, ticket ABI, and existing chain/key guards.
- Produces: `register:vault:p4:testnet` and `settle:request:p4:testnet -- <requestId>`.

- [ ] **Step 1: Add failing registration/settlement plan assertions.**

  Assert that registration refuses when nested P4 vault or registry data is absent, uses the P4 vault address when present, and keeps status `REDEMPTION_SUPPORTED`. Assert that settlement reporting includes the ticket address and current owner read target.

- [ ] **Step 2: Implement guarded P4 registration.**

  Read the existing registry address and nested P4 vault address. Build the updated demo metadata hash. Refuse without `P4_ENABLE_TESTNET_DEPLOY=true`, private key, registry address, or P4 address. Chain-check `968`, then use the existing register/update pattern without touching P3 address fields. Print registry, P4 vault, metadata hash, status, transaction, and explorer URL.

- [ ] **Step 3: Implement guarded P4 settlement.**

  Select nested `p4.asyncVault` and `p4.redemptionTicket`; refuse if either is absent. Preserve P3 request/status/liquidity checks exactly. Before a write, read `ownerOf(requestId)` and print it. If the ticket is already burned, refuse with a clear message. Only write `settleRequest(requestId)` after Pending status and sufficient unreserved liquidity are confirmed.

- [ ] **Step 4: Add package scripts and safe no-opt-in checks.**

  Add:

  ```json
  "register:vault:p4:testnet": "tsx scripts/registry/register-vault-p4.ts",
  "settle:request:p4:testnet": "tsx scripts/registry/settle-p4.ts"
  ```

  Run both without opt-in and verify they disable/refuse before any write. Do not run them with opt-in.

- [ ] **Step 5: Run targeted TypeScript tests.**

  Run:

  ```bash
  npx vitest run tests/unit/p4-plan.test.ts
  npx tsc --noEmit
  ```

  Expected: all P4 plan/tooling tests and typecheck pass.

## Task 5: Add P4 ABIs and Truthful Metadata

**Files:**
- Create: `lib/contracts/nostos-async-vault-p4-abi.ts`
- Create: `lib/contracts/nostos-redemption-ticket-abi.ts`
- Modify: `lib/rwa/opportunities/demo-vault.ts`
- Modify: `tests/unit/rwa-opportunities.test.ts`
- Do not modify: `tests/unit/rwa-metadata.test.ts`; keep its existing OUSG/TBILL hash-anchor coverage unchanged.

**Interfaces:**
- Consumes: P4 Solidity public methods and existing `RwaOpportunity` metadata shape.
- Produces: exact ABI definitions for hooks/panel and updated demo snapshot hash.

- [ ] **Step 1: Add metadata regression assertions before editing copy.**

  Add tests asserting the demo metadata contains asynchronous redemption and transferable claim ticket language, `0% yield`, no RWA backing, BOT Testnet `968`, and `REDEMPTION_SUPPORTED`. Assert OUSG/TBILL remain `DISCOVERY_ONLY` and their metadata hashes do not change.

- [ ] **Step 2: Update only the demo-vault metadata.**

  Keep issuer, symbol, 0% yield, Testnet USDT, no RWA backing, and settlement facts. Update settlement redemption/processing descriptions to explain that a successful request mints a transferable ERC-721 redemption claim ticket and that ticket ownership controls the eventual claim. Do not add APY, TVL, NAV, liquidity, or investment language.

- [ ] **Step 3: Define exact P4 vault ABI.**

  Include P3 reads/writes plus:

  ```text
  redemptionTicket() view returns (address)
  configureRedemptionTicket(address)
  claimRedeem(uint256 requestId, address receiver) returns (uint256)
  nextRequestId() view returns (uint256)
  requestController(uint256) view returns (address)
  requests(uint256,address) view returns (...)
  reservedClaimableAssets() view returns (uint256)
  ```

  Include deposit, requestRedeem, settleRequest, redeem, withdraw, balanceOf, totalAssets, decimals, activeRequestId, and asset reads.

- [ ] **Step 4: Define exact ticket ABI.**

  Include `vault`, `ownerOf`, `getApproved`, `isApprovedForAll`, `isAuthorized`, `safeTransferFrom(address,address,uint256)`, `approve`, `setApprovalForAll`, `balanceOf`, and ERC721 metadata/interface reads required by the UI.

- [ ] **Step 5: Run metadata and unit tests.**

  Run:

  ```bash
  npm test -- tests/unit/rwa-opportunities.test.ts tests/unit/rwa-metadata.test.ts
  ```

  Expected: demo metadata assertions pass; OUSG/TBILL status and hashes remain correct.

## Task 6: Implement Ticket-Aware Frontend Reads and UI

**Files:**
- Create: `lib/chain/ticketed-vault-hooks.ts`
- Create: `components/product/ticketed-demo-vault-panel.tsx`
- Modify: `lib/chain/deployed-addresses.ts` to support the guarded test-only P4 fixture environment.
- Modify: `app/(product)/vaults/[address]/page.tsx`
- Read: `DESIGN.md`, existing `DemoVaultPanel`, `product-primitives`, `Input`, `Button`.

**Interfaces:**
- Consumes: nested P4 addresses, P4/ticket ABIs, `FRONTEND_POLICY`, `useBotNetwork`, existing P3 transaction-stage conventions.
- Produces: live P4 state and ticket transfer/claim controls without changing the P3 panel implementation.

- [ ] **Step 1: Load UI-specific skill context before editing.**

  Invoke `ui-skills-root` before UI work and use the governing `DESIGN.md`. Invoke `fixing-accessibility` because the task adds an address input and transfer control. Preserve existing visual language, touch targets, labels, focus, and error semantics.

- [ ] **Step 2: Add failing hook/panel-facing tests or fixture assertions.**

  Add unit-level assertions for address selection and authorization-derived state where practical. Add E2E assertions for the truthful no-P4 fallback before enabling the test fixture. The production panel must not report a ticket or claim status when nested P4 addresses are absent.

- [ ] **Step 3: Implement `ticketed-vault-hooks.ts`.**

  Read only when connected on BOT Testnet `968` and both P4 addresses exist. Return typed state for vault totals, reserved assets, active controller request, selected/owned ticket IDs, ticket owner, approvals, and `canClaim`.

  Use `useReadContracts` for `ownerOf` over IDs `1` through `nextRequestId - 1`, filter successful results matching the connected address, then read each owned request’s controller and request tuple. Treat burned token reads as absent, not as zero-value claims. Refetch all vault/ticket reads after confirmed transfer, deposit, request, or claim.

  `canClaim` must be derived from `ownerOf`, `getApproved`, and `isApprovedForAll`; it must not be derived from the connected wallet’s local history.

- [ ] **Step 4: Implement `ticketed-demo-vault-panel.tsx`.**

  Preserve the existing P3 deposit/request flow shape, but use P4 ABI/address reads. Add:

  - `REDEMPTION CLAIM` section;
  - Ticket number, request number, Pending/Claimable/Claimed state, current owner;
  - owned-ticket selection/list based on live reads;
  - recipient input with EVM address validation and accessible error text;
  - `Transfer claim` button calling `safeTransferFrom(owner, recipient, ticketId)`;
  - `Claim` button calling `claimRedeem(ticketId, connectedAddress)` only when `canClaim` and Claimable;
  - transaction stage output matching existing P3 stages and BOT Scan links;
  - exact explanatory copy about transferring the settlement right.

  Keep transfer enabled for Pending and Claimable. Hide/disable Claim when the connected wallet is neither current owner nor approved operator. After confirmation, refetch and show the new owner.

- [ ] **Step 5: Select P4 only from complete persisted deployment data.**

  In the vault route, render `TicketedDemoVaultPanel` only when both `deployedTestnet.p4.asyncVault` and `deployedTestnet.p4.redemptionTicket` are present. Otherwise render the existing `DemoVaultPanel` exactly as before. Do not fall back from a missing P4 record to a fake P4 address or claim state.

- [ ] **Step 6: Verify frontend behavior locally.**

  Run:

  ```bash
  npx tsc --noEmit
  npm run lint
  ```

  Expected: no type, lint, or accessibility-related build errors. Inspect the route manually only through local reads; do not connect to a real wallet or send a transaction as part of this task.

## Task 7: Add Isolated P4 E2E Fixture Coverage

**Files:**
- Create: `tests/e2e/p4-rpc-fixture.ts`
- Modify: `tests/e2e/nostos.spec.ts`
- Modify: `playwright.config.ts` to pass a test-only P4 fixture configuration to the Next web server.
- Modify: `lib/chain/deployed-addresses.ts` to parse that fixture only when `NODE_ENV !== "production"`.

**Interfaces:**
- Consumes: ticket-aware panel selectors, transaction-stage test IDs, and the existing injected-provider E2E setup.
- Produces: deterministic UI-mechanics coverage without adding fake P4 addresses to persisted deployment history or production configuration.

- [ ] **Step 1: Define fixture boundaries.**

  Add this exact `webServer.env` value in `playwright.config.ts`:

  ```typescript
  NEXT_PUBLIC_NOSTOS_E2E_P4_FIXTURE: JSON.stringify({
    asyncVault: "0x0000000000000000000000000000000000000101",
    redemptionTicket: "0x0000000000000000000000000000000000000202",
  })
  ```

  In `lib/chain/deployed-addresses.ts`, parse this value only when
  `process.env.NODE_ENV !== "production"`; production builds must ignore it and
  use only persisted `contracts/addresses/bot-testnet.json` data. Use the
  fixture addresses in `tests/e2e/p4-rpc-fixture.ts` to intercept
  `https://rpc.bohr.life` requests. The fixture must return only the contract
  reads needed by the panel: chain ID `968`, `nextRequestId`,
  request/controller tuples, ticket `ownerOf`, approvals, `isAuthorized`, and
  deterministic receipt results for mocked transfer/claim mechanics.

  Keep fixture activation explicitly guarded by a test-only environment value and `NODE_ENV !== "production"`. Do not add fixture values to `contracts/addresses/bot-testnet.json`, `.env.example`, or client production defaults.

- [ ] **Step 2: Add failing E2E assertions.**

  Add tests that:

  ```text
  render Ticket #7, Request #7, Pending, and current owner;
  reject an invalid transfer recipient without a wallet write;
  show REVIEW/SIGN/SUBMITTED/CONFIRMING/CONFIRMED transfer stages;
  refresh current owner after a mocked confirmed transfer;
  hide Claim for the previous owner after transfer;
  show Claim for the new owner when Claimable;
  show FAILED when the mocked wallet rejects;
  ```

  Assert no fabricated APY/TVL/liquidity text is introduced.

- [ ] **Step 3: Run the focused E2E test and verify the expected fixture failure.**

  Run:

  ```bash
  npx playwright test tests/e2e/nostos.spec.ts -g "ticket|claim|transfer"
  ```

  Expected: failure until the isolated P4 fixture and panel are implemented.

- [ ] **Step 4: Implement fixture-backed mechanics and run green.**

  Ensure the test never requires a real wallet extension, private key, BOT Testnet write, or actual settlement. Keep existing no-provider, unsupported-chain, P3 fallback, and responsive E2E tests intact.

- [ ] **Step 5: Run the complete E2E suite.**

  Run:

  ```bash
  npm run test:e2e
  ```

  Expected: existing route/UI tests plus P4 ticket UI tests pass.

## Task 8: Full Verification and Handoff

**Files:**
- Modify: `.agent-state/left-off.md`
- Do not modify product or deployment address files during verification.

- [ ] **Step 1: Generate fresh Solidity artifacts.**

  Run from `contracts`:

  ```bash
  forge build
  ```

  Confirm P4 artifact files exist and P3 artifacts remain present.

- [ ] **Step 2: Run all application gates.**

  Run from the repository root:

  ```bash
  npm test
  npx tsc --noEmit
  npm run lint
  npm run build
  npm run test:e2e
  ```

  Record exact passing test counts and any non-failing existing warnings. Do not claim completion if any command exits nonzero.

- [ ] **Step 3: Run all Foundry tests.**

  Run:

  ```bash
  cd contracts
  forge test
  cd ..
  ```

  Confirm both existing P3 suites and all P4 suites pass.

- [ ] **Step 4: Verify no writes occurred.**

  Confirm no deployment/registration/settlement command was run with P4 opt-in, no address JSON gained a P4 value, and no transaction hash was created during this task.

- [ ] **Step 5: Review the final diff.**

  Run:

  ```bash
  git status --short
  git diff --check
  git diff --stat
  ```

  Confirm only intended P4 source, tests, tooling, UI, metadata, spec/plan, and state files are present. Do not stage or commit anything.

- [ ] **Step 6: Update agent state.**

  Record:

  - exact P4 architecture and claim API;
  - P3 address/source preservation;
  - files changed;
  - tests and counts;
  - guarded commands prepared but not executed;
  - absence of deployment/registry/USDT writes;
  - remaining P5 limitations;
  - one concrete next action: explicit authorization for a future P4 Testnet deployment.

## Plan Self-Review

- Contract architecture is isolated in new P4 sources and does not require changing the P3 deployment.
- Ticket ownership, transfer, approval, mint, burn, receiver, and claim authorization requirements map to Tasks 1 and 2.
- Request, settlement, reserved-liquidity, pause, multi-user, and double-claim invariants map to Task 2.
- P3/P4 address provenance, guarded chain-968 deployment, stale-RPC checks, and no-write constraints map to Tasks 3, 4, and 8.
- Metadata and OUSG/TBILL preservation map to Task 5.
- Live frontend ownership, transfer, claim, transaction stages, fallback, and wrong-network policy map to Task 6.
- E2E ticket mechanics and no-fabricated-financial-values map to Task 7.
- Full npm/typecheck/lint/build/E2E/Foundry gates map to Task 8.
- No unresolved `TODO`, `TBD`, alternative, commit, deployment, or P5 step is included.
- All cross-task names are consistent: `NostosAsyncVaultP4`, `NostosRedemptionTicket`, `INostosRedemptionTicket`, `claimRedeem`, `P4_ENABLE_TESTNET_DEPLOY`, nested `addresses.p4`, and the three P4 npm scripts.
