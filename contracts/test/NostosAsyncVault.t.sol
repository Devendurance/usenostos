// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {NostosAsyncVault} from "../src/NostosAsyncVault.sol";
import {IERC7540} from "../src/interfaces/IERC7540.sol";
import {IERC7575} from "../src/interfaces/IERC7575.sol";

contract MockUSDT is ERC20 {
    constructor() ERC20("Tether USD", "USDT") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function decimals() public pure override returns (uint8) {
        return 6;
    }
}

contract NostosAsyncVaultTest is Test {
    MockUSDT usdt;
    NostosAsyncVault vault;
    address admin = address(0xaD00);
    address settler = address(0x5E77);
    address alice = address(0xa11ce);
    address bob = address(0xb0b);
    address carol = address(0xca11);
    address stranger = address(0x5e11);

    function setUp() public {
        usdt = new MockUSDT();
        vm.startPrank(admin);
        vault = new NostosAsyncVault(usdt);
        vault.grantRole(vault.SETTLER_ROLE(), settler);
        vm.stopPrank();
        usdt.mint(alice, 1_000_000e6);
        usdt.mint(bob, 1_000_000e6);
    }

    // ---- Deposit / accounting ----

    function test_DepositAccounting() public {
        vm.startPrank(alice);
        usdt.approve(address(vault), 10_000e6);
        uint256 shares = vault.deposit(10_000e6, alice);
        assertEq(shares, 10_000e6, "1 USDT = 1 share at inception");
        assertEq(vault.balanceOf(alice), 10_000e6);
        assertEq(vault.totalAssets(), 10_000e6);
        assertEq(vault.totalSupply(), 10_000e6);
        vm.stopPrank();
    }

    function test_ShareDecimalsMatchUnderlying() public view {
        assertEq(vault.decimals(), 6);
    }

    function test_ShareGetter() public view {
        assertEq(vault.share(), address(vault));
    }

    // ---- Request ----

    function test_RequestRedeemLocksShares() public {
        uint256 deposit = 5_000e6;
        vm.startPrank(alice);
        usdt.approve(address(vault), deposit);
        vault.deposit(deposit, alice);
        uint256 requestId = vault.requestRedeem(deposit, alice, alice);
        assertGt(requestId, 0, "non-zero request id");
        assertEq(vault.activeRequestId(alice), requestId);
        assertEq(vault.balanceOf(alice), 0, "shares leave owner custody");
        assertEq(vault.balanceOf(address(vault)), deposit, "shares locked in vault");
        IERC7540.RedeemRequestData memory pending = vault.pendingRedeemRequest(requestId, alice);
        assertEq(pending.shares, deposit);
        vm.stopPrank();
    }

    function test_RequestIdsAreIncrementing() public {
        vm.startPrank(alice);
        usdt.approve(address(vault), 20_000e6);
        vault.deposit(10_000e6, alice);
        uint256 first = vault.requestRedeem(10_000e6, alice, alice);
        vm.stopPrank();
        // alice has an active request; use bob for the second.
        vm.startPrank(bob);
        usdt.approve(address(vault), 10_000e6);
        vault.deposit(10_000e6, bob);
        uint256 second = vault.requestRedeem(10_000e6, bob, bob);
        vm.stopPrank();
        assertEq(second, first + 1);
    }

    function test_ZeroSharesRejected() public {
        vm.startPrank(alice);
        usdt.approve(address(vault), 5_000e6);
        vault.deposit(5_000e6, alice);
        vm.expectRevert(bytes("NostosAsyncVault: zero shares"));
        vault.requestRedeem(0, alice, alice);
        vm.stopPrank();
    }

    function test_OneActiveRequestPerController() public {
        vm.startPrank(alice);
        usdt.approve(address(vault), 20_000e6);
        vault.deposit(10_000e6, alice);
        vault.requestRedeem(10_000e6, alice, alice);
        vm.expectRevert(bytes("NostosAsyncVault: active request exists"));
        vault.requestRedeem(10_000e6, alice, alice);
        vm.stopPrank();
    }

    function test_OperatorCanRequestForController() public {
        vm.startPrank(alice);
        vault.setOperator(stranger, true);
        usdt.approve(address(vault), 5_000e6);
        vault.deposit(5_000e6, alice);
        vm.stopPrank();
        vm.prank(stranger);
        uint256 requestId = vault.requestRedeem(5_000e6, alice, alice);
        assertGt(requestId, 0);
        assertEq(vault.activeRequestId(alice), requestId);
    }

    function test_UnauthorizedOperatorCannotRequest() public {
        vm.startPrank(alice);
        usdt.approve(address(vault), 5_000e6);
        vault.deposit(5_000e6, alice);
        vm.stopPrank();
        vm.prank(stranger);
        vm.expectRevert(bytes("NostosAsyncVault: unauthorized"));
        vault.requestRedeem(5_000e6, alice, alice);
    }

    // ---- Operators ----

    function test_OperatorGrantRevoke() public {
        vm.startPrank(alice);
        assertTrue(vault.setOperator(stranger, true));
        assertTrue(vault.isOperator(alice, stranger));
        vault.setOperator(stranger, false);
        assertFalse(vault.isOperator(alice, stranger));
        vm.stopPrank();
    }

    function test_OperatorSetEventEmitted() public {
        vm.startPrank(alice);
        vm.expectEmit(true, true, true, true);
        emit IERC7540.OperatorSet(alice, stranger, true);
        vault.setOperator(stranger, true);
        vm.stopPrank();
    }

    // ---- Settlement ----

    function test_UnauthorizedSettlerFails() public {
        vm.startPrank(alice);
        usdt.approve(address(vault), 5_000e6);
        vault.deposit(5_000e6, alice);
        uint256 requestId = vault.requestRedeem(5_000e6, alice, alice);
        vm.stopPrank();
        vm.prank(stranger);
        vm.expectRevert();
        vault.settleRequest(requestId);
    }

    function test_PendingToClaimableSuccessAndReservedAccounting() public {
        uint256 deposit = 5_000e6;
        vm.startPrank(alice);
        usdt.approve(address(vault), deposit);
        vault.deposit(deposit, alice);
        uint256 requestId = vault.requestRedeem(deposit, alice, alice);
        vm.stopPrank();

        vm.prank(settler);
        uint256 assets = vault.settleRequest(requestId);
        assertEq(assets, deposit, "1:1 demo rate");
        assertEq(vault.reservedClaimableAssets(), deposit);

        IERC7540.RedeemRequestData memory claimable = vault.claimableRedeemRequest(requestId, alice);
        assertEq(claimable.assets, deposit);
        assertEq(claimable.shares, deposit);
    }

    function test_SettleUnknownAndAlreadySettledRejected() public {
        vm.prank(settler);
        vm.expectRevert(bytes("NostosAsyncVault: unknown request"));
        vault.settleRequest(1);

        vm.startPrank(alice);
        usdt.approve(address(vault), 5_000e6);
        vault.deposit(5_000e6, alice);
        uint256 requestId = vault.requestRedeem(5_000e6, alice, alice);
        vm.stopPrank();
        vm.prank(settler);
        vault.settleRequest(requestId);
        vm.prank(settler);
        vm.expectRevert(bytes("NostosAsyncVault: not pending"));
        vault.settleRequest(requestId);
    }

    function test_ReservedNeverExceedsVaultBalance_MultiUser() public {
        // Heavy multi-user flow; assert the core invariant at each step.
        vm.startPrank(alice);
        usdt.approve(address(vault), 4_000e6);
        vault.deposit(4_000e6, alice);
        uint256 reqA = vault.requestRedeem(4_000e6, alice, alice);
        vm.stopPrank();
        vm.startPrank(bob);
        usdt.approve(address(vault), 6_000e6);
        vault.deposit(6_000e6, bob);
        uint256 reqB = vault.requestRedeem(6_000e6, bob, bob);
        vm.stopPrank();

        vm.startPrank(settler);
        vault.settleRequest(reqA);
        assertLe(vault.reservedClaimableAssets(), usdt.balanceOf(address(vault)));
        vault.settleRequest(reqB);
        assertLe(vault.reservedClaimableAssets(), usdt.balanceOf(address(vault)));
        vm.stopPrank();

        assertEq(vault.reservedClaimableAssets(), 10_000e6);

        vm.prank(alice);
        vault.redeem(4_000e6, alice, alice);
        vm.prank(bob);
        vault.redeem(6_000e6, bob, bob);
        assertEq(vault.reservedClaimableAssets(), 0);
        assertLe(vault.reservedClaimableAssets(), usdt.balanceOf(address(vault)));
        assertEq(usdt.balanceOf(alice), 1_000_000e6);
        assertEq(usdt.balanceOf(bob), 1_000_000e6);
    }

    // ---- Claim ----

    function test_PendingCannotRedeem() public {
        vm.startPrank(alice);
        usdt.approve(address(vault), 5_000e6);
        vault.deposit(5_000e6, alice);
        vault.requestRedeem(5_000e6, alice, alice);
        vm.expectRevert(bytes("NostosAsyncVault: not claimable"));
        vault.redeem(5_000e6, alice, alice);
        vm.stopPrank();
    }

    function test_ClaimTransfersAssetsAndBurnsShares() public {
        uint256 deposit = 4_000e6;
        vm.startPrank(alice);
        usdt.approve(address(vault), deposit);
        vault.deposit(deposit, alice);
        uint256 requestId = vault.requestRedeem(deposit, alice, alice);
        vm.stopPrank();
        vm.prank(settler);
        vault.settleRequest(requestId);

        uint256 before = usdt.balanceOf(alice);
        vm.startPrank(alice);
        uint256 assets = vault.redeem(deposit, alice, alice);
        assertEq(assets, deposit);
        vm.stopPrank();

        assertEq(usdt.balanceOf(alice), before + deposit, "USDT returned");
        assertEq(vault.balanceOf(address(vault)), 0, "locked shares burned");
        assertEq(vault.totalSupply(), 0);
        assertEq(vault.reservedClaimableAssets(), 0);
        // claimed request is consumed
        vm.expectRevert(bytes("NostosAsyncVault: no active request"));
        vm.prank(alice);
        vault.redeem(deposit, alice, alice);
    }

    function test_WithdrawPathClaimsByAssets() public {
        uint256 deposit = 3_000e6;
        vm.startPrank(alice);
        usdt.approve(address(vault), deposit);
        vault.deposit(deposit, alice);
        uint256 requestId = vault.requestRedeem(deposit, alice, alice);
        vm.stopPrank();
        vm.prank(settler);
        vault.settleRequest(requestId);
        vm.prank(alice);
        uint256 shares = vault.withdraw(deposit, alice, alice);
        assertEq(shares, deposit);
        assertEq(usdt.balanceOf(alice), 1_000_000e6);
    }

    function test_DoubleClaimRejected() public {
        uint256 deposit = 3_000e6;
        vm.startPrank(alice);
        usdt.approve(address(vault), deposit);
        vault.deposit(deposit, alice);
        vault.requestRedeem(deposit, alice, alice);
        vm.stopPrank();
        uint256 requestId = vault.activeRequestId(alice);
        vm.prank(settler);
        vault.settleRequest(requestId);
        vm.startPrank(alice);
        vault.redeem(deposit, alice, alice);
        vm.expectRevert(bytes("NostosAsyncVault: no active request"));
        vault.redeem(deposit, alice, alice);
        vm.stopPrank();
    }

    function test_UnauthorizedCannotClaimForController() public {
        uint256 deposit = 3_000e6;
        vm.startPrank(alice);
        usdt.approve(address(vault), deposit);
        vault.deposit(deposit, alice);
        uint256 requestId = vault.requestRedeem(deposit, alice, alice);
        vm.stopPrank();
        vm.prank(settler);
        vault.settleRequest(requestId);
        vm.prank(stranger);
        vm.expectRevert(bytes("NostosAsyncVault: not an operator"));
        vault.redeem(deposit, alice, alice);
    }

    function test_ClaimCannotExceedClaimableShares() public {
        uint256 deposit = 3_000e6;
        vm.startPrank(alice);
        usdt.approve(address(vault), deposit);
        vault.deposit(deposit, alice);
        vault.requestRedeem(deposit, alice, alice);
        vm.stopPrank();
        uint256 requestId = vault.activeRequestId(alice);
        vm.prank(settler);
        vault.settleRequest(requestId);
        vm.prank(alice);
        vm.expectRevert(bytes("NostosAsyncVault: partial claim unsupported"));
        vault.redeem(deposit - 1, alice, alice);
    }

    // ---- Misc ----

    function test_PreviewReverts() public {
        vm.expectRevert();
        vault.previewRedeem(1);
        vm.expectRevert();
        vault.previewWithdraw(1);
    }

    function test_SupportsInterfaceIds() public {
        assertTrue(vault.supportsInterface(type(IERC7540).interfaceId));
        assertTrue(vault.supportsInterface(type(IERC7575).interfaceId));
        assertTrue(vault.supportsInterface(0x01ffc9a7)); // ERC165
        assertFalse(vault.supportsInterface(0xffffffff));
    }

    function test_PauseBlocksDepositAndRequestButNotClaim() public {
        uint256 deposit = 3_000e6;
        vm.startPrank(alice);
        usdt.approve(address(vault), deposit);
        vault.deposit(deposit, alice);
        uint256 requestId = vault.requestRedeem(deposit, alice, alice);
        vm.stopPrank();
        vm.prank(settler);
        vault.settleRequest(requestId);

        vm.prank(admin);
        vault.pause();

        // deposit blocked
        vm.startPrank(bob);
        usdt.approve(address(vault), deposit);
        vm.expectRevert();
        vault.deposit(deposit, bob);
        // request blocked
        vm.expectRevert();
        vault.requestRedeem(deposit, bob, bob);
        vm.stopPrank();

        // claim still allowed (already-claimable funds are not trapped)
        vm.prank(alice);
        vault.redeem(deposit, alice, alice);
        assertEq(usdt.balanceOf(alice), 1_000_000e6);
    }
}