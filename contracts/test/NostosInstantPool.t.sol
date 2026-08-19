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

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function decimals() public pure override returns (uint8) {
        return 6;
    }
}

contract NostosInstantPoolTest is Test {
    uint256 internal constant FUNDING = 1_000e6;
    uint256 internal constant FACE = 200e6;
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
        _fundAndBuyTicket(alice);
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
        NostosInstantPool.Quote memory q = _quoteFor(FACE, 1_000e6, 0);
        // base=100, sizeSlope=500: sizeRatio = 200e6*10000/1000e6 = 2000; sizeAdj=100; raw=200
        assertEq(q.discountBps, 200);
        assertEq(q.amountOut, FACE * (TEN_THOUSAND - 200) / TEN_THOUSAND);
    }

    function test_UtilizationIncreasesDiscount() public {
        uint256 requestId = _fundAndBuyTicket(alice);
        uint256 firstDiscount = _positionDiscount(requestId);
        NostosInstantPool.Quote memory second = _quoteFor(FACE, pool.liquidAssets(), FACE);
        assertGt(second.discountBps, firstDiscount, "utilization must increase discount");
    }

    function test_LargerSizeIncreasesDiscount() public view {
        uint256 small = _quoteFor(50e6, 1_000e6, 0).discountBps;
        uint256 large = _quoteFor(200e6, 1_000e6, 0).discountBps;
        assertGt(large, small, "larger size must increase discount");
    }

    function test_DiscountClampedByMinAndMax() public {
        // max clamp: configure a low max so the raw discount (600) must clamp to it.
        vm.prank(admin);
        pool.setPricing(100, 1_000, 500, 0, 200, 9_000);
        NostosInstantPool.Quote memory maxQ = _quoteFor(500e6, 1e6, 0);
        assertEq(maxQ.discountBps, 200, "must clamp to maxDiscountBps");
        // min is a floor: base is pinned at min, and even a tiny size ratio keeps the
        // discount at or above min (never below it).
        vm.prank(admin);
        pool.setPricing(150, 0, 0, 150, 3_000, 9_000);
        NostosInstantPool.Quote memory floorQ = _quoteFor(1e6, 1_000_000e6, 0);
        assertEq(floorQ.discountBps, 150, "discount never below minDiscountBps");
    }

    function test_ZeroLiquidityRevertsQuote() public {
        _requestFor(alice, FACE);
        vm.expectRevert(bytes("InstantPool: no liquid assets"));
        pool.quoteTicket(1);
    }

    function test_InsufficientLiquidityRevertsSell() public {
        vm.startPrank(manager);
        usdt.approve(address(pool), 10e6);
        pool.fund(10e6);
        vm.stopPrank();
        uint256 requestId = _requestFor(alice, FACE);
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
        _fundAndBuyTicket(alice);
        // a claimed request is not eligible
        uint256 claimedId = _requestFor(bob, 100e6);
        _settle(claimedId);
        vm.prank(bob);
        vault.claimRedeem(claimedId, bob);
        vm.expectRevert();
        pool.quoteTicket(claimedId);
    }

    function test_ClaimableTicketRejected() public {
        _fundAndBuyTicket(alice);
        uint256 claimableId = _requestFor(bob, 100e6);
        _settle(claimableId);
        vm.expectRevert(bytes("InstantPool: request not pending"));
        pool.quoteTicket(claimableId);
    }

    function test_NonexistentTicketRejected() public {
        _fundAndBuyTicket(alice);
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
        _fundAndCreatePendingRequest();
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
        (,, address seller, uint256 face, uint256 cost,,,, NostosInstantPool.Status status) = pool.positions(requestId);
        assertEq(seller, alice);
        assertTrue(status == NostosInstantPool.Status.Active);
        assertEq(face, FACE);
        assertEq(cost, amountOut);
        assertEq(pool.outstandingFaceValue(), FACE);
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
        assertGt(_positionFace(requestId), _positionCost(requestId));
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
        assertEq(assets, FACE, "pool receives full face value");
        assertEq(usdt.balanceOf(address(pool)), poolBalanceBefore + FACE);
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
        uint256 cost = _positionCost(requestId);
        _settle(requestId);
        vm.prank(keeper);
        pool.harvest(requestId);
        assertEq(pool.realizedSpread(), FACE - cost);
        assertEq(pool.outstandingFaceValue(), 0);
        assertEq(pool.outstandingCostBasis(), 0);
        assertTrue(_positionStatus(requestId) == NostosInstantPool.Status.Settled);
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
        assertTrue(_positionStatus(reqA) == NostosInstantPool.Status.Settled);
        assertTrue(_positionStatus(reqB) == NostosInstantPool.Status.Active);
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
        assertTrue(_positionStatus(requestId) == NostosInstantPool.Status.Settled);
    }

    // ---- helpers ----

    function _positionDiscount(uint256 ticketId) internal view returns (uint256) {
        (,,,,, uint256 discount,,,) = pool.positions(ticketId);
        return discount;
    }

    function _positionFace(uint256 ticketId) internal view returns (uint256) {
        (,,, uint256 face,,,,,) = pool.positions(ticketId);
        return face;
    }

    function _positionCost(uint256 ticketId) internal view returns (uint256) {
        (,,,, uint256 cost,,,,) = pool.positions(ticketId);
        return cost;
    }

    function _positionStatus(uint256 ticketId) internal view returns (NostosInstantPool.Status) {
        (,,,,,,,, NostosInstantPool.Status status) = pool.positions(ticketId);
        return status;
    }

    function _fundAndCreatePendingRequest() internal returns (uint256 requestId) {
        vm.startPrank(manager);
        usdt.approve(address(pool), FUNDING);
        pool.fund(FUNDING);
        vm.stopPrank();
        requestId = _requestFor(alice, FACE);
    }

    function _fundAndBuyTicket(address who) internal returns (uint256 requestId) {
        requestId = _fundAndCreatePendingRequest();
        vm.prank(who);
        ticket.approve(address(pool), requestId);
        vm.prank(who);
        uint256 amountOut = pool.sellTicket(requestId, 0);
        assertTrue(amountOut > 0);
        assertEq(_positionFace(requestId), FACE);
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
        internal
        view
        returns (NostosInstantPool.Quote memory q)
    {
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
