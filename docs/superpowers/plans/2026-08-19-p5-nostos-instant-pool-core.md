# P5 — Nostos InstantPool Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a protocol-owned `NostosInstantPool` that buys PENDING P4 redemption tickets at a deterministic basis-point discount, paying the seller real USDT immediately, and harvests the full settlement when the underlying request becomes CLAIMABLE.

**Architecture:** New non-upgradeable `NostosInstantPool.sol` with immutable bindings to verified Testnet USDT, the deployed P4 `NostosAsyncVaultP4`, and `NostosRedemptionTicket`. Deterministic quote engine, atomic `sellTicket(ticketId, minAmountOut)`, permissionless `harvest(ticketId)`, real-balance accounting, AccessControl roles + Pausable. Guarded testnet deploy/fund/harvest tooling behind `P5_ENABLE_TESTNET_DEPLOY=true`. Frontend wires the existing `/pool` route with real reads.

**Tech Stack:** Solidity 0.8.24 + Forge 1.7.1 (OZ 5.3.0), viem 2, wagmi 3, Next.js 16.3.1, Vitest 4, Playwright.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-08-19-p5-nostos-instant-pool-core-design.md`
- Chain must be BOT Testnet 968. Testnet key = `BOT_TESTNET_PRIVATE_KEY` only.
- Verified Testnet USDT = `0x75edC9335175Fc0552D51D48439F229c10420fe3`.
- P4 vault/ticket come ONLY from persisted `contracts/addresses/bot-testnet.json` `p4.asyncVault` / `p4.redemptionTicket`.
- **DO NOT commit anything.** The working tree stays uncommitted throughout.
- **DO NOT deploy, fund, harvest, or send any transaction.** Commands run without opt-in must fail closed.
- Do NOT modify `contracts/src/NostosAsyncVault.sol`, `contracts/src/NostosRedemptionTicket.sol`, P3/P4 tests, or P3/P4 address records.
- Do NOT add LP shares / ERC-4626 / P6 / RFQ / oracles / fake ETA.
- All tests use the local Forge binary `C:/Users/USER/.foundry/bin/forge.exe` (forge is not on PATH).
- P4 `ticketId == requestId`. P4 request status enum: `None=0, Pending=1, Claimable=2, Claimed=3`.
- Face value of a PENDING request = `vault.sharesToAssets(vault.requests(ticketId, controller).shares)`. Never use `assetsClaimable` (0 while PENDING).
- Pricing defaults: `baseDiscountBps=100, utilizationSlopeBps=1000, sizeSlopeBps=500, minDiscountBps=0, maxDiscountBps=3000, maxUtilizationBps=9000`.
- Quote formula (basis points, integer math):
  - `liquidAssets = asset.balanceOf(pool)`; `outstanding = outstandingFaceValue`
  - `utilizationBps = outstanding*10000/(liquid+outstanding)` (0 if denom 0)
  - `sizeRatioBps = liquid==0 ? 10000 : faceValue*10000/liquid`
  - `utilizationAdjust = utilizationBps*utilizationSlopeBps/10000`
  - `sizeAdjust = min(sizeRatioBps,10000)*sizeSlopeBps/10000`
  - `rawDiscount = baseDiscountBps + utilizationAdjust + sizeAdjust`
  - `discountBps = clamp(rawDiscount, minDiscountBps, maxDiscountBps)`
  - `amountOut = faceValue*(10000-discountBps)/10000`
  - `cashAfter = amountOut>=liquid ? 0 : liquid-amountOut`; `faceAfter = outstanding+faceValue`
  - `postTradeUtilizationBps = faceAfter*10000/(cashAfter+faceAfter)`
- `quoteTicket` reverts `"InstantPool: no liquid assets"` when `liquid+outstanding == 0`.
- Roles: `DEFAULT_ADMIN_ROLE` (pricing + withdrawal), `MANAGER_ROLE` (funding), `PAUSER_ROLE` (pause). Deployer gets all three.

---

### Task 1: `NostosInstantPool` contract (TDD)

**Files:**
- Create: `contracts/src/NostosInstantPool.sol`
- Create: `contracts/test/NostosInstantPool.t.sol`
- Test: run with `"C:/Users/USER/.foundry/bin/forge.exe" test --root contracts --match-path test/NostosInstantPool.t.sol -vv`

**Interfaces:**
- Consumes: `NostosAsyncVaultP4` (public `requests(uint256,address)`, `requestController(uint256)`, `sharesToAssets(uint256)`, `claimRedeem(uint256,address)`, `redemptionTicket()`), `NostosRedemptionTicket`/`INostosRedemptionTicket` (`vault()`, `ownerOf`, `isAuthorized`, `safeTransferFrom`), OZ 5.3 `IERC20`, `SafeERC20`, `IERC721Receiver`, `AccessControl`, `Pausable`, `ReentrancyGuard`.
- Produces: `NostosInstantPool` with API used by Tasks 2-4:
  - `constructor(IERC20 asset_, NostosAsyncVaultP4 vault_, NostosRedemptionTicket ticket_)`
  - `quoteTicket(uint256 ticketId) external view returns (Quote memory)` — `Quote{uint256 faceValue; uint256 amountOut; uint256 discountBps; uint256 utilizationBps; uint256 sizeRatioBps; uint256 postTradeUtilizationBps;}`
  - `sellTicket(uint256 ticketId, uint256 minAmountOut) external nonReentrant whenNotPaused returns (uint256 amountOut)`
  - `harvest(uint256 ticketId) external nonReentrant returns (uint256 assets)`
  - `fund(uint256 amount) external onlyRole(MANAGER_ROLE)`
  - `withdrawLiquidity(uint256 amount) external onlyRole(DEFAULT_ADMIN_ROLE)`
  - `setPricing(uint256 baseDiscountBps, uint256 utilizationSlopeBps, uint256 sizeSlopeBps, uint256 minDiscountBps, uint256 maxDiscountBps, uint256 maxUtilizationBps) external onlyRole(DEFAULT_ADMIN_ROLE)`
  - `pause()/unpause()` — `onlyRole(PAUSER_ROLE)`
  - views: `liquidAssets()`, `utilizationBps()`, `outstandingFaceValue()`, `outstandingCostBasis()`, `realizedSpread()`, `getPricing()`, `positionCount()`, `positions(uint256)`, `onERC721Received(...)`.
  - Roles constants `MANAGER_ROLE`, `PAUSER_ROLE`.
  - Events `LiquidityFunded(address indexed funder, uint256 amount)`, `LiquidityWithdrawn(address indexed withdrawer, uint256 amount)`, `PricingUpdated(uint256 baseDiscountBps, uint256 utilizationSlopeBps, uint256 sizeSlopeBps, uint256 minDiscountBps, uint256 maxDiscountBps, uint256 maxUtilizationBps)`, `InstantPurchased(uint256 indexed ticketId, uint256 indexed requestId, address indexed seller, uint256 faceValue, uint256 amountOut, uint256 discountBps)`, `TicketHarvested(uint256 indexed ticketId, uint256 indexed requestId, uint256 faceValue, uint256 costBasis, uint256 spread)`.

- [ ] **Step 1: Write the failing test file** `contracts/test/NostosInstantPool.t.sol` (red):

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC721Receiver} from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import {NostosAsyncVaultP4} from "../src/NostosAsyncVaultP4.sol";
import {NostosRedemptionTicket} from "../src/NostosRedemptionTicket.sol";
import {NostosInstantPool} from "../src/NostosInstantPool.sol";

contract P5MockUSDT is ERC20 {
    constructor() ERC20("Tether USD", "USDT") {}
    function mint(address to, uint256 amount) external { _mint(to, amount); }
    function decimals() public pure override returns (uint8) { return 6; }
}

contract P5InvalidReceiver {}

contract NostosInstantPoolTest is Test {
    uint256 internal constant DEPOSIT = 5_000e6;
    uint256 internal constant FUNDING = 1_000e6;
    uint256 internal constant TEN_THOUSAND = 10_000;

    P5MockUSDT internal usdt;
    NostosAsyncVaultP4 internal vault;
    NostosRedemptionTicket internal ticket;
    NostosInstantPool internal pool;

    address internal admin = address(0xaD00);
    address internal manager = address(0x4A6E);
    address internal settler = address(0x5E77);
    address internal alice = address(0xa11ce);
    address internal bob = address(0xb0b);
    address internal keeper = address(0xbeEf);

    struct RequestData {
        uint256 id; address reqController; address owner; uint256 shares;
        uint256 assetsClaimable; uint64 requestedAt; uint64 claimableAt;
        uint64 claimedAt; uint8 status;
    }

    function setUp() public {
        usdt = new P5MockUSDT();
        vm.startPrank(admin);
        vault = new NostosAsyncVaultP4(IERC20(address(usdt)));
        vault.grantRole(vault.SETTLER_ROLE(), settler);
        ticket = new NostosRedemptionTicket(address(vault));
        vault.configureRedemptionTicket(address(ticket));
        pool = new NostosInstantPool(IERC20(address(usdt)), vault, ticket);
        pool.grantRole(pool.MANAGER_ROLE(), manager);
        pool.grantRole(pool.PAUSER_ROLE(), manager);
        vm.stopPrank();
        usdt.mint(alice, 1_000_000e6);
        usdt.mint(bob, 1_000_000e6);
        usdt.mint(manager, 1_000_000e6);
    }

    // ---- constructor / roles ----

    function test_ConstructorRejectsZeroOrMisboundIntegrations() public {
        vm.prank(admin);
        vm.expectRevert();
        new NostosInstantPool(IERC20(address(usdt)), vault, NostosRedemptionTicket(address(0)));

        NostosRedemptionTicket wrongTicket = new NostosRedemptionTicket(address(0xBEEF));
        vm.prank(admin);
        vm.expectRevert(bytes("InstantPool: ticket not bound to vault"));
        new NostosInstantPool(IERC20(address(usdt)), vault, wrongTicket);
    }

    function test_OnlyAdminCanSetPricing() public {
        vm.prank(bob);
        vm.expectRevert();
        pool.setPricing(200, 500, 500, 0, 3_000, 9_000);
    }

    function test_OnlyManagerCanFund() public {
        usdt.mint(bob, FUNDING);
        vm.startPrank(bob);
        usdt.approve(address(pool), FUNDING);
        vm.expectRevert();
        pool.fund(FUNDING);
        vm.stopPrank();
    }

    // ---- funding / withdrawal ----

    function test_FundingUsesRealERC20Accounting() public {
        assertEq(pool.liquidAssets(), 0);
        vm.startPrank(manager);
        usdt.approve(address(pool), FUNDING);
        vm.expectEmit(true, true, false, true, address(pool));
        emit NostosInstantPool.LiquidityFunded(manager, FUNDING);
        pool.fund(FUNDING);
        vm.stopPrank();
        assertEq(pool.liquidAssets(), FUNDING);
        assertEq(usdt.balanceOf(address(pool)), FUNDING);
    }

    function test_WithdrawalBlockedWhileExposureExists() public {
        _fundAndCreatePendingRequest();
        vm.prank(admin);
        vm.expectRevert(bytes("InstantPool: exposure outstanding"));
        pool.withdrawLiquidity(FUNDING);
    }

    function test_WithdrawalAllowedWhenNoExposure() public {
        vm.startPrank(manager);
        usdt.approve(address(pool), FUNDING);
        pool.fund(FUNDING);
        vm.stopPrank();
        vm.prank(admin);
        pool.withdrawLiquidity(FUNDING);
        assertEq(usdt.balanceOf(admin), FUNDING);
        assertEq(pool.liquidAssets(), 0);
    }

    // ---- quotes ----

    function test_QuoteBaseCase() public view {
        uint256 face = 100e6;
        uint256 liquid = 1_000e6;
        NostosInstantPool.Quote memory q = _quoteFor(face, liquid, 0);
        // base=100, sizeSlope=500: sizeRatio = 100e6*10000/1000e6 = 1000; sizeAdj=50; raw=150
        assertEq(q.discountBps, 150);
        assertEq(q.amountOut, face * (TEN_THOUSAND - 150) / TEN_THOUSAND);
    }

    function test_UtilizationIncreasesDiscount() public {
        uint256 requestId = _fundAndBuyTicket(alice);
        uint256 firstDiscount = pool.positions(requestId).discountBps;
        NostosInstantPool.Quote memory second = _quoteFor(200e6, pool.liquidAssets(), 200e6);
        assertGt(second.discountBps, firstDiscount, "utilization must increase discount");
    }

    function test_LargerSizeIncreasesDiscount() public view {
        uint256 small = _quoteFor(50e6, 1_000e6, 0);
        uint256 large = _quoteFor(200e6, 1_000e6, 0);
        assertGt(large.discountBps, small.discountBps, "larger size must increase discount");
    }

    function test_DiscountClampedByMinAndMax() public {
        vm.prank(admin);
        pool.setPricing(100, 1_000, 500, 10, 20, 9_000);
        uint256 face = 500e6;
        uint256 liquid = 10e6;
        NostosInstantPool.Quote memory q = _quoteFor(face, liquid, 0);
        assertEq(q.discountBps, 20, "must clamp to maxDiscountBps");
        vm.prank(admin);
        pool.setPricing(100, 1_000, 500, 4_000, 8_000, 9_000);
        NostosInstantPool.Quote memory q2 = _quoteFor(10e6, 1_000e6, 0);
        assertEq(q2.discountBps, 4_000, "must clamp to minDiscountBps");
    }

    function test_ZeroLiquidityRevertsQuote() public {
        _requestFor(alice, 200e6);
        vm.expectRevert(bytes("InstantPool: no liquid assets"));
        pool.quoteTicket(1);
    }

    function test_InsufficientLiquidityRevertsSell() public {
        vm.startPrank(manager);
        usdt.approve(address(pool), 10e6);
        pool.fund(10e6);
        vm.stopPrank();
        uint256 requestId = _requestFor(alice, DEPOSIT);
        vm.prank(alice);
        ticket.approve(address(pool), requestId);
        vm.prank(alice);
        vm.expectRevert(bytes("InstantPool: insufficient liquidity"));
        pool.sellTicket(requestId, 0);
    }

    function test_MaxPostTradeUtilizationRejected() public {
        vm.prank(admin);
        pool.setPricing(100, 1_000, 500, 0, 100, 5_000);
        vm.startPrank(manager);
        usdt.approve(address(pool), 100e6);
        pool.fund(100e6);
        vm.stopPrank();
        uint256 requestId = _requestFor(alice, 90e6);
        vm.prank(alice);
        ticket.approve(address(pool), requestId);
        vm.prank(alice);
        vm.expectRevert(bytes("InstantPool: utilization cap"));
        pool.sellTicket(requestId, 0);
    }

    // ---- eligibility ----

    function test_OnlyPendingTicketEligible() public {
        _fundAndCreatePendingRequest();
        // CLAIMED request (claim normally first via a fresh request)
        uint256 claimedId = _requestFor(bob, 100e6);
        _settle(claimedId);
        vm.prank(bob);
        vault.claimRedeem(claimedId, bob);
        vm.expectRevert();
        pool.quoteTicket(claimedId);
    }

    function test_ClaimableTicketRejected() public {
        _fundAndCreatePendingRequest();
        uint256 claimableId = _requestFor(bob, 100e6);
        _settle(claimableId);
        vm.expectRevert(bytes("InstantPool: request not pending"));
        pool.quoteTicket(claimableId);
    }

    function test_NonexistentTicketRejected() public {
        _fundAndCreatePendingRequest();
        vm.expectRevert();
        pool.quoteTicket(999);
    }

    function test_TicketAlreadyOwnedByPoolRejected() public {
        uint256 requestId = _fundAndBuyTicket(alice);
        vm.expectRevert(bytes("InstantPool: ticket already owned by pool"));
        pool.quoteTicket(requestId);
    }

    // ---- purchase mechanics ----

    function test_MinAmountOutProtection() public {
        _fundAndCreatePendingRequest();
        vm.prank(alice);
        ticket.approve(address(pool), 1);
        vm.prank(alice);
        vm.expectRevert(bytes("InstantPool: slippage"));
        pool.sellTicket(1, type(uint256).max);
    }

    function test_SellerMustOwnTicket() public {
        _fundAndCreatePendingRequest();
        vm.prank(bob);
        vm.expectRevert();
        pool.sellTicket(1, 0);
    }

    function test_MissingApprovalFailsAtomically() public {
        uint256 liquidBefore = pool.liquidAssets();
        uint256 outstandingBefore = pool.outstandingFaceValue();
        vm.prank(alice);
        vm.expectRevert();
        pool.sellTicket(1, 0);
        assertEq(pool.liquidAssets(), liquidBefore, "no USDT moved");
        assertEq(pool.outstandingFaceValue(), outstandingBefore, "no exposure");
        assertEq(ticket.ownerOf(1), alice, "ticket stays with seller");
    }

    function test_PurchaseTransfersTicketAndUSDTAtomically() public {
        uint256 requestId = _fundAndCreatePendingRequest();
        uint256 aliceBalanceBefore = usdt.balanceOf(alice);
        vm.prank(alice);
        ticket.approve(address(pool), requestId);
        vm.prank(alice);
        uint256 amountOut = pool.sellTicket(requestId, 0);
        assertTrue(amountOut > 0, "seller receives USDT");
        assertEq(usdt.balanceOf(alice), aliceBalanceBefore + amountOut);
        assertEq(ticket.ownerOf(requestId), address(pool));
        assertEq(pool.positions(requestId).seller, alice);
        assertEq(pool.positions(requestId).status, NostosInstantPool.Status.Active);
        assertEq(pool.outstandingFaceValue(), 200e6);
        assertEq(pool.outstandingCostBasis(), amountOut);
        assertEq(pool.liquidAssets(), FUNDING - amountOut);
    }

    function test_UnsolicitedSafeTransferFromRejected() public {
        _fundAndCreatePendingRequest();
        vm.startPrank(alice);
        ticket.approve(address(pool), 1);
        vm.expectRevert(bytes("InstantPool: unsolicited ticket"));
        ticket.safeTransferFrom(alice, address(pool), 1);
        vm.stopPrank();
        assertEq(ticket.ownerOf(1), alice, "ticket not stranded");
        assertEq(pool.outstandingFaceValue(), 0, "no exposure recorded");
    }

    function test_DiscountNotRealizedBeforeSettlement() public {
        uint256 requestId = _fundAndBuyTicket(alice);
        assertEq(pool.realizedSpread(), 0, "discount not realized yet");
        assertGt(pool.positions(requestId).faceValue, pool.positions(requestId).costBasis);
    }

    function test_SellerCannotClaimAfterSale() public {
        uint256 requestId = _fundAndBuyTicket(alice);
        _settle(requestId);
        vm.prank(alice);
        vm.expectRevert();
        vault.claimRedeem(requestId, alice);
    }

    // ---- harvest ----

    function test_HarvestBeforeClaimableReverts() public {
        uint256 requestId = _fundAndBuyTicket(alice);
        vm.prank(keeper);
        vm.expectRevert(bytes("InstantPool: not claimable"));
        pool.harvest(requestId);
    }

    function test_PermissionlessHarvestSucceedsOnceClaimable() public {
        uint256 requestId = _fundAndBuyTicket(alice);
        _settle(requestId);
        uint256 poolBalanceBefore = usdt.balanceOf(address(pool));
        vm.prank(keeper);
        uint256 assets = pool.harvest(requestId);
        assertEq(assets, 200e6, "pool receives full face value");
        assertEq(usdt.balanceOf(address(pool)), poolBalanceBefore + 200e6);
    }

    function test_HarvestPayoutCannotGoToCaller() public {
        uint256 requestId = _fundAndBuyTicket(alice);
        _settle(requestId);
        uint256 keeperBefore = usdt.balanceOf(keeper);
        vm.prank(keeper);
        pool.harvest(requestId);
        assertEq(usdt.balanceOf(keeper), keeperBefore, "keeper never receives settlement");
    }

    function test_TicketBurnsThroughP4Claim() public {
        uint256 requestId = _fundAndBuyTicket(alice);
        _settle(requestId);
        vm.prank(keeper);
        pool.harvest(requestId);
        vm.expectRevert();
        ticket.ownerOf(requestId);
    }

    function test_RealizedSpreadExact() public {
        uint256 requestId = _fundAndBuyTicket(alice);
        uint256 cost = pool.positions(requestId).costBasis;
        _settle(requestId);
        vm.prank(keeper);
        pool.harvest(requestId);
        assertEq(pool.realizedSpread(), 200e6 - cost);
        assertEq(pool.outstandingFaceValue(), 0);
        assertEq(pool.outstandingCostBasis(), 0);
        assertEq(pool.positions(requestId).status, NostosInstantPool.Status.Settled);
    }

    function test_NoDoubleHarvest() public {
        uint256 requestId = _fundAndBuyTicket(alice);
        _settle(requestId);
        vm.prank(keeper);
        pool.harvest(requestId);
        vm.prank(keeper);
        vm.expectRevert(bytes("InstantPool: no active position"));
        pool.harvest(requestId);
    }

    function test_MultiplePositionsRemainIsolated() public {
        uint256 reqA = _fundAndBuyTicket(alice);
        // bob deposits, requests, sells a different ticket
        _depositInto(bob, 100e6);
        vm.prank(bob);
        uint256 reqB = vault.requestRedeem(100e6, bob, bob);
        vm.prank(bob);
        ticket.approve(address(pool), reqB);
        vm.prank(bob);
        pool.sellTicket(reqB, 0);
        _settle(reqA);
        vm.prank(keeper);
        pool.harvest(reqA);
        assertEq(pool.positions(reqA).status, NostosInstantPool.Status.Settled);
        assertEq(pool.positions(reqB).status, NostosInstantPool.Status.Active);
        assertEq(ticket.ownerOf(reqB), address(pool), "reqB still owned by pool");
        assertEq(pool.outstandingFaceValue(), 100e6);
    }

    // ---- pause ----

    function test_HarvestUsableWhilePaused() public {
        uint256 requestId = _fundAndBuyTicket(alice);
        _settle(requestId);
        vm.prank(manager);
        pool.pause();
        vm.startPrank(bob);
        vm.expectRevert();
        pool.sellTicket(requestId, 0);
        vm.stopPrank();
        vm.prank(keeper);
        pool.harvest(requestId);
        assertEq(pool.positions(requestId).status, NostosInstantPool.Status.Settled);
    }

    // ---- helpers (reuse P4 flows) ----

    function _fundAndCreatePendingRequest() internal returns (uint256 requestId) {
        vm.startPrank(manager);
        usdt.approve(address(pool), FUNDING);
        pool.fund(FUNDING);
        vm.stopPrank();
        requestId = _requestFor(alice, 200e6);
    }

    function _fundAndBuyTicket(address who) internal returns (uint256 requestId) {
        requestId = _fundAndCreatePendingRequest();
        vm.prank(who);
        ticket.approve(address(pool), requestId);
        vm.prank(who);
        uint256 amountOut = pool.sellTicket(requestId, 0);
        assertTrue(amountOut > 0);
        assertEq(pool.positions(requestId).faceValue, 200e6);
    }

    function _requestFor(address who, uint256 shares) internal returns (uint256 requestId) {
        _depositInto(who, shares);
        vm.prank(who);
        requestId = vault.requestRedeem(shares, who, who);
    }

    function _depositInto(address who, uint256 assets) internal {
        vm.startPrank(who);
        usdt.approve(address(vault), assets);
        uint256 shares = vault.deposit(assets, who);
        vm.stopPrank();
        assertEq(shares, assets);
    }

    function _settle(uint256 requestId) internal {
        vm.prank(settler);
        uint256 assets = vault.settleRequest(requestId);
        assertGt(assets, 0);
    }

    function _quoteFor(uint256 faceValue, uint256 liquid, uint256 outstanding)
        internal view returns (NostosInstantPool.Quote memory q)
    {
        // pure formula replica used for assertions; mirrors _quote internals
        uint256 denom = liquid + outstanding;
        q.faceValue = faceValue;
        q.utilizationBps = outstanding == 0 ? 0 : outstanding * TEN_THOUSAND / denom;
        q.sizeRatioBps = liquid == 0 ? TEN_THOUSAND : faceValue * TEN_THOUSAND / liquid;
        NostosInstantPool.Pricing memory p = pool.getPricing();
        uint256 utilAdj = q.utilizationBps * p.utilizationSlopeBps / TEN_THOUSAND;
        uint256 sizeRatio = q.sizeRatioBps > TEN_THOUSAND ? TEN_THOUSAND : q.sizeRatioBps;
        uint256 sizeAdj = sizeRatio * p.sizeSlopeBps / TEN_THOUSAND;
        uint256 raw = p.baseDiscountBps + utilAdj + sizeAdj;
        q.discountBps = raw < p.minDiscountBps ? p.minDiscountBps : (raw > p.maxDiscountBps ? p.maxDiscountBps : raw);
        q.amountOut = faceValue * (TEN_THOUSAND - q.discountBps) / TEN_THOUSAND;
        uint256 cashAfter = q.amountOut >= liquid ? 0 : liquid - q.amountOut;
        uint256 faceAfter = outstanding + faceValue;
        q.postTradeUtilizationBps = faceAfter * TEN_THOUSAND / (cashAfter + faceAfter);
    }
}
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `"C:/Users/USER/.foundry/bin/forge.exe" test --root contracts --match-path test/NostosInstantPool.t.sol -vv`
Expected: FAIL with `src/NostosInstantPool.sol` missing / symbol not found.

- [ ] **Step 3: Implement `contracts/src/NostosInstantPool.sol`**

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC721Receiver} from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {NostosAsyncVaultP4} from "./NostosAsyncVaultP4.sol";
import {NostosRedemptionTicket} from "./NostosRedemptionTicket.sol";

/// @notice Nostos P5 protocol-owned instant-liquidity pool for P4 redemption
/// claim tickets. Buys PENDING tickets at a deterministic basis-point discount,
/// pays the seller real USDT immediately, and later harvests the full settlement
/// when the underlying P4 request becomes CLAIMABLE.
///
/// DEMO / 0% YIELD / TESTNET SETTLEMENT INFRASTRUCTURE. No LP shares, no ERC-4626.
/// No RWA backing, no yield claim, testnet only.
contract NostosInstantPool is AccessControl, Pausable, ReentrancyGuard, IERC721Receiver {
    using SafeERC20 for IERC20;

    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    uint256 private constant BASIS = 10_000;

    enum Status {
        Active,
        Settled
    }

    struct Pricing {
        uint256 baseDiscountBps;
        uint256 utilizationSlopeBps;
        uint256 sizeSlopeBps;
        uint256 minDiscountBps;
        uint256 maxDiscountBps;
        uint256 maxUtilizationBps;
    }

    struct Quote {
        uint256 faceValue;
        uint256 amountOut;
        uint256 discountBps;
        uint256 utilizationBps;
        uint256 sizeRatioBps;
        uint256 postTradeUtilizationBps;
    }

    struct InstantPosition {
        uint256 ticketId;
        uint256 requestId;
        address seller;
        uint256 faceValue;
        uint256 costBasis;
        uint256 discountBps;
        uint64 acquiredAt;
        uint64 settledAt;
        Status status;
    }

    IERC20 public immutable asset;
    NostosAsyncVaultP4 public immutable vault;
    NostosRedemptionTicket public immutable ticket;

    Pricing private _pricing;
    uint256 private _expectedTicketId;

    mapping(uint256 => InstantPosition) public positions;
    uint256 public positionCount;

    uint256 public outstandingFaceValue;
    uint256 public outstandingCostBasis;
    uint256 public realizedSpread;

    event LiquidityFunded(address indexed funder, uint256 amount);
    event LiquidityWithdrawn(address indexed withdrawer, uint256 amount);
    event PricingUpdated(
        uint256 baseDiscountBps,
        uint256 utilizationSlopeBps,
        uint256 sizeSlopeBps,
        uint256 minDiscountBps,
        uint256 maxDiscountBps,
        uint256 maxUtilizationBps
    );
    event InstantPurchased(
        uint256 indexed ticketId,
        uint256 indexed requestId,
        address indexed seller,
        uint256 faceValue,
        uint256 amountOut,
        uint256 discountBps
    );
    event TicketHarvested(
        uint256 indexed ticketId,
        uint256 indexed requestId,
        uint256 faceValue,
        uint256 costBasis,
        uint256 spread
    );

    constructor(IERC20 asset_, NostosAsyncVaultP4 vault_, NostosRedemptionTicket ticket_) {
        require(address(asset_) != address(0), "InstantPool: zero asset");
        require(address(vault_) != address(0), "InstantPool: zero vault");
        require(address(ticket_) != address(0), "InstantPool: zero ticket");
        require(ticket_.vault() == address(vault_), "InstantPool: ticket not bound to vault");
        require(
            vault_.redemptionTicket() == address(ticket_),
            "InstantPool: vault does not reference ticket"
        );
        asset = asset_;
        vault = vault_;
        ticket = ticket_;
        _pricing = Pricing({
            baseDiscountBps: 100,
            utilizationSlopeBps: 1_000,
            sizeSlopeBps: 500,
            minDiscountBps: 0,
            maxDiscountBps: 3_000,
            maxUtilizationBps: 9_000
        });
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MANAGER_ROLE, msg.sender);
        _grantRole(PAUSER_ROLE, msg.sender);
    }

    // ---- Views ----

    function liquidAssets() public view returns (uint256) {
        return asset.balanceOf(address(this));
    }

    function utilizationBps() public view returns (uint256) {
        uint256 liquid = liquidAssets();
        uint256 outstanding = outstandingFaceValue;
        uint256 denom = liquid + outstanding;
        if (denom == 0) return 0;
        return outstanding * BASIS / denom;
    }

    function getPricing() public view returns (Pricing memory) {
        return _pricing;
    }

    function quoteTicket(uint256 ticketId) external view returns (Quote memory) {
        ( , uint256 faceValue) = _eligiblePendingRequest(ticketId);
        return _quote(faceValue);
    }

    // ---- Admin / manager ----

    function setPricing(
        uint256 baseDiscountBps,
        uint256 utilizationSlopeBps,
        uint256 sizeSlopeBps,
        uint256 minDiscountBps,
        uint256 maxDiscountBps,
        uint256 maxUtilizationBps
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(minDiscountBps <= maxDiscountBps, "InstantPool: min > max");
        require(
            baseDiscountBps >= minDiscountBps && baseDiscountBps <= maxDiscountBps,
            "InstantPool: base out of bounds"
        );
        require(maxDiscountBps <= BASIS, "InstantPool: max discount exceeds 100%");
        require(maxUtilizationBps > 0 && maxUtilizationBps <= BASIS, "InstantPool: bad max utilization");
        _pricing = Pricing({
            baseDiscountBps: baseDiscountBps,
            utilizationSlopeBps: utilizationSlopeBps,
            sizeSlopeBps: sizeSlopeBps,
            minDiscountBps: minDiscountBps,
            maxDiscountBps: maxDiscountBps,
            maxUtilizationBps: maxUtilizationBps
        });
        emit PricingUpdated(
            baseDiscountBps,
            utilizationSlopeBps,
            sizeSlopeBps,
            minDiscountBps,
            maxDiscountBps,
            maxUtilizationBps
        );
    }

    function fund(uint256 amount) external onlyRole(MANAGER_ROLE) {
        require(amount > 0, "InstantPool: zero amount");
        asset.safeTransferFrom(_msgSender(), address(this), amount);
        emit LiquidityFunded(_msgSender(), amount);
    }

    function withdrawLiquidity(uint256 amount) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(amount > 0, "InstantPool: zero amount");
        require(outstandingFaceValue == 0, "InstantPool: exposure outstanding");
        require(amount <= liquidAssets(), "InstantPool: insufficient liquidity");
        asset.safeTransfer(_msgSender(), amount);
        emit LiquidityWithdrawn(_msgSender(), amount);
    }

    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    // ---- Purchase ----

    function sellTicket(uint256 ticketId, uint256 minAmountOut)
        external
        nonReentrant
        whenNotPaused
        returns (uint256 amountOut)
    {
        require(ticket.ownerOf(ticketId) == _msgSender(), "InstantPool: seller does not own ticket");
        ( , uint256 faceValue) = _eligiblePendingRequest(ticketId);

        Quote memory q = _quote(faceValue);
        require(q.amountOut >= minAmountOut, "InstantPool: slippage");
        require(q.amountOut <= liquidAssets(), "InstantPool: insufficient liquidity");
        require(q.amountOut > 0, "InstantPool: zero payout");
        require(
            q.postTradeUtilizationBps <= _pricing.maxUtilizationBps,
            "InstantPool: utilization cap"
        );

        address seller = _msgSender();

        _expectedTicketId = ticketId;
        ticket.safeTransferFrom(seller, address(this), ticketId);
        _expectedTicketId = 0;

        positions[ticketId] = InstantPosition({
            ticketId: ticketId,
            requestId: ticketId,
            seller: seller,
            faceValue: faceValue,
            costBasis: q.amountOut,
            discountBps: q.discountBps,
            acquiredAt: uint64(block.timestamp),
            settledAt: 0,
            status: Status.Active
        });
        positionCount += 1;
        outstandingFaceValue += faceValue;
        outstandingCostBasis += q.amountOut;

        asset.safeTransfer(seller, q.amountOut);
        emit InstantPurchased(ticketId, ticketId, seller, faceValue, q.amountOut, q.discountBps);
        return q.amountOut;
    }

    function onERC721Received(address, address, uint256 tokenId, bytes calldata)
        external
        returns (bytes4)
    {
        require(msg.sender == address(ticket), "InstantPool: unsolicited token");
        require(_expectedTicketId == tokenId, "InstantPool: unsolicited ticket");
        _expectedTicketId = 0;
        return IERC721Receiver.onERC721Received.selector;
    }

    // ---- Harvest ----

    function harvest(uint256 ticketId) external nonReentrant returns (uint256 assets) {
        InstantPosition storage pos = positions[ticketId];
        require(pos.status == Status.Active, "InstantPool: no active position");
        require(ticket.ownerOf(ticketId) == address(this), "InstantPool: pool does not own ticket");

        address controller = vault.requestController(ticketId);
        require(controller != address(0), "InstantPool: unknown request");
        NostosAsyncVaultP4.RedemptionRequest memory req = vault.requests(ticketId, controller);
        require(req.status == NostosAsyncVaultP4.RequestStatus.Claimable, "InstantPool: not claimable");

        uint256 faceValue = pos.faceValue;
        uint256 costBasis = pos.costBasis;

        pos.status = Status.Settled;
        pos.settledAt = uint64(block.timestamp);
        outstandingFaceValue -= faceValue;
        outstandingCostBasis -= costBasis;
        realizedSpread += faceValue - costBasis;

        assets = vault.claimRedeem(ticketId, address(this));
        require(assets == faceValue, "InstantPool: settlement mismatch");
        emit TicketHarvested(ticketId, ticketId, faceValue, costBasis, faceValue - costBasis);
    }

    // ---- Internals ----

    function _eligiblePendingRequest(uint256 ticketId)
        internal
        view
        returns (address controller, uint256 faceValue)
    {
        controller = vault.requestController(ticketId);
        require(controller != address(0), "InstantPool: unknown request");
        require(ticket.ownerOf(ticketId) != address(this), "InstantPool: ticket already owned by pool");
        NostosAsyncVaultP4.RedemptionRequest memory req = vault.requests(ticketId, controller);
        require(req.status == NostosAsyncVaultP4.RequestStatus.Pending, "InstantPool: request not pending");
        require(req.shares > 0, "InstantPool: zero shares");
        faceValue = vault.sharesToAssets(req.shares);
        require(faceValue > 0, "InstantPool: zero face value");
    }

    function _quote(uint256 faceValue) internal view returns (Quote memory q) {
        uint256 liquid = liquidAssets();
        uint256 outstanding = outstandingFaceValue;
        uint256 denom = liquid + outstanding;
        require(denom > 0, "InstantPool: no liquid assets");

        q.faceValue = faceValue;
        q.utilizationBps = outstanding * BASIS / denom;
        q.sizeRatioBps = liquid == 0 ? BASIS : faceValue * BASIS / liquid;

        Pricing memory p = _pricing;
        uint256 utilizationAdjust = q.utilizationBps * p.utilizationSlopeBps / BASIS;
        uint256 sizeRatio = q.sizeRatioBps > BASIS ? BASIS : q.sizeRatioBps;
        uint256 sizeAdjust = sizeRatio * p.sizeSlopeBps / BASIS;
        uint256 rawDiscount = p.baseDiscountBps + utilizationAdjust + sizeAdjust;
        q.discountBps = rawDiscount < p.minDiscountBps
            ? p.minDiscountBps
            : (rawDiscount > p.maxDiscountBps ? p.maxDiscountBps : rawDiscount);
        q.amountOut = faceValue * (BASIS - q.discountBps) / BASIS;

        uint256 cashAfter = q.amountOut >= liquid ? 0 : liquid - q.amountOut;
        uint256 faceAfter = outstanding + faceValue;
        q.postTradeUtilizationBps = faceAfter * BASIS / (cashAfter + faceAfter);
    }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `"C:/Users/USER/.foundry/bin/forge.exe" test --root contracts --match-path test/NostosInstantPool.t.sol -vv`
Expected: all tests PASS. Fix test setup arithmetic (face value vs liquidity) as flagged in Step 1 notes until green.

- [ ] **Step 5: Verify P3/P4 tests still pass and formatting**

Run: `"C:/Users/USER/.foundry/bin/forge.exe" test --root contracts -vv`
Expected: 65 P3/P4 tests + new P5 tests all pass.
Run: `"C:/Users/USER/.foundry/bin/forge.exe" fmt --check src/NostosInstantPool.sol test/NostosInstantPool.t.sol` (workdir `contracts`)
Expected: exit 0.
Run: `"C:/Users/USER/.foundry/bin/forge.exe" build --root contracts`
Expected: exit 0, `contracts/out/NostosInstantPool.sol/NostosInstantPool.json` produced.

> After verification, the implementer MUST clean generated `contracts/out/`/`contracts/cache` changes: restore tracked `contracts/cache/solidity-files-cache.json` via `git checkout -- contracts/cache/solidity-files-cache.json` and remove newly generated untracked `contracts/out/...` artifacts created for the new contract, OR leave them only if the coordinator explicitly asks to keep artifacts for Task 2. The working tree must otherwise stay as found.

---

### Task 2: P5 deployment/funding/harvest tooling + types + unit tests

**Files:**
- Create: `scripts/registry/p5-plan.ts`
- Create: `scripts/registry/deploy-instant-pool.ts`
- Create: `scripts/registry/fund-instant-pool.ts`
- Create: `scripts/registry/harvest-instant-pool.ts`
- Create: `tests/unit/p5-plan.test.ts`
- Modify: `scripts/registry/artifact.ts` (add `instantPoolAbi`/`instantPoolBytecode` via `readOptionalArtifact`)
- Modify: `lib/chain/deployed-addresses.ts` (add `P5Deployment` type + `p5?` field; extend e2e fixture parsing to accept optional `p5`)
- Modify: `package.json` (scripts `deploy:instant-pool:testnet`, `fund:instant-pool:testnet`, `harvest:instant-pool:testnet`)
- Modify: `playwright.config.ts` (add `p5.instantPool` to the e2e fixture env JSON)
- Test: `npx vitest run tests/unit/p5-plan.test.ts`

**Interfaces:**
- Consumes: `buildP4DeployPlan` pattern; `sendP4Transaction`/`waitForP4Receipt`/`assertP4RpcHealth` from `scripts/registry/p4-write.ts`; `readOptionalArtifact` from `artifact.ts`; `loadScriptEnv`; `assertBotTestnetChain`; `getTestnetPrivateKey`; `BOT_TESTNET_SETTLEMENT_TOKEN`; `botTestnet`/`BOT_TESTNET_RPC_URL`/`BOT_TESTNET_EXPLORER_URL`.
- Produces:
  - `buildP5DeployPlan(env, addresses)` → `{ok, enabled, chainId, deployer, asset, vault, ticket} | {ok:false, enabled:boolean, reason}`
  - `buildP5FundingPlan(env, poolAddress, amount)` / `buildP5HarvestPlan(env, poolAddress, ticketId)` (can be thin wrappers over the deploy plan)
  - `P5_ENABLE_TESTNET_DEPLOY_ENV = "P5_ENABLE_TESTNET_DEPLOY"`
  - npm scripts + `p5` nested address record shape `{instantPool, instantPoolTx, instantPoolBlock, instantPoolDeployedAt}`.

- [ ] **Step 1: Write failing unit tests** `tests/unit/p5-plan.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { BOT_TESTNET_SETTLEMENT_TOKEN } from "@/lib/chain/settlement-token";
import {
  buildP5DeployPlan,
  P5_ENABLE_TESTNET_DEPLOY_ENV,
} from "@/scripts/registry/p5-plan";

const TESTNET_KEY = "0x3333333333333333333333333333333333333333333333333333333333333333";
const P4_VAULT = "0x2b0475ca0b12e3b8f9634c6ac3190e96508385d4";
const TICKET = "0x6666666666666666666666666666666666666666";

describe("P5 deployment plan", () => {
  it("is disabled without explicit opt-in", () => {
    const plan = buildP5DeployPlan({}, {});
    expect(plan.enabled).toBe(false);
    if (!plan.ok) expect(plan.reason).toContain(`${P5_ENABLE_TESTNET_DEPLOY_ENV}=true`);
  });

  it("fails closed without the Testnet key", () => {
    const plan = buildP5DeployPlan({ [P5_ENABLE_TESTNET_DEPLOY_ENV]: "true" }, {
      p4: { asyncVault: P4_VAULT, redemptionTicket: TICKET },
    });
    expect(plan.ok).toBe(false);
    if (!plan.ok) expect(plan.reason).toContain("BOT_TESTNET_PRIVATE_KEY");
  });

  it("refuses inconsistent/incomplete P4 records", () => {
    const plan = buildP5DeployPlan(
      { [P5_ENABLE_TESTNET_DEPLOY_ENV]: "true", BOT_TESTNET_PRIVATE_KEY: TESTNET_KEY },
      { p4: { asyncVault: P4_VAULT } },
    );
    expect(plan.ok).toBe(false);
    if (!plan.ok) expect(plan.reason).toContain("redemptionTicket");
  });

  it("targets chain 968, verified Testnet USDT, and the persisted P4 vault/ticket", () => {
    const plan = buildP5DeployPlan(
      { [P5_ENABLE_TESTNET_DEPLOY_ENV]: "true", BOT_TESTNET_PRIVATE_KEY: TESTNET_KEY },
      { p4: { asyncVault: P4_VAULT, redemptionTicket: TICKET } },
    );
    expect(plan.ok).toBe(true);
    if (plan.ok) {
      expect(plan.chainId).toBe(968);
      expect(plan.asset).toBe(BOT_TESTNET_SETTLEMENT_TOKEN.address);
      expect(plan.vault).toBe(P4_VAULT);
      expect(plan.ticket).toBe(TICKET);
    }
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/unit/p5-plan.test.ts`
Expected: FAIL — `p5-plan` module not found.

- [ ] **Step 3: Implement `scripts/registry/p5-plan.ts`**

```ts
import { privateKeyToAccount } from "viem/accounts";
import { isAddress } from "viem";
import { getTestnetPrivateKey } from "@/lib/chain/builder-wallet";
import { BOT_TESTNET_CHAIN_ID } from "@/lib/chain/bot-testnet";
import { BOT_TESTNET_SETTLEMENT_TOKEN } from "@/lib/chain/settlement-token";

export const P5_ENABLE_TESTNET_DEPLOY_ENV = "P5_ENABLE_TESTNET_DEPLOY";

export type P5DeployPlan =
  | { ok: true; enabled: true; chainId: number; deployer: `0x${string}`; asset: `0x${string}`; vault: `0x${string}`; ticket: `0x${string}` }
  | { ok: false; enabled: boolean; reason: string };

type P4Record = { asyncVault?: string | null; redemptionTicket?: string | null };

export function buildP5DeployPlan(
  env: Record<string, string | undefined> = process.env,
  addresses: { p4?: P4Record },
): P5DeployPlan {
  if (env[P5_ENABLE_TESTNET_DEPLOY_ENV] !== "true") {
    return { ok: false, enabled: false, reason: `${P5_ENABLE_TESTNET_DEPLOY_ENV}=true is required.` };
  }
  const key = getTestnetPrivateKey(env);
  if (!key) return { ok: false, enabled: true, reason: "BOT_TESTNET_PRIVATE_KEY is not configured." };
  const asset = BOT_TESTNET_SETTLEMENT_TOKEN.address;
  if (!asset) return { ok: false, enabled: true, reason: "Verified Testnet USDT is not configured." };
  const vault = addresses.p4?.asyncVault ?? null;
  const ticket = addresses.p4?.redemptionTicket ?? null;
  if (!vault || !isAddress(vault)) return { ok: false, enabled: true, reason: "P4 asyncVault address is required." };
  if (!ticket || !isAddress(ticket)) return { ok: false, enabled: true, reason: "P4 redemptionTicket address is required." };
  return {
    ok: true, enabled: true, chainId: BOT_TESTNET_CHAIN_ID,
    deployer: privateKeyToAccount(key as `0x${string}`).address,
    asset, vault: vault as `0x${string}`, ticket: ticket as `0x${string}`,
  };
}
```

- [ ] **Step 4: Implement `scripts/registry/deploy-instant-pool.ts`** (mirror `deploy-vault-p4.ts`):

```ts
import { createPublicClient, createWalletClient, encodeDeployData, http, type Abi } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { botTestnet, BOT_TESTNET_EXPLORER_URL, BOT_TESTNET_RPC_URL } from "@/lib/chain/bot-testnet";
import { getTestnetPrivateKey } from "@/lib/chain/builder-wallet";
import { assertBotTestnetChain } from "@/lib/chain/guards";
import { instantPoolAbi, instantPoolBytecode } from "@/scripts/registry/artifact";
import { buildP5DeployPlan } from "@/scripts/registry/p5-plan";
import { sendP4Transaction, waitForP4Receipt } from "@/scripts/registry/p4-write";
import { loadScriptEnv } from "../load-script-env";

loadScriptEnv();

const ADDRESS_FILE = join(process.cwd(), "contracts", "addresses", "bot-testnet.json");

async function main() {
  const current = existsSync(ADDRESS_FILE)
    ? (JSON.parse(readFileSync(ADDRESS_FILE, "utf8")) as Record<string, unknown>)
    : {};
  const plan = buildP5DeployPlan(process.env, current as never);
  if (!plan.enabled) { console.log(`P5 INSTANT POOL DEPLOY DISABLED: ${plan.reason}`); process.exit(0); }
  if (!plan.ok) { console.error(`P5 INSTANT POOL DEPLOY REFUSED: ${plan.reason}`); process.exit(1); }
  if (!instantPoolAbi || !instantPoolBytecode) {
    throw new Error("P5 INSTANT POOL DEPLOY REFUSED: run forge build first.");
  }

  const p5 = ((current.p5 ?? {}) as Record<string, unknown>);
  const persistedPool = typeof p5.instantPool === "string" && /^0x[0-9a-fA-F]{40}$/.test(p5.instantPool)
    ? (p5.instantPool as `0x${string}`)
    : undefined;
  if (persistedPool && (!p5.instantPoolTx || !p5.instantPoolBlock || !p5.instantPoolDeployedAt)) {
    throw new Error("P5 INSTANT POOL DEPLOY REFUSED: persisted p5 record is incomplete.");
  }

  const publicClient = createPublicClient({ chain: botTestnet, transport: http(BOT_TESTNET_RPC_URL, { timeout: 15_000 }) });
  assertBotTestnetChain(await publicClient.getChainId());

  if (persistedPool) {
    const code = await publicClient.getBytecode({ address: persistedPool });
    if (!code || code === "0x") throw new Error("P5 INSTANT POOL DEPLOY REFUSED: persisted pool has no code.");
    console.log(`P5 instant pool already persisted: ${persistedPool}`);
  } else {
    const key = getTestnetPrivateKey();
    if (!key) throw new Error("P5 INSTANT POOL DEPLOY REFUSED: Testnet key disappeared after planning.");
    const account = privateKeyToAccount(key as `0x${string}`);
    const walletClient = createWalletClient({ chain: botTestnet, transport: http(BOT_TESTNET_RPC_URL), account });
    console.log("DEPLOYING NostosInstantPool");
    console.log(`  chain: ${plan.chainId} (BOT Testnet)`);
    console.log(`  deployer: ${account.address}`);
    console.log(`  asset: ${plan.asset} (verified Testnet USDT)`);
    console.log(`  vault: ${plan.vault}`);
    console.log(`  ticket: ${plan.ticket}`);
    const hash = await sendP4Transaction({
      publicClient, walletClient, account, chain: botTestnet,
      data: encodeDeployData({ abi: instantPoolAbi as Abi, bytecode: instantPoolBytecode, args: [plan.asset, plan.vault, plan.ticket] }),
    });
    const receipt = await waitForP4Receipt(publicClient, hash, "instant pool deployment");
    const poolAddress = receipt.contractAddress;
    if (!poolAddress) throw new Error("P5 INSTANT POOL DEPLOY FAILED: no contract address.");
    const tmp = `${ADDRESS_FILE}.p5.tmp`;
    writeFileSync(tmp, JSON.stringify({ ...current, p5: { ...p5, instantPool: poolAddress, instantPoolTx: hash, instantPoolBlock: String(receipt.blockNumber), instantPoolDeployedAt: new Date().toISOString() } }, null, 2) + "\n");
    renameSync(tmp, ADDRESS_FILE);
    console.log(`  tx: ${hash}`);
    console.log(`  block: ${receipt.blockNumber}`);
    console.log(`  pool: ${poolAddress}`);
    console.log(`  explorer: ${BOT_TESTNET_EXPLORER_URL}/tx/${hash}`);
  }
}

main().catch((err) => { console.error("P5 INSTANT POOL DEPLOY FAILED:", err instanceof Error ? err.message : err); process.exit(1); });
```

- [ ] **Step 5: Implement `scripts/registry/fund-instant-pool.ts`** and **`scripts/registry/harvest-instant-pool.ts`**

`fund-instant-pool.ts`: read `p5.instantPool`; require persisted + code; plan enabled/ok; assert chain 968; read `amount` from `process.argv[2]`; approve pool for `amount` USDT (from the Testnet key account), then `pool.fund(amount)`; wait success receipt; print tx/explorer. No-op without opt-in.

`harvest-instant-pool.ts`: read `p5.instantPool`; require persisted + code; plan enabled/ok; assert chain 968; read `ticketId` from `process.argv[2]`; call `pool.harvest(ticketId)`; wait success receipt; print tx/explorer. (Permissionless; any key may call, but tooling uses the Testnet key.)

- [ ] **Step 6: Modify `scripts/registry/artifact.ts`, `lib/chain/deployed-addresses.ts`, `package.json`, `playwright.config.ts`**

`artifact.ts`: add
```ts
const instantPoolArtifact = readOptionalArtifact("NostosInstantPool.sol/NostosInstantPool.json");
export const instantPoolAbi = instantPoolArtifact?.abi;
export const instantPoolBytecode = instantPoolArtifact?.bytecode?.object as `0x${string}` | undefined;
```

`deployed-addresses.ts`: add
```ts
export type P5Deployment = {
  instantPool?: string | null;
  instantPoolTx?: string | null;
  instantPoolBlock?: string | null;
  instantPoolDeployedAt?: string | null;
};
```
add `p5?: P5Deployment` to `DeployedTestnetAddresses`; extend the fixture parse to accept an optional `p5` (must contain a valid `instantPool` string) and merge it in the e2e branch.

`package.json` scripts:
```json
"deploy:instant-pool:testnet": "tsx scripts/registry/deploy-instant-pool.ts",
"fund:instant-pool:testnet": "tsx scripts/registry/fund-instant-pool.ts",
"harvest:instant-pool:testnet": "tsx scripts/registry/harvest-instant-pool.ts"
```

`playwright.config.ts`: extend the fixture JSON env to include:
```ts
p5: { instantPool: "0x0000000000000000000000000000000000000303" },
```

- [ ] **Step 7: Run unit tests, then run guarded commands WITHOUT opt-in**

Run: `npx vitest run tests/unit/p5-plan.test.ts` → PASS.
Run: `npm run deploy:instant-pool:testnet` → exit 0, prints `P5 INSTANT POOL DEPLOY DISABLED: P5_ENABLE_TESTNET_DEPLOY=true is required.` (zero network).
Run: `npm run fund:instant-pool:testnet -- 1000000` and `npm run harvest:instant-pool:testnet -- 1` → exit 0, DISABLED.
Run: `npx tsc --noEmit` → PASS.

---

### Task 3: Frontend — ABI, hooks, panel, wire `/pool`

**Files:**
- Create: `lib/contracts/nostos-instant-pool-abi.ts`
- Create: `lib/chain/instant-pool-hooks.ts`
- Create: `components/product/instant-pool-panel.tsx`
- Modify: `app/(product)/pool/page.tsx` (render the live panel when a persisted/fixture `p5.instantPool` exists; keep the current truthful placeholder as the fallback)
- Test: `npx tsc --noEmit`, `npm run lint`, `rm -rf .next && npm run build`

**Interfaces:**
- Consumes: `deployedTestnet` (`p5.instantPool`), `useTicketedVault` from `lib/chain/ticketed-vault-hooks.ts` (owned tickets + request reads), `nostosAsyncVaultP4Abi`, `nostosRedemptionTicketAbi`, `useBotNetwork`, `FRONTEND_POLICY`, `BOT_TESTNET_SETTLEMENT_TOKEN`, product primitives, `Button`/`Input`.
- Produces: `useInstantPool()` hook returning `{deployed, usable, poolAddress, vaultAddress, ticketAddress, liquidAssets, outstandingFaceValue, outstandingCostBasis, realizedSpread, utilizationBps, pricing, eligibleTicket, quote, selectedTicketOwner, refetchAll}`; `InstantPoolPanel` component; updated `/pool` page.

- [ ] **Step 1: Implement `lib/contracts/nostos-instant-pool-abi.ts`**

```ts
import { parseAbi } from "viem";

export const nostosInstantPoolAbi = parseAbi([
  "function asset() view returns (address)",
  "function vault() view returns (address)",
  "function ticket() view returns (address)",
  "function liquidAssets() view returns (uint256)",
  "function outstandingFaceValue() view returns (uint256)",
  "function outstandingCostBasis() view returns (uint256)",
  "function realizedSpread() view returns (uint256)",
  "function utilizationBps() view returns (uint256)",
  "function positionCount() view returns (uint256)",
  "function getPricing() view returns (uint256 baseDiscountBps, uint256 utilizationSlopeBps, uint256 sizeSlopeBps, uint256 minDiscountBps, uint256 maxDiscountBps, uint256 maxUtilizationBps)",
  "function quoteTicket(uint256 ticketId) view returns (uint256 faceValue, uint256 amountOut, uint256 discountBps, uint256 utilizationBps, uint256 sizeRatioBps, uint256 postTradeUtilizationBps)",
  "function positions(uint256 ticketId) view returns (uint256 ticketId, uint256 requestId, address seller, uint256 faceValue, uint256 costBasis, uint256 discountBps, uint64 acquiredAt, uint64 settledAt, uint8 status)",
  "function sellTicket(uint256 ticketId, uint256 minAmountOut) returns (uint256)",
  "function harvest(uint256 ticketId) returns (uint256)",
  "function fund(uint256 amount)",
  "function withdrawLiquidity(uint256 amount)",
  "function setPricing(uint256 baseDiscountBps, uint256 utilizationSlopeBps, uint256 sizeSlopeBps, uint256 minDiscountBps, uint256 maxDiscountBps, uint256 maxUtilizationBps)",
]);
```

- [ ] **Step 2: Implement `lib/chain/instant-pool-hooks.ts`** (client component, real reads gated by BOT Testnet + wallet + persisted pool):

```ts
"use client";

import { useAccount, useReadContract } from "wagmi";
import { deployedTestnet } from "@/lib/chain/deployed-addresses";
import { FRONTEND_POLICY } from "@/lib/chain/frontend-policy";
import { useBotNetwork } from "@/lib/chain/frontend-hooks";
import { useTicketedVault, type TicketRequestStatus } from "@/lib/chain/ticketed-vault-hooks";
import { nostosInstantPoolAbi } from "@/lib/contracts/nostos-instant-pool-abi";
import { nostosAsyncVaultP4Abi } from "@/lib/contracts/nostos-async-vault-p4-abi";
import { nostosRedemptionTicketAbi } from "@/lib/contracts/nostos-redemption-ticket-abi";

const ZERO = BigInt(0);
const POOL_ADDRESS = deployedTestnet.p5?.instantPool as `0x${string}` | undefined;

export interface PoolQuote {
  faceValue: bigint;
  amountOut: bigint;
  discountBps: bigint;
  utilizationBps: bigint;
  sizeRatioBps: bigint;
  postTradeUtilizationBps: bigint;
}

export interface EligiblePendingTicket {
  ticketId: bigint;
  faceValue: bigint;
  quote: PoolQuote | undefined;
  quoteError: string | undefined;
}

export function useInstantPool(soldTicketId?: bigint): {
  deployed: boolean;
  usable: boolean;
  poolAddress: `0x${string}` | undefined;
  vaultAddress: `0x${string}` | undefined;
  ticketAddress: `0x${string}` | undefined;
  liquidAssets: bigint | undefined;
  outstandingFaceValue: bigint | undefined;
  outstandingCostBasis: bigint | undefined;
  realizedSpread: bigint | undefined;
  utilizationBps: bigint | undefined;
  pricing: readonly unknown[] | undefined;
  eligibleTicket: EligiblePendingTicket | undefined;
  selectedTicketOwner: string | undefined;
  selectedTicketStatus: TicketRequestStatus | undefined;
  soldTicketOwner: string | undefined;
  soldPosition: readonly unknown[] | undefined;
  refetchAll: () => void;
} {
  const { address } = useAccount();
  const { isBotTestnet } = useBotNetwork();
  const deployed = Boolean(POOL_ADDRESS);
  const usable = Boolean(isBotTestnet && address && POOL_ADDRESS);
  const chainId = FRONTEND_POLICY.requiredChainId;

  const liquidAssets = useReadContract({ address: POOL_ADDRESS, abi: nostosInstantPoolAbi, functionName: "liquidAssets", chainId, query: { enabled: usable } });
  const outstandingFaceValue = useReadContract({ address: POOL_ADDRESS, abi: nostosInstantPoolAbi, functionName: "outstandingFaceValue", chainId, query: { enabled: usable } });
  const outstandingCostBasis = useReadContract({ address: POOL_ADDRESS, abi: nostosInstantPoolAbi, functionName: "outstandingCostBasis", chainId, query: { enabled: usable } });
  const realizedSpread = useReadContract({ address: POOL_ADDRESS, abi: nostosInstantPoolAbi, functionName: "realizedSpread", chainId, query: { enabled: usable } });
  const utilizationBps = useReadContract({ address: POOL_ADDRESS, abi: nostosInstantPoolAbi, functionName: "utilizationBps", chainId, query: { enabled: usable } });
  const pricing = useReadContract({ address: POOL_ADDRESS, abi: nostosInstantPoolAbi, functionName: "getPricing", chainId, query: { enabled: usable } });

  // Reuse P4 ticketed hook for the connected user's owned tickets + request statuses.
  const ticketed = useTicketedVault(undefined);
  const pendingOwned = ticketed.ownedTickets.find((t) => t.status === 1);

  const quoteRead = useReadContract({
    address: POOL_ADDRESS,
    abi: nostosInstantPoolAbi,
    functionName: "quoteTicket",
    args: pendingOwned ? [pendingOwned.id] : undefined,
    chainId,
    query: { enabled: Boolean(usable && pendingOwned) },
  });

  const faceValueRead = useReadContract({
    address: ticketed.vaultAddress,
    abi: nostosAsyncVaultP4Abi,
    functionName: "sharesToAssets",
    args: pendingOwned ? [pendingOwned.shares] : undefined,
    chainId,
    query: { enabled: Boolean(usable && pendingOwned) },
  });

  // Post-sale truth: the pool owns the sold ticket and holds its position.
  const soldOwnerRead = useReadContract({
    address: ticketed.ticketAddress,
    abi: nostosRedemptionTicketAbi,
    functionName: "ownerOf",
    args: soldTicketId !== undefined ? [soldTicketId] : undefined,
    chainId,
    query: { enabled: Boolean(usable && soldTicketId !== undefined) },
  });
  const soldPositionRead = useReadContract({
    address: POOL_ADDRESS,
    abi: nostosInstantPoolAbi,
    functionName: "positions",
    args: soldTicketId !== undefined ? [soldTicketId] : undefined,
    chainId,
    query: { enabled: Boolean(usable && soldTicketId !== undefined) },
  });

  return {
    deployed,
    usable,
    poolAddress: POOL_ADDRESS,
    vaultAddress: ticketed.vaultAddress,
    ticketAddress: ticketed.ticketAddress,
    liquidAssets: liquidAssets.data as bigint | undefined,
    outstandingFaceValue: outstandingFaceValue.data as bigint | undefined,
    outstandingCostBasis: outstandingCostBasis.data as bigint | undefined,
    realizedSpread: realizedSpread.data as bigint | undefined,
    utilizationBps: utilizationBps.data as bigint | undefined,
    pricing: pricing.data as readonly unknown[] | undefined,
    eligibleTicket: pendingOwned
      ? {
          ticketId: pendingOwned.id,
          faceValue: (faceValueRead.data as bigint | undefined) ?? ZERO,
          quote: quoteRead.data as PoolQuote | undefined,
          quoteError: quoteRead.isError ? (quoteRead.error?.message ?? "Quote unavailable") : undefined,
        }
      : undefined,
    selectedTicketOwner: ticketed.selectedTicketOwner,
    selectedTicketStatus: ticketed.selectedRequest?.status,
    soldTicketOwner: soldOwnerRead.data as string | undefined,
    soldPosition: soldPositionRead.data as readonly unknown[] | undefined,
    refetchAll: () => {
      liquidAssets.refetch(); outstandingFaceValue.refetch(); outstandingCostBasis.refetch();
      realizedSpread.refetch(); utilizationBps.refetch(); pricing.refetch();
      quoteRead.refetch(); faceValueRead.refetch(); soldOwnerRead.refetch(); soldPositionRead.refetch();
      ticketed.refetchAll();
    },
  };
}
```

> Note: `useTicketedVault` reads `requests`/`ownerOf` for the connected user; only PENDING (status 1) owned tickets are eligible. The hook exposes `selectedTicketOwner` and `selectedTicketStatus` so the panel can show the claim-ownership truth and disable Instant sale if the ticket is CLAIMABLE.

- [ ] **Step 3: Implement `components/product/instant-pool-panel.tsx`** (client)

Flow: metrics row (`AVAILABLE LIQUIDITY`, `OUTSTANDING CLAIM FACE VALUE`, `OUTSTANDING COST BASIS`, `UTILIZATION`, `REALIZED SPREAD`) → eligible ticket card (`Ticket #N`, `Face value`, `Status PENDING`) → quote card (`You receive now`, `Discount`, `Pool utilization`, `Trade-size impact`) → CTA `Get instant liquidity` → staged flow `REVIEW → APPROVE TICKET (if required) → SIGN SALE → SUBMITTED → CONFIRMING → CONFIRMED/FAILED`.

Key behaviors (mirror `ticketed-demo-vault-panel.tsx` staging and receipt-waiting):
- Reads `ticket.getApproved(ticketId)`; if `!= poolAddress`, the confirm step first `approve(poolAddress, ticketId)` and waits for mined receipt, then writes `sellTicket(ticketId, minAmountOut)` where `minAmountOut = quote.amountOut`.
- After confirmed: keep the sold `ticketId` in local state, pass it to `useInstantPool(soldTicketId)`, call `refetchAll()`; show `ticket owner = <soldTicketOwner>` (live `ownerOf`, equals the pool after a sale) and `seller received <amountOut> USDT`, and the sold position status from `soldPosition`.
- If eligible ticket status flips to 2 (CLAIMABLE): disable Instant sale and show "This ticket is CLAIMABLE — claim normally for full value."
- Wrong network → `BOT TESTNET REQUIRED` notice (no reads, no actions). Disconnected → truthful unavailable states.
- Reuse `formatUnits`, `DataPanel`, `Metric`, `StateNotice`, `DefinitionRows`, `Button`, `Input`, `StageLine`-style stage text. Add `data-testid="p5-tx-stage"`.

- [ ] **Step 4: Wire `app/(product)/pool/page.tsx`**

Server component: read `deployedTestnet.p5?.instantPool`. If present → render `ProductPage` with heading/status badge and `<InstantPoolPanel />`. If absent → keep the existing placeholder page (truthful "No live capacity"). Update `metadata` title/description to mention instant liquidity; keep no-fabrication copy.

- [ ] **Step 5: Verify**

Run: `npx tsc --noEmit` → PASS. `npm run lint` → PASS. `rm -rf .next && npm run build` → PASS.

---

### Task 4: P5 E2E fixture + spec

**Files:**
- Create: `tests/e2e/p5-rpc-fixture.ts`
- Create: `tests/e2e/p5-instant-pool.spec.ts`
- Modify: (none beyond Task 2 config)
- Test: `npm run test:e2e`

**Interfaces:**
- Consumes: `nostosInstantPoolAbi`, `nostosAsyncVaultP4Abi`, `nostosRedemptionTicketAbi`, `erc20Abi`, Playwright route interception (pattern of `p4-rpc-fixture.ts`).
- Produces: `installP5RpcFixture(page, initial)` → `{state, switchAccount, rejectNextTransaction, expectConfirmed}`; spec covering quote rendering, approve+sell lifecycle, truthful failure, CLAIMABLE disable, wrong-network/disconnected.

- [ ] **Step 1: Implement `tests/e2e/p5-rpc-fixture.ts`**

Mirror `p4-rpc-fixture.ts`. Addresses: pool `0x0000000000000000000000000000000000000303`, vault `...0101`, ticket `...0202`, USDT `...0303` (asset). Route `https://rpc.bohr.life/**`:
- `eth_chainId` → `0x3c8`; `net_version` → `968`; `eth_blockNumber` → `0x100`; `eth_getCode` → `0x60006000`; gas/balance/nonce stubs.
- Pool `eth_call`:
  - `liquidAssets` → `1_000_000_000`; `outstandingFaceValue`/`outstandingCostBasis` → `0`; `realizedSpread` → `0`; `utilizationBps` → `0`;
  - `getPricing` → `[100, 1000, 500, 0, 3000, 9000]`;
  - `quoteTicket` → `[100_000_000, 98_500_000, 150, 0, 1_000, 998]` (face 100 USDT, amountOut 98.5 USDT at 150 bps);
  - `positions` → `[0,0,0x0,0,0,0,0,0,0]` for the unsold ticket;
  - ticket `ownerOf(7)` → fixture owner; `getApproved(7)` → ZERO initially, then pool address after approve tx;
  - vault `requests(7, alice)` → status 1 (PENDING); `requestController(7)` → alice; `sharesToAssets(7)` → `100_000_000`; `activeRequestId(alice)` → `7`;
- `eth_sendTransaction`: decode ticket `approve` → set approved state; decode pool `sellTicket` → set owner to pool, mark sold, increment counter; return synthetic hash. Receipt status `0x1`.
- `eth_getTransactionReceipt` → success block.
- Provider init script exposes `window.__nostosP5Provider` with `setAccount`.

- [ ] **Step 2: Implement `tests/e2e/p5-instant-pool.spec.ts`**

```ts
test.describe("P5 instant pool", () => {
  test("renders real pool metrics and a quote for the user's pending ticket", async ({ page }) => {
    await installP5RpcFixture(page);
    await page.goto("/pool");
    await connectWallet(page);
    await expect(page.getByText("Available liquidity")).toBeVisible();
    await expect(page.getByText("Outstanding claim face value")).toBeVisible();
    await expect(page.getByText(/Ticket #7/)).toBeVisible();
    await expect(page.getByText("98.5")).toBeVisible(); // You receive now
    await expect(page.getByRole("button", { name: /get instant liquidity/i })).toBeEnabled();
  });

  test("approve + sell lifecycle reaches confirmed and shows owner = pool", async ({ page }) => {
    const fixture = await installP5RpcFixture(page);
    await page.goto("/pool");
    await connectWallet(page);
    await page.getByRole("button", { name: /get instant liquidity/i }).click();
    await expect(page.getByTestId("p5-tx-stage")).toContainText("REVIEW");
    await page.getByRole("button", { name: /confirm sale/i }).click();
    await expect(page.getByTestId("p5-tx-stage")).toContainText("CONFIRMED");
    await expect(page.getByText(/instant pool/i).first()).toBeVisible();
    await expect(page.getByText(/seller received/i)).toBeVisible();
  });

  test("truthful failure when wallet rejects the sale", async ({ page }) => {
    const fixture = await installP5RpcFixture(page);
    await page.goto("/pool");
    await connectWallet(page);
    await fixture.rejectNextTransaction();
    await page.getByRole("button", { name: /get instant liquidity/i }).click();
    await page.getByRole("button", { name: /confirm sale/i }).click();
    await expect(page.getByTestId("p5-tx-stage")).toContainText("FAILED");
  });
});
```

Add a wrong-network test by installing the fixture with a chain id override in the route (e.g., a `chainId` option that returns `0x2a5` for `eth_chainId`) and asserting the pool panel shows `BOT TESTNET REQUIRED` and no quote.

- [ ] **Step 3: Run E2E**

Run: `npm run test:e2e`
Expected: all P3/P4/P5 specs pass (31 existing + new P5 tests).

---

### Task 5: Full verification gates + state + report

- [ ] **Step 1: Run fresh gates**

```bash
npm test
npx tsc --noEmit
npm run lint
rm -rf .next && npm run build
npm run test:e2e
"C:/Users/USER/.foundry/bin/forge.exe" build --root contracts
"C:/Users/USER/.foundry/bin/forge.exe" test --root contracts -vv
"C:/Users/USER/.foundry/bin/forge.exe" fmt --check src/NostosInstantPool.sol test/NostosInstantPool.t.sol
```
(workdir `contracts` for the fmt command). Record exact exit codes and pass/fail counts. Restore any tracked `contracts/cache`/`contracts/out` modifications and remove new untracked artifacts unless the coordinator asks to keep them.

- [ ] **Step 2: Confirm guarded commands fail closed** (no opt-in, zero network)

`npm run deploy:instant-pool:testnet`, `npm run fund:instant-pool:testnet -- 1`, `npm run harvest:instant-pool:testnet -- 1` → each exit 0 with `DISABLED`/`REFUSED`.

- [ ] **Step 3: Confirm no blockchain writes occurred and tree is as-expected**

`git status --short` — only P4 (existing) + P5 new files; `contracts/addresses/bot-testnet.json` unchanged (no `p5` key).

- [ ] **Step 4: Update `.agent-state/left-off.md`** with P5 architecture, files, verification counts, guarded commands, no-write confirmation, P6 limitations.

- [ ] **Step 5: Produce the P5 completion report** (architecture, files changed, quote formula, face-value source, purchase mechanics, unsolicited-ticket protection, accounting, harvest, spread, pause/role/withdrawal security, frontend flow, deployment/provenance strategy, fresh test results, guarded commands, manual Testnet flow, P6 limitations).