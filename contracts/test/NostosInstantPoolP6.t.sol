// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {NostosAsyncVaultP4} from "../src/NostosAsyncVaultP4.sol";
import {NostosRedemptionTicket} from "../src/NostosRedemptionTicket.sol";
import {NostosInstantPoolP6} from "../src/NostosInstantPoolP6.sol";

contract P6MockUSDT is ERC20 {
    constructor() ERC20("Tether USD", "USDT") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function decimals() public pure override returns (uint8) {
        return 6;
    }
}

contract NostosInstantPoolP6Test is Test {
    uint256 internal constant FUNDING = 1_000e6;
    uint256 internal constant FACE = 200e6;
    uint256 internal constant TEN_THOUSAND = 10_000;
    uint256 internal constant PROTOCOL_FEE_BPS = 1_000;
    uint256 internal constant VIRTUAL_ASSETS = 1e6;
    uint256 internal constant VIRTUAL_SHARES = 1e18;
    uint64 internal constant WITHDRAWAL_COOLDOWN = 24 hours;

    P6MockUSDT internal usdt;
    NostosAsyncVaultP4 internal vault;
    NostosRedemptionTicket internal ticket;
    NostosInstantPoolP6 internal pool;

    address internal admin = address(0xaD00);
    address internal pauser = address(0x0a05E);
    address internal settler = address(0x5E77);
    address internal alice = address(0xa11ce);
    address internal bob = address(0xb0b);
    address internal keeper = address(0xbeEf);
    address internal treasury = address(0x7ea5);

    function setUp() public {
        usdt = new P6MockUSDT();
        vm.startPrank(admin);
        vault = new NostosAsyncVaultP4(IERC20(address(usdt)));
        vault.grantRole(vault.SETTLER_ROLE(), settler);
        ticket = new NostosRedemptionTicket(address(vault));
        vault.configureRedemptionTicket(address(ticket));
        pool = new NostosInstantPoolP6(IERC20(address(usdt)), vault, ticket, treasury);
        pool.grantRole(pool.PAUSER_ROLE(), pauser);
        vm.stopPrank();
        usdt.mint(alice, 1_000_000e6);
        usdt.mint(bob, 1_000_000e6);
        usdt.mint(keeper, 1_000e6);
        usdt.mint(treasury, 1e6);
    }

    // ---- constructor / roles ----

    function test_ConstructorRejectsZeroOrMisboundIntegrations() public {
        vm.prank(admin);
        vm.expectRevert(bytes("InstantPoolP6: zero asset"));
        new NostosInstantPoolP6(IERC20(address(0)), vault, ticket, treasury);

        vm.prank(admin);
        vm.expectRevert(bytes("InstantPoolP6: zero vault"));
        new NostosInstantPoolP6(IERC20(address(usdt)), NostosAsyncVaultP4(address(0)), ticket, treasury);

        vm.prank(admin);
        vm.expectRevert(bytes("InstantPoolP6: zero ticket"));
        new NostosInstantPoolP6(IERC20(address(usdt)), vault, NostosRedemptionTicket(address(0)), treasury);

        vm.prank(admin);
        vm.expectRevert(bytes("InstantPoolP6: zero treasury"));
        new NostosInstantPoolP6(IERC20(address(usdt)), vault, ticket, address(0));

        NostosRedemptionTicket wrongTicket = new NostosRedemptionTicket(address(0xBEEF));
        vm.prank(admin);
        vm.expectRevert(bytes("InstantPoolP6: ticket not bound to vault"));
        new NostosInstantPoolP6(IERC20(address(usdt)), vault, wrongTicket, treasury);

        NostosAsyncVaultP4 unboundVault = new NostosAsyncVaultP4(IERC20(address(usdt)));
        NostosRedemptionTicket boundTicket = new NostosRedemptionTicket(address(unboundVault));
        vm.prank(admin);
        vm.expectRevert(bytes("InstantPoolP6: vault does not reference ticket"));
        new NostosInstantPoolP6(IERC20(address(usdt)), unboundVault, boundTicket, treasury);
    }

    function test_ConstructorSetsIdentityPricingRolesAndTreasury() public view {
        assertEq(pool.name(), "Nostos Instant LP");
        assertEq(pool.symbol(), "nLP");
        assertEq(pool.decimals(), 18);
        assertEq(address(pool.asset()), address(usdt));
        assertEq(address(pool.vault()), address(vault));
        assertEq(address(pool.ticket()), address(ticket));
        assertEq(pool.protocolTreasury(), treasury);
        assertTrue(pool.hasRole(pool.DEFAULT_ADMIN_ROLE(), admin));
        assertTrue(pool.hasRole(pool.PAUSER_ROLE(), admin));
        NostosInstantPoolP6.Pricing memory p = pool.getPricing();
        assertEq(p.baseDiscountBps, 100);
        assertEq(p.utilizationSlopeBps, 1_000);
        assertEq(p.sizeSlopeBps, 500);
        assertEq(p.minDiscountBps, 0);
        assertEq(p.maxDiscountBps, 3_000);
        assertEq(p.maxUtilizationBps, 9_000);
        assertEq(pool.sharePrice(), VIRTUAL_ASSETS);
    }

    function test_OnlyAdminCanSetPricing() public {
        vm.prank(bob);
        vm.expectRevert();
        pool.setPricing(200, 500, 500, 0, 3_000, 9_000);

        vm.prank(admin);
        vm.expectEmit(false, false, false, true, address(pool));
        emit NostosInstantPoolP6.PricingUpdated(200, 500, 500, 0, 3_000, 9_000);
        pool.setPricing(200, 500, 500, 0, 3_000, 9_000);
        NostosInstantPoolP6.Pricing memory p = pool.getPricing();
        assertEq(p.baseDiscountBps, 200);
    }

    function test_OnlyTreasuryCanClaimProtocolFees() public {
        vm.prank(bob);
        vm.expectRevert(bytes("InstantPoolP6: not treasury"));
        pool.claimProtocolFees();
    }

    // ---- 1 / 2: mint math ----

    function test_InitialOneUsdtDepositMintsOneElp() public {
        uint256 shares = _depositLiquidity(alice, 1e6);
        assertEq(shares, 1e18);
        assertEq(pool.balanceOf(alice), 1e18);
        assertEq(pool.totalSupply(), 1e18);
        assertEq(pool.lpNav(), 1e6);
        assertEq(pool.availableLiquidity(), 1e6);
    }

    function test_ProportionalSecondDeposit() public {
        uint256 first = _depositLiquidity(alice, 1e6);
        uint256 second = _depositLiquidity(bob, 1e6);
        assertEq(first, 1e18);
        assertEq(second, 1e18);
        assertEq(pool.balanceOf(alice), pool.balanceOf(bob));
        assertEq(pool.lpNav(), 2e6);
    }

    // ---- 3 / 4: inflation defense ----

    function test_DonationToEmptyPoolCannotBeStolenByFirstDepositor() public {
        usdt.mint(address(pool), 1_000e6);
        uint256 shares = _depositLiquidity(alice, 1e6);
        uint256 redeemable = pool.previewRedeem(shares);
        assertLe(redeemable, 1e6 + 1);
        assertGe(redeemable, 1e6 - 1);
        assertEq(pool.lpNav(), 1_001e6);
        uint256 donationResidual = pool.lpNav() - redeemable;
        assertGe(donationResidual, 1_000e6 - 1);
    }

    function test_TinyDepositAfterHugeDonationRevertsZeroShares() public {
        usdt.mint(address(pool), 2e18);
        vm.startPrank(alice);
        usdt.approve(address(pool), 1);
        vm.expectRevert(bytes("InstantPoolP6: zero shares"));
        pool.deposit(1, 0);
        vm.stopPrank();
    }

    /// @notice ERC-4626-style inflation: smallest viable seed deposit, then a
    /// large direct USDT donation, then a meaningful victim deposit. Attacker
    /// must not capture the victim's capital via share-price rounding.
    function test_FirstDepositorDonationInflationCannotStealVictimDeposit() public {
        address attacker = address(0xA77);
        address victim = address(0xb17);
        uint256 donation = 1_000_000e6;
        uint256 victimAssets = 10_000e6;
        usdt.mint(attacker, 1 + donation);
        usdt.mint(victim, victimAssets);

        uint256 attackerShares = _depositLiquidity(attacker, 1);
        assertEq(attackerShares, VIRTUAL_SHARES / VIRTUAL_ASSETS, "1-unit seed must mint virtual-normalized shares");
        emit log_named_uint("seed assets", 1);
        emit log_named_uint("attacker shares after seed", attackerShares);
        emit log_named_uint("NAV after seed", pool.lpNav());
        emit log_named_uint("attacker redeemable after seed", pool.previewRedeem(attackerShares));

        vm.prank(attacker);
        usdt.transfer(address(pool), donation);
        uint256 attackerCap = pool.previewRedeem(attackerShares);
        emit log_named_uint("donation assets", donation);
        emit log_named_uint("NAV after donation", pool.lpNav());
        emit log_named_uint("attacker redeemable after donation", attackerCap);
        assertEq(pool.lpNav(), 1 + donation);
        assertLe(attackerCap, 1 + donation, "donation must not become fully attacker-owned");

        uint256 victimShares = _depositLiquidity(victim, victimAssets);
        emit log_named_uint("victim deposit", victimAssets);
        emit log_named_uint("victim shares", victimShares);
        emit log_named_uint("NAV after victim", pool.lpNav());
        emit log_named_uint("attacker redeemable after victim", pool.previewRedeem(attackerShares));
        emit log_named_uint("victim redeemable after deposit", pool.previewRedeem(victimShares));

        assertGt(victimShares, 0, "victim must receive shares");
        assertEq(pool.lpNav(), 1 + donation + victimAssets);
        assertLe(pool.previewRedeem(attackerShares), 1 + donation);
        assertLe(pool.previewRedeem(attackerShares), attackerCap + 1, "victim entry must not inflate attacker claim");
        assertGe(pool.previewRedeem(victimShares), victimAssets - 1);
        assertLe(pool.previewRedeem(victimShares), victimAssets);

        vm.warp(block.timestamp + WITHDRAWAL_COOLDOWN);

        vm.prank(attacker);
        uint256 attackerOut = pool.redeem(attackerShares, 0);
        emit log_named_uint("attacker redeemed (exits first)", attackerOut);
        emit log_named_uint("victim redeemable after attacker exit", pool.previewRedeem(victimShares));

        vm.prank(victim);
        uint256 victimOut = pool.redeem(victimShares, 0);
        emit log_named_uint("victim redeemed after attacker exit", victimOut);

        assertLe(attackerOut, 1 + donation);
        assertLe(attackerOut, attackerCap + 1);
        assertGe(victimOut, victimAssets - 1);
        assertEq(usdt.balanceOf(attacker), attackerOut);
        assertEq(usdt.balanceOf(victim), victimOut);
        assertLt(attackerOut, victimAssets, "attacker exit must not capture victim-sized value");
    }

    /// @notice Same inflation setup, reverse exit: victim redeems first, then attacker.
    function test_FirstDepositorDonationInflationVictimRedeemsFirst() public {
        address attacker = address(0xA77);
        address victim = address(0xb17);
        uint256 seed = 1;
        uint256 donation = 1_000_000e6;
        uint256 victimAssets = 10_000e6;
        usdt.mint(attacker, seed + donation);
        usdt.mint(victim, victimAssets);

        uint256 attackerShares = _depositLiquidity(attacker, seed);
        vm.prank(attacker);
        usdt.transfer(address(pool), donation);
        uint256 attackerRedeemAfterDonation = pool.previewRedeem(attackerShares);
        uint256 victimShares = _depositLiquidity(victim, victimAssets);

        vm.warp(block.timestamp + WITHDRAWAL_COOLDOWN);

        vm.prank(victim);
        uint256 victimOut = pool.redeem(victimShares, 0);
        uint256 attackerRedeemAfterVictimExit = pool.previewRedeem(attackerShares);
        emit log_named_uint("victim redeemed (exits first)", victimOut);
        emit log_named_uint("attacker redeemable after victim exit", attackerRedeemAfterVictimExit);

        vm.prank(attacker);
        uint256 attackerOut = pool.redeem(attackerShares, 0);
        emit log_named_uint("attacker redeemed after victim exit", attackerOut);

        assertGe(victimOut, victimAssets - 1);
        assertLe(victimOut, victimAssets);
        assertLe(attackerOut, seed + donation);
        assertLe(attackerOut, attackerRedeemAfterDonation + 1);
        assertLt(attackerOut, victimAssets);
        assertEq(usdt.balanceOf(victim), victimOut);
        assertEq(usdt.balanceOf(attacker), attackerOut);
    }

    function test_ZeroAssetDepositAndRedeemRevert() public {
        vm.prank(alice);
        vm.expectRevert(bytes("InstantPoolP6: zero assets"));
        pool.deposit(0, 0);

        vm.prank(alice);
        vm.expectRevert(bytes("InstantPoolP6: zero shares"));
        pool.redeem(0, 0);
    }

    // ---- 5: non-transferable shares ----

    function test_TransferAndTransferFromRevertMintBurnWork() public {
        uint256 shares = _depositLiquidity(alice, 1e6);
        vm.prank(alice);
        vm.expectRevert(bytes("InstantPoolP6: transfers disabled"));
        pool.transfer(bob, 1);

        vm.prank(alice);
        pool.approve(bob, 1);
        vm.prank(bob);
        vm.expectRevert(bytes("InstantPoolP6: transfers disabled"));
        pool.transferFrom(alice, bob, 1);

        vm.warp(block.timestamp + WITHDRAWAL_COOLDOWN);
        vm.prank(alice);
        uint256 assets = pool.redeem(shares, 0);
        assertEq(assets, 1e6);
        assertEq(pool.balanceOf(alice), 0);
        assertEq(usdt.balanceOf(alice), 1_000_000e6);
    }

    // ---- 6 / 7 / 8 / 9: cooldown ----

    function test_DepositSetsUnlockNowPlus24h() public {
        uint256 t = block.timestamp;
        _depositLiquidity(alice, 1e6);
        assertEq(pool.withdrawalUnlockAt(alice), t + WITHDRAWAL_COOLDOWN);
    }

    function test_ImmediateRedeemReverts() public {
        uint256 shares = _depositLiquidity(alice, 1e6);
        vm.prank(alice);
        vm.expectRevert(bytes("InstantPoolP6: cooldown"));
        pool.redeem(shares, 0);
    }

    function test_RedeemAfter24hSucceeds() public {
        uint256 shares = _depositLiquidity(alice, FUNDING);
        vm.warp(block.timestamp + WITHDRAWAL_COOLDOWN);
        vm.prank(alice);
        vm.expectEmit(true, false, false, true, address(pool));
        emit NostosInstantPoolP6.LiquidityRedeemed(alice, shares, FUNDING);
        uint256 assets = pool.redeem(shares, 0);
        assertEq(assets, FUNDING);
        assertEq(pool.lpNav(), 0);
        assertEq(pool.availableLiquidity(), 0);
    }

    function test_SecondDepositResetsCooldownForExistingShares() public {
        uint256 first = _depositLiquidity(alice, 1e6);
        vm.warp(block.timestamp + 12 hours);
        uint256 second = _depositLiquidity(alice, 1e6);
        vm.prank(alice);
        vm.expectRevert(bytes("InstantPoolP6: cooldown"));
        pool.redeem(first, 0);
        vm.warp(block.timestamp + WITHDRAWAL_COOLDOWN);
        vm.prank(alice);
        uint256 assets = pool.redeem(first + second, 0);
        assertEq(assets, 2e6);
    }

    function test_DirectUsdtDonationDoesNotAlterCooldown() public {
        _depositLiquidity(alice, 1e6);
        uint64 unlock = pool.withdrawalUnlockAt(alice);
        usdt.mint(address(pool), 50e6);
        assertEq(pool.withdrawalUnlockAt(alice), unlock);
        assertEq(pool.availableLiquidity(), 51e6);
    }

    // ---- 10 / 11 / 12 / 13: NAV accounting ----

    function test_NavEqualsAvailableLiquidityPlusOutstandingCostBasis() public {
        _depositLiquidity(alice, FUNDING);
        assertEq(pool.lpNav(), pool.availableLiquidity() + pool.outstandingCostBasis());
        uint256 requestId = _buyPendingTicket(alice, FACE);
        assertEq(pool.lpNav(), pool.availableLiquidity() + pool.outstandingCostBasis());
        assertEq(pool.lpNav(), FUNDING);
        assertEq(pool.outstandingCostBasis(), _positionCost(requestId));
        assertEq(pool.outstandingFaceValue(), FACE);
    }

    function test_TicketPurchaseLeavesNavUnchanged() public {
        _depositLiquidity(alice, FUNDING);
        uint256 navBefore = pool.lpNav();
        _buyPendingTicket(alice, FACE);
        assertEq(pool.lpNav(), navBefore);
        assertEq(pool.lpNav(), FUNDING);
    }

    function test_PendingSpreadIsNotProfit() public {
        _buyTicketWithLiquidity(alice, FACE);
        assertEq(pool.cumulativeGrossSpread(), 0);
        assertEq(pool.lpRealizedProfit(), 0);
        assertEq(pool.accruedProtocolFees(), 0);
    }

    function test_AccruedProtocolFeesExcludedFromNavAfterHarvest() public {
        uint256 requestId = _buyTicketWithLiquidity(alice, FACE);
        uint256 cost = _positionCost(requestId);
        uint256 spread = FACE - cost;
        uint256 fee = spread * PROTOCOL_FEE_BPS / TEN_THOUSAND;
        uint256 navBefore = pool.lpNav();
        _settle(requestId);
        vm.prank(keeper);
        pool.harvest(requestId);
        assertEq(pool.accruedProtocolFees(), fee);
        assertEq(pool.lpNav(), navBefore + spread - fee);
        assertEq(pool.lpNav(), pool.availableLiquidity() + pool.outstandingCostBasis());
        assertEq(pool.availableLiquidity(), usdt.balanceOf(address(pool)) - fee);
    }

    // ---- 14 / 15 / 16: cost-basis pricing and cash cap ----

    function test_SecondLpDepositWhileClaimPendingUsesCostBasisNav() public {
        _depositLiquidity(alice, FUNDING);
        uint256 aliceShares = pool.balanceOf(alice);
        _buyPendingTicket(alice, FACE);
        uint256 costNav = pool.lpNav();
        uint256 faceNav = pool.availableLiquidity() + pool.outstandingFaceValue();
        assertEq(costNav, FUNDING);
        assertGt(faceNav, costNav);
        uint256 bobShares = _depositLiquidity(bob, FUNDING);
        assertEq(bobShares, aliceShares);
        assertEq(pool.lpNav(), FUNDING * 2);
    }

    function test_RedemptionLimitedByAvailableLiquidityNotPendingClaims() public {
        _depositLiquidity(alice, FUNDING);
        _buyPendingTicket(alice, FACE);
        vm.warp(block.timestamp + WITHDRAWAL_COOLDOWN);
        uint256 shares = pool.balanceOf(alice);
        uint256 preview = pool.previewRedeem(shares);
        assertGt(preview, pool.availableLiquidity());
        vm.prank(alice);
        vm.expectRevert(bytes("InstantPoolP6: insufficient liquidity"));
        pool.redeem(shares, 0);
    }

    function test_MaxRedeemRespectsCashAndCooldown() public {
        _depositLiquidity(alice, FUNDING);
        assertEq(pool.maxRedeem(alice), 0);
        vm.warp(block.timestamp + WITHDRAWAL_COOLDOWN);
        assertEq(pool.maxRedeem(alice), pool.balanceOf(alice));
        _buyPendingTicket(alice, FACE);
        uint256 maxShares = pool.maxRedeem(alice);
        assertLt(maxShares, pool.balanceOf(alice));
        assertGt(maxShares, 0);
        uint256 assetsOut = pool.previewRedeem(maxShares);
        assertLe(assetsOut, pool.availableLiquidity());
        vm.prank(alice);
        pool.redeem(maxShares, 0);
        assertEq(pool.maxRedeem(bob), 0);
    }

    // ---- 17 / 18 / 19 / 20: harvest fee split ----

    function test_HarvestIncreasesNavByExactlyNinetyPercentOfSpread() public {
        uint256 requestId = _buyTicketWithLiquidity(alice, FACE);
        uint256 cost = _positionCost(requestId);
        uint256 spread = FACE - cost;
        uint256 fee = spread * PROTOCOL_FEE_BPS / TEN_THOUSAND;
        uint256 navBefore = pool.lpNav();
        _settle(requestId);
        vm.prank(keeper);
        pool.harvest(requestId);
        assertEq(pool.lpNav() - navBefore, spread - fee);
        assertEq(pool.lpRealizedProfit(), spread - fee);
        assertEq(pool.cumulativeGrossSpread(), spread);
    }

    function test_ExactlyTenPercentOfSpreadAccruesAsProtocolFee() public {
        uint256 requestId = _buyTicketWithLiquidity(alice, FACE);
        uint256 spread = FACE - _positionCost(requestId);
        uint256 fee = spread * PROTOCOL_FEE_BPS / TEN_THOUSAND;
        _settle(requestId);
        vm.prank(keeper);
        pool.harvest(requestId);
        assertEq(pool.accruedProtocolFees(), fee);
        assertEq(pool.cumulativeProtocolFees(), fee);
        assertEq(fee, spread / 10);
        assertEq(spread - fee, spread * 9 / 10);
    }

    function test_FeeClaimCannotTouchLpPrincipal() public {
        uint256 requestId = _buyTicketWithLiquidity(alice, FACE);
        _settle(requestId);
        vm.prank(keeper);
        pool.harvest(requestId);
        uint256 fees = pool.accruedProtocolFees();
        uint256 poolBefore = usdt.balanceOf(address(pool));
        uint256 treasuryBefore = usdt.balanceOf(treasury);
        vm.prank(treasury);
        pool.claimProtocolFees();
        assertEq(usdt.balanceOf(address(pool)), poolBefore - fees);
        assertEq(usdt.balanceOf(treasury), treasuryBefore + fees);
        assertEq(pool.accruedProtocolFees(), 0);
    }

    function test_FeeWithdrawalLeavesLpNavUnchanged() public {
        uint256 requestId = _buyTicketWithLiquidity(alice, FACE);
        _settle(requestId);
        vm.prank(keeper);
        pool.harvest(requestId);
        uint256 navBefore = pool.lpNav();
        uint256 fees = pool.accruedProtocolFees();
        vm.expectEmit(true, false, false, true, address(pool));
        emit NostosInstantPoolP6.ProtocolFeesClaimed(treasury, fees);
        vm.prank(treasury);
        pool.claimProtocolFees();
        assertEq(pool.lpNav(), navBefore);
    }

    // ---- 21: quotes cannot spend fees ----

    function test_QuoteAndSellCannotSpendAccruedProtocolFees() public {
        uint256 requestId = _buyTicketWithLiquidity(alice, FACE);
        _settle(requestId);
        vm.prank(keeper);
        pool.harvest(requestId);

        vm.warp(block.timestamp + WITHDRAWAL_COOLDOWN);
        uint256 liquid = pool.availableLiquidity();
        uint256 leave = 9.1e6;
        uint256 sharesToTake = pool.convertToShares(liquid - leave);
        vm.prank(alice);
        pool.redeem(sharesToTake, 0);

        uint256 available = pool.availableLiquidity();
        uint256 rawBalance = usdt.balanceOf(address(pool));
        uint256 fees = pool.accruedProtocolFees();
        assertGt(fees, 0);
        assertEq(rawBalance, available + fees);
        assertLt(available, 9.4e6);
        assertGe(rawBalance, 9.4e6);

        uint256 newId = _requestFor(bob, 10e6);
        NostosInstantPoolP6.Quote memory q = pool.quoteTicket(newId);
        NostosInstantPoolP6.Quote memory expected = _quoteFor(10e6, available, 0);
        assertEq(q.discountBps, expected.discountBps);
        assertEq(q.amountOut, expected.amountOut);
        assertGt(q.amountOut, available);
        assertLe(q.amountOut, rawBalance);

        vm.prank(bob);
        ticket.approve(address(pool), newId);
        vm.prank(bob);
        vm.expectRevert(bytes("InstantPoolP6: insufficient liquidity"));
        pool.sellTicket(newId, 0);
    }

    // ---- 22 / 23 / 24: P5 purchase rules ----

    function test_PendingOnlyTicketRules() public {
        _buyTicketWithLiquidity(alice, FACE);

        uint256 claimableId = _requestFor(bob, 100e6);
        _settle(claimableId);
        vm.expectRevert(bytes("InstantPoolP6: request not pending"));
        pool.quoteTicket(claimableId);

        vm.prank(bob);
        vault.claimRedeem(claimableId, bob);
        vm.expectRevert();
        pool.quoteTicket(claimableId);

        vm.expectRevert();
        pool.quoteTicket(999);

        uint256 ownedId = 1;
        vm.expectRevert(bytes("InstantPoolP6: ticket already owned by pool"));
        pool.quoteTicket(ownedId);
    }

    function test_MissingApprovalFailsAtomically() public {
        _depositLiquidity(alice, FUNDING);
        uint256 requestId = _requestFor(alice, FACE);
        uint256 liquidBefore = pool.availableLiquidity();
        uint256 outstandingBefore = pool.outstandingFaceValue();
        uint256 aliceUsdt = usdt.balanceOf(alice);
        vm.prank(alice);
        vm.expectRevert();
        pool.sellTicket(requestId, 0);
        assertEq(pool.availableLiquidity(), liquidBefore);
        assertEq(pool.outstandingFaceValue(), outstandingBefore);
        assertEq(ticket.ownerOf(requestId), alice);
        assertEq(usdt.balanceOf(alice), aliceUsdt);
    }

    function test_UnsolicitedSafeTransferFromRejected() public {
        _depositLiquidity(alice, FUNDING);
        uint256 requestId = _requestFor(alice, FACE);
        vm.startPrank(alice);
        ticket.approve(address(pool), requestId);
        vm.expectRevert(bytes("InstantPoolP6: unsolicited ticket"));
        ticket.safeTransferFrom(alice, address(pool), requestId);
        vm.stopPrank();
        assertEq(ticket.ownerOf(requestId), alice);
        assertEq(pool.outstandingFaceValue(), 0);
    }

    function test_PurchaseTransfersTicketAndUsdtAtomically() public {
        _depositLiquidity(alice, FUNDING);
        uint256 requestId = _requestFor(alice, FACE);
        uint256 aliceBefore = usdt.balanceOf(alice);
        vm.prank(alice);
        ticket.approve(address(pool), requestId);
        vm.prank(alice);
        uint256 amountOut = pool.sellTicket(requestId, 0);
        assertTrue(amountOut > 0);
        assertEq(usdt.balanceOf(alice), aliceBefore + amountOut);
        assertEq(ticket.ownerOf(requestId), address(pool));
        assertEq(pool.outstandingFaceValue(), FACE);
        assertEq(pool.outstandingCostBasis(), amountOut);
        assertEq(pool.availableLiquidity(), FUNDING - amountOut);
    }

    function test_QuoteUsesAvailableLiquidityNotRawBalance() public {
        _depositLiquidity(alice, FUNDING);
        uint256 requestId = _requestFor(alice, FACE);
        NostosInstantPoolP6.Quote memory q = pool.quoteTicket(requestId);
        NostosInstantPoolP6.Quote memory expected = _quoteFor(FACE, pool.availableLiquidity(), 0);
        assertEq(q.discountBps, expected.discountBps);
        assertEq(q.amountOut, expected.amountOut);
        assertEq(q.discountBps, 200);
    }

    function test_ZeroLiquidityRevertsQuote() public {
        _requestFor(alice, FACE);
        vm.expectRevert(bytes("InstantPoolP6: no liquid assets"));
        pool.quoteTicket(1);
    }

    // ---- 25 / 26 / 27: harvest isolation and LP proportions ----

    function test_PermissionlessHarvestCannotRedirectFunds() public {
        uint256 requestId = _buyTicketWithLiquidity(alice, FACE);
        _settle(requestId);
        uint256 keeperBefore = usdt.balanceOf(keeper);
        vm.prank(keeper);
        uint256 assets = pool.harvest(requestId);
        assertEq(assets, FACE);
        assertEq(usdt.balanceOf(keeper), keeperBefore);
        assertTrue(_positionStatus(requestId) == NostosInstantPoolP6.Status.Settled);
    }

    function test_MultipleLpsRemainProportionalAfterHarvestProfit() public {
        _depositLiquidity(alice, FUNDING);
        _depositLiquidity(bob, FUNDING);
        uint256 requestId = _buyPendingTicket(alice, FACE);
        _settle(requestId);
        vm.prank(keeper);
        pool.harvest(requestId);
        assertEq(pool.balanceOf(alice), pool.balanceOf(bob));
        assertEq(pool.previewRedeem(pool.balanceOf(alice)), pool.previewRedeem(pool.balanceOf(bob)));
    }

    function test_MultipleTicketPositionsRemainIsolated() public {
        _depositLiquidity(alice, FUNDING);
        uint256 reqA = _buyPendingTicket(alice, FACE);
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
        assertTrue(_positionStatus(reqA) == NostosInstantPoolP6.Status.Settled);
        assertTrue(_positionStatus(reqB) == NostosInstantPoolP6.Status.Active);
        assertEq(ticket.ownerOf(reqB), address(pool));
        assertEq(pool.outstandingFaceValue(), 100e6);
    }

    function test_NoDoubleHarvest() public {
        uint256 requestId = _buyTicketWithLiquidity(alice, FACE);
        _settle(requestId);
        vm.prank(keeper);
        pool.harvest(requestId);
        vm.prank(keeper);
        vm.expectRevert(bytes("InstantPoolP6: no active position"));
        pool.harvest(requestId);
    }

    function test_HarvestBeforeClaimableReverts() public {
        uint256 requestId = _buyTicketWithLiquidity(alice, FACE);
        vm.prank(keeper);
        vm.expectRevert(bytes("InstantPoolP6: not claimable"));
        pool.harvest(requestId);
    }

    // ---- 28: pause ----

    function test_PausedPoolBlocksDepositAndSalePermitsHarvestRedeemAndFeeClaim() public {
        uint256 requestId = _buyTicketWithLiquidity(alice, FACE);
        uint256 extraId = _requestFor(bob, 50e6);
        _settle(requestId);
        vm.prank(pauser);
        pool.pause();

        vm.startPrank(bob);
        usdt.approve(address(pool), 1e6);
        vm.expectRevert();
        pool.deposit(1e6, 0);
        ticket.approve(address(pool), extraId);
        vm.expectRevert();
        pool.sellTicket(extraId, 0);
        vm.stopPrank();

        vm.prank(keeper);
        pool.harvest(requestId);
        assertTrue(_positionStatus(requestId) == NostosInstantPoolP6.Status.Settled);

        vm.warp(block.timestamp + WITHDRAWAL_COOLDOWN);
        uint256 maxShares = pool.maxRedeem(alice);
        vm.prank(alice);
        pool.redeem(maxShares, 0);

        uint256 fees = pool.accruedProtocolFees();
        assertGt(fees, 0);
        vm.prank(treasury);
        pool.claimProtocolFees();
        assertEq(pool.accruedProtocolFees(), 0);
    }

    // ---- 29: no admin principal drain ----

    function test_NoAdminPrincipalDrain() public {
        _depositLiquidity(alice, FUNDING);
        vm.prank(admin);
        (bool okWithdraw,) = address(pool).call(abi.encodeWithSignature("withdrawLiquidity(uint256)", 1e6));
        assertFalse(okWithdraw);
        vm.prank(admin);
        (bool okFund,) = address(pool).call(abi.encodeWithSignature("fund(uint256)", 1e6));
        assertFalse(okFund);
        assertEq(usdt.balanceOf(address(pool)), FUNDING);
        assertEq(usdt.balanceOf(admin), 0);
    }

    function test_MinAmountOutAndMinSharesOutProtection() public {
        vm.startPrank(alice);
        usdt.approve(address(pool), 1e6);
        vm.expectRevert(bytes("InstantPoolP6: slippage"));
        pool.deposit(1e6, type(uint256).max);
        vm.stopPrank();

        _depositLiquidity(alice, FUNDING);
        uint256 requestId = _requestFor(alice, FACE);
        vm.prank(alice);
        ticket.approve(address(pool), requestId);
        vm.prank(alice);
        vm.expectRevert(bytes("InstantPoolP6: slippage"));
        pool.sellTicket(requestId, type(uint256).max);
    }

    function test_SellerMustOwnTicket() public {
        _depositLiquidity(alice, FUNDING);
        uint256 requestId = _requestFor(alice, FACE);
        vm.prank(bob);
        vm.expectRevert(bytes("InstantPoolP6: seller does not own ticket"));
        pool.sellTicket(requestId, 0);
    }

    function test_SetPricingBounds() public {
        vm.prank(admin);
        vm.expectRevert(bytes("InstantPoolP6: min > max"));
        pool.setPricing(100, 1_000, 500, 200, 100, 9_000);

        vm.prank(admin);
        vm.expectRevert(bytes("InstantPoolP6: base out of bounds"));
        pool.setPricing(50, 1_000, 500, 100, 3_000, 9_000);

        vm.prank(admin);
        vm.expectRevert(bytes("InstantPoolP6: max discount exceeds 100%"));
        pool.setPricing(100, 1_000, 500, 0, 10_001, 9_000);

        vm.prank(admin);
        vm.expectRevert(bytes("InstantPoolP6: bad max utilization"));
        pool.setPricing(100, 1_000, 500, 0, 3_000, 0);
    }

    function test_UtilizationBpsUsesAvailableLiquidity() public {
        _depositLiquidity(alice, FUNDING);
        assertEq(pool.utilizationBps(), 0);
        _buyPendingTicket(alice, FACE);
        uint256 denom = pool.availableLiquidity() + pool.outstandingFaceValue();
        assertEq(pool.utilizationBps(), FACE * TEN_THOUSAND / denom);
    }

    // ---- helpers ----

    function _positionCost(uint256 ticketId) internal view returns (uint256) {
        (,,,, uint256 cost,,,,) = pool.positions(ticketId);
        return cost;
    }

    function _positionStatus(uint256 ticketId) internal view returns (NostosInstantPoolP6.Status) {
        (,,,,,,,, NostosInstantPoolP6.Status status) = pool.positions(ticketId);
        return status;
    }

    function _depositLiquidity(address who, uint256 assets) internal returns (uint256 shares) {
        vm.startPrank(who);
        usdt.approve(address(pool), assets);
        shares = pool.deposit(assets, 0);
        vm.stopPrank();
        assertGt(shares, 0);
    }

    function _buyPendingTicket(address seller, uint256 face) internal returns (uint256 requestId) {
        requestId = _requestFor(seller, face);
        vm.prank(seller);
        ticket.approve(address(pool), requestId);
        vm.prank(seller);
        uint256 amountOut = pool.sellTicket(requestId, 0);
        assertTrue(amountOut > 0);
    }

    function _buyTicketWithLiquidity(address who, uint256 face) internal returns (uint256 requestId) {
        _depositLiquidity(who, FUNDING);
        requestId = _buyPendingTicket(who, face);
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
        returns (NostosInstantPoolP6.Quote memory q)
    {
        uint256 denom = liquid + outstanding;
        q.faceValue = faceValue;
        q.utilizationBps = outstanding == 0 ? 0 : outstanding * TEN_THOUSAND / denom;
        q.sizeRatioBps = liquid == 0 ? TEN_THOUSAND : faceValue * TEN_THOUSAND / liquid;
        NostosInstantPoolP6.Pricing memory p = pool.getPricing();
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
