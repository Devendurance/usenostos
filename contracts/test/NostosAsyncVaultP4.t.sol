// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {IERC721Receiver} from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import {NostosAsyncVaultP4} from "../src/NostosAsyncVaultP4.sol";
import {NostosRedemptionTicket} from "../src/NostosRedemptionTicket.sol";
import {IERC7540} from "../src/interfaces/IERC7540.sol";
import {IERC7575} from "../src/interfaces/IERC7575.sol";

contract P4MockUSDT is ERC20 {
    constructor() ERC20("Tether USD", "USDT") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function decimals() public pure override returns (uint8) {
        return 6;
    }
}

contract P4ERC721Receiver is IERC721Receiver {
    bool public received;

    function onERC721Received(address, address, uint256, bytes calldata) external returns (bytes4) {
        received = true;
        return IERC721Receiver.onERC721Received.selector;
    }
}

contract P4InvalidERC721Receiver {}

contract NostosAsyncVaultP4Test is Test {
    uint256 internal constant DEPOSIT = 5_000e6;

    P4MockUSDT internal usdt;
    NostosAsyncVaultP4 internal vault;
    NostosRedemptionTicket internal ticket;

    address internal admin = address(0xaD00);
    address internal settler = address(0x5E77);
    address internal alice = address(0xa11ce);
    address internal bob = address(0xb0b);
    address internal carol = address(0xca11);
    address internal stranger = address(0x5e11);

    function setUp() public {
        usdt = new P4MockUSDT();

        vm.startPrank(admin);
        vault = new NostosAsyncVaultP4(IERC20(address(usdt)));
        vault.grantRole(vault.SETTLER_ROLE(), settler);
        ticket = new NostosRedemptionTicket(address(vault));
        vault.configureRedemptionTicket(address(ticket));
        vm.stopPrank();

        usdt.mint(alice, 1_000_000e6);
        usdt.mint(bob, 1_000_000e6);
        usdt.mint(carol, 1_000_000e6);
    }

    // ---- P3-compatible surface ----

    function test_ShareDecimalsAndGetterRemainP3Compatible() public view {
        assertEq(vault.decimals(), 6);
        assertEq(vault.share(), address(vault));
    }

    function test_PreviewRedeemAndWithdrawRevertForAsyncVault() public {
        vm.expectRevert(bytes("NostosAsyncVault: async redemption; no preview"));
        vault.previewRedeem(1);
        vm.expectRevert(bytes("NostosAsyncVault: async redemption; no preview"));
        vault.previewWithdraw(1);
    }

    function test_SupportsP3InterfacesAndERC165() public view {
        assertTrue(vault.supportsInterface(type(IERC7540).interfaceId));
        assertTrue(vault.supportsInterface(type(IERC7575).interfaceId));
        assertTrue(vault.supportsInterface(type(IERC165).interfaceId));
        assertFalse(vault.supportsInterface(0xffffffff));
    }

    // ---- Configuration and request creation ----

    function test_RequestRevertsBeforeTicketConfiguration() public {
        NostosAsyncVaultP4 unconfigured = _newUnconfiguredVault();
        _depositInto(unconfigured, alice, DEPOSIT);

        vm.prank(alice);
        vm.expectRevert(bytes("NostosAsyncVaultP4: ticket not configured"));
        unconfigured.requestRedeem(DEPOSIT, alice, alice);

        assertEq(unconfigured.balanceOf(alice), DEPOSIT, "shares stay with owner");
        assertEq(unconfigured.balanceOf(address(unconfigured)), 0, "shares were not locked");
        assertEq(unconfigured.nextRequestId(), 1, "request id was not consumed");
        assertEq(unconfigured.requestController(1), address(0));
        assertEq(unconfigured.activeRequestId(alice), 0);
    }

    function test_ConfigurationBindsTicketOnce() public {
        NostosAsyncVaultP4 candidate = _newUnconfiguredVault();
        NostosRedemptionTicket wrongTicket = new NostosRedemptionTicket(address(0xBEEF));

        vm.prank(admin);
        vm.expectRevert(bytes("NostosAsyncVaultP4: zero ticket"));
        candidate.configureRedemptionTicket(address(0));

        vm.prank(admin);
        vm.expectRevert(bytes("NostosAsyncVaultP4: wrong ticket vault"));
        candidate.configureRedemptionTicket(address(wrongTicket));

        NostosRedemptionTicket boundTicket = new NostosRedemptionTicket(address(candidate));
        vm.expectEmit(true, false, false, true, address(candidate));
        emit NostosAsyncVaultP4.RedemptionTicketConfigured(address(boundTicket));
        vm.prank(admin);
        candidate.configureRedemptionTicket(address(boundTicket));

        assertEq(candidate.redemptionTicket(), address(boundTicket));
        assertEq(boundTicket.vault(), address(candidate));

        vm.prank(admin);
        vm.expectRevert(bytes("NostosAsyncVaultP4: ticket configured"));
        candidate.configureRedemptionTicket(address(ticket));

        vm.prank(stranger);
        vm.expectRevert();
        candidate.configureRedemptionTicket(address(boundTicket));
    }

    function test_RequestRejectsZeroController() public {
        _depositInto(vault, alice, DEPOSIT);

        vm.prank(alice);
        vm.expectRevert(bytes("NostosAsyncVaultP4: zero controller"));
        vault.requestRedeem(DEPOSIT, address(0), alice);

        assertEq(vault.balanceOf(alice), DEPOSIT);
        assertEq(vault.balanceOf(address(vault)), 0);
        assertEq(vault.nextRequestId(), 1);
        assertEq(vault.activeRequestId(address(0)), 0);
    }

    function test_RequestMintsTicketWithRequestId() public {
        uint256 requestId = _depositAndRequest(alice, alice, DEPOSIT);

        assertEq(requestId, 1);
        assertEq(ticket.ownerOf(requestId), alice);
        assertEq(vault.redemptionTicket(), address(ticket));
        assertEq(vault.requestController(requestId), alice);
        assertEq(vault.activeRequestId(alice), requestId);
        assertEq(vault.balanceOf(alice), 0);
        assertEq(vault.balanceOf(address(vault)), DEPOSIT);
        assertEq(vault.reservedClaimableAssets(), 0);
        _assertRequest(requestId, alice, alice, DEPOSIT, 0, NostosAsyncVaultP4.RequestStatus.Pending);
    }

    function test_RequestMintFailureRevertsShareLockAndRequest() public {
        P4InvalidERC721Receiver invalidReceiver = new P4InvalidERC721Receiver();
        _depositInto(vault, alice, DEPOSIT);

        vm.prank(alice);
        vm.expectRevert();
        vault.requestRedeem(DEPOSIT, address(invalidReceiver), alice);

        assertEq(vault.balanceOf(alice), DEPOSIT, "share lock rolled back");
        assertEq(vault.balanceOf(address(vault)), 0, "vault share balance rolled back");
        assertEq(vault.nextRequestId(), 1, "request id rolled back");
        assertEq(vault.requestController(1), address(0), "request mapping rolled back");
        assertEq(vault.activeRequestId(address(invalidReceiver)), 0);
        vm.expectRevert();
        ticket.ownerOf(1);
    }

    function test_PendingTicketTransfersWithoutChangingRequest() public {
        uint256 requestId = _depositAndRequest(alice, alice, DEPOSIT);

        vm.prank(alice);
        ticket.transferFrom(alice, bob, requestId);

        assertEq(ticket.ownerOf(requestId), bob);
        assertEq(vault.activeRequestId(alice), requestId);
        assertEq(vault.balanceOf(address(vault)), DEPOSIT);
        assertEq(vault.reservedClaimableAssets(), 0);
        _assertRequest(requestId, alice, alice, DEPOSIT, 0, NostosAsyncVaultP4.RequestStatus.Pending);

        IERC7540.RedeemRequestData memory pending = vault.pendingRedeemRequest(requestId, alice);
        assertEq(pending.sender, alice, "sender retains provenance");
        assertEq(pending.owner, bob, "owner follows ticket");
        assertEq(pending.shares, DEPOSIT);
        assertEq(pending.assets, 0);
    }

    function test_ClaimableTicketTransfersWithoutChangingSettlement() public {
        uint256 requestId = _depositAndRequest(alice, alice, DEPOSIT);
        _settle(requestId);

        assertEq(vault.reservedClaimableAssets(), DEPOSIT);
        vm.prank(alice);
        ticket.transferFrom(alice, bob, requestId);

        assertEq(ticket.ownerOf(requestId), bob);
        assertEq(vault.activeRequestId(alice), requestId);
        assertEq(vault.balanceOf(address(vault)), DEPOSIT);
        assertEq(vault.reservedClaimableAssets(), DEPOSIT);
        _assertRequest(requestId, alice, alice, DEPOSIT, DEPOSIT, NostosAsyncVaultP4.RequestStatus.Claimable);

        IERC7540.RedeemRequestData memory claimable = vault.claimableRedeemRequest(requestId, alice);
        assertEq(claimable.sender, alice, "sender retains provenance");
        assertEq(claimable.owner, bob, "owner follows ticket");
        assertEq(claimable.shares, DEPOSIT);
        assertEq(claimable.assets, DEPOSIT);
    }

    // ---- Dynamic ticket authorization ----

    function test_AliceCannotClaimAfterTransferToBob() public {
        uint256 requestId = _depositAndRequest(alice, alice, DEPOSIT);
        _settle(requestId);
        vm.prank(alice);
        ticket.transferFrom(alice, bob, requestId);

        vm.prank(alice);
        vm.expectRevert(bytes("NostosAsyncVaultP4: not ticket authorized"));
        vault.claimRedeem(requestId, alice);

        uint256 bobBalanceBefore = usdt.balanceOf(bob);
        vm.prank(bob);
        uint256 assets = vault.claimRedeem(requestId, bob);

        assertEq(assets, DEPOSIT);
        assertEq(usdt.balanceOf(bob), bobBalanceBefore + DEPOSIT);
        assertEq(vault.activeRequestId(alice), 0);
        assertEq(vault.balanceOf(address(vault)), 0);
        assertEq(vault.reservedClaimableAssets(), 0);
        _assertRequest(requestId, alice, alice, DEPOSIT, DEPOSIT, NostosAsyncVaultP4.RequestStatus.Claimed);
        vm.expectRevert();
        ticket.ownerOf(requestId);
    }

    function test_CurrentTicketOwnerCanClaim() public {
        uint256 requestId = _depositAndRequest(alice, alice, DEPOSIT);
        _settle(requestId);

        uint256 carolBalanceBefore = usdt.balanceOf(carol);
        vm.prank(alice);
        uint256 assets = vault.claimRedeem(requestId, carol);

        assertEq(assets, DEPOSIT);
        assertEq(usdt.balanceOf(carol), carolBalanceBefore + DEPOSIT);
        assertEq(vault.activeRequestId(alice), 0);
        assertEq(vault.balanceOf(address(vault)), 0);
        assertEq(vault.reservedClaimableAssets(), 0);
        _assertRequest(requestId, alice, alice, DEPOSIT, DEPOSIT, NostosAsyncVaultP4.RequestStatus.Claimed);
        vm.expectRevert();
        ticket.ownerOf(requestId);
    }

    function test_ApprovedTicketOperatorCanClaim() public {
        uint256 requestId = _depositAndRequest(alice, alice, DEPOSIT);
        _settle(requestId);

        vm.prank(alice);
        ticket.approve(bob, requestId);
        assertEq(ticket.getApproved(requestId), bob);

        vm.prank(bob);
        uint256 assets = vault.claimRedeem(requestId, carol);

        assertEq(assets, DEPOSIT);
        assertEq(vault.activeRequestId(alice), 0);
        assertEq(vault.reservedClaimableAssets(), 0);
        assertEq(vault.balanceOf(address(vault)), 0);
        _assertRequest(requestId, alice, alice, DEPOSIT, DEPOSIT, NostosAsyncVaultP4.RequestStatus.Claimed);
    }

    function test_ERC721ApprovalForAllOperatorCanClaim() public {
        uint256 requestId = _depositAndRequest(alice, alice, DEPOSIT);
        _settle(requestId);

        vm.prank(alice);
        ticket.setApprovalForAll(bob, true);
        assertTrue(ticket.isApprovedForAll(alice, bob));

        vm.prank(bob);
        uint256 assets = vault.claimRedeem(requestId, carol);

        assertEq(assets, DEPOSIT);
        assertEq(vault.activeRequestId(alice), 0);
        assertEq(vault.reservedClaimableAssets(), 0);
        assertEq(vault.balanceOf(address(vault)), 0);
    }

    function test_ERC7540OperatorWithoutTicketApprovalCannotClaim() public {
        _depositInto(vault, alice, DEPOSIT);

        vm.prank(alice);
        vault.setOperator(bob, true);
        assertTrue(vault.isOperator(alice, bob));

        vm.prank(bob);
        uint256 requestId = vault.requestRedeem(DEPOSIT, alice, alice);
        _settle(requestId);

        vm.prank(bob);
        vm.expectRevert(bytes("NostosAsyncVaultP4: not ticket authorized"));
        vault.claimRedeem(requestId, bob);

        assertEq(ticket.ownerOf(requestId), alice);
        assertEq(vault.activeRequestId(alice), requestId);
        assertEq(vault.reservedClaimableAssets(), DEPOSIT);
        assertEq(vault.balanceOf(address(vault)), DEPOSIT);
    }

    function test_UnauthorizedWalletCannotClaim() public {
        uint256 requestId = _depositAndRequest(alice, alice, DEPOSIT);
        _settle(requestId);

        vm.prank(stranger);
        vm.expectRevert(bytes("NostosAsyncVaultP4: not ticket authorized"));
        vault.claimRedeem(requestId, stranger);

        assertEq(ticket.ownerOf(requestId), alice);
        assertEq(vault.activeRequestId(alice), requestId);
        assertEq(vault.reservedClaimableAssets(), DEPOSIT);
        assertEq(vault.balanceOf(address(vault)), DEPOSIT);
    }

    function test_ClaimBurnsTicketAndPreventsDoubleClaim() public {
        uint256 requestId = _depositAndRequest(alice, alice, DEPOSIT);
        _settle(requestId);

        vm.prank(alice);
        vault.claimRedeem(requestId, alice);

        vm.expectRevert();
        ticket.ownerOf(requestId);
        assertEq(vault.activeRequestId(alice), 0);
        assertEq(vault.balanceOf(address(vault)), 0);
        assertEq(vault.reservedClaimableAssets(), 0);
        _assertRequest(requestId, alice, alice, DEPOSIT, DEPOSIT, NostosAsyncVaultP4.RequestStatus.Claimed);

        vm.prank(alice);
        vm.expectRevert(bytes("NostosAsyncVaultP4: not claimable"));
        vault.claimRedeem(requestId, alice);
    }

    // ---- Settlement and accounting ----

    function test_ReservedLiquidityInvariantSurvivesTransferAndClaim() public {
        uint256 aliceShares = 4_000e6;
        uint256 bobShares = 6_000e6;
        uint256 requestA = _depositAndRequest(alice, alice, aliceShares);
        uint256 requestB = _depositAndRequest(bob, bob, bobShares);

        _settle(requestA);
        assertLe(vault.reservedClaimableAssets(), usdt.balanceOf(address(vault)));
        _settle(requestB);
        assertEq(vault.reservedClaimableAssets(), aliceShares + bobShares);
        assertLe(vault.reservedClaimableAssets(), usdt.balanceOf(address(vault)));

        vm.prank(alice);
        ticket.transferFrom(alice, carol, requestA);
        assertEq(vault.reservedClaimableAssets(), aliceShares + bobShares);
        assertEq(vault.balanceOf(address(vault)), aliceShares + bobShares);

        vm.prank(carol);
        vault.claimRedeem(requestA, carol);
        assertEq(vault.reservedClaimableAssets(), bobShares);
        assertEq(vault.balanceOf(address(vault)), bobShares);
        assertLe(vault.reservedClaimableAssets(), usdt.balanceOf(address(vault)));
        _assertRequest(requestA, alice, alice, aliceShares, aliceShares, NostosAsyncVaultP4.RequestStatus.Claimed);
        _assertRequest(requestB, bob, bob, bobShares, bobShares, NostosAsyncVaultP4.RequestStatus.Claimable);

        vm.prank(bob);
        vault.claimRedeem(requestB, bob);
        assertEq(vault.reservedClaimableAssets(), 0);
        assertEq(vault.balanceOf(address(vault)), 0);
        assertLe(vault.reservedClaimableAssets(), usdt.balanceOf(address(vault)));
        assertEq(vault.activeRequestId(alice), 0);
        assertEq(vault.activeRequestId(bob), 0);
    }

    function test_MultiUserClaimsDoNotCrossRequests() public {
        uint256 aliceShares = 2_000e6;
        uint256 bobShares = 3_000e6;
        uint256 requestA = _depositAndRequest(alice, alice, aliceShares);
        uint256 requestB = _depositAndRequest(bob, bob, bobShares);
        _settle(requestA);
        _settle(requestB);

        vm.prank(alice);
        vault.claimRedeem(requestA, carol);

        assertEq(vault.activeRequestId(alice), 0);
        assertEq(vault.activeRequestId(bob), requestB);
        assertEq(vault.reservedClaimableAssets(), bobShares);
        assertEq(ticket.ownerOf(requestB), bob);
        _assertRequest(requestB, bob, bob, bobShares, bobShares, NostosAsyncVaultP4.RequestStatus.Claimable);

        vm.prank(bob);
        vault.claimRedeem(requestB, bob);
        assertEq(vault.activeRequestId(bob), 0);
        assertEq(vault.reservedClaimableAssets(), 0);
    }

    function test_PauseDoesNotTrapClaimableRequest() public {
        uint256 requestId = _depositAndRequest(alice, alice, DEPOSIT);
        _settle(requestId);

        vm.prank(admin);
        vault.pause();

        vm.startPrank(bob);
        usdt.approve(address(vault), DEPOSIT);
        vm.expectRevert();
        vault.deposit(DEPOSIT, bob);
        vm.expectRevert();
        vault.requestRedeem(DEPOSIT, bob, bob);
        vm.stopPrank();

        vm.prank(alice);
        vault.claimRedeem(requestId, alice);
        assertEq(vault.activeRequestId(alice), 0);
        assertEq(vault.reservedClaimableAssets(), 0);
        assertEq(vault.balanceOf(address(vault)), 0);
        _assertRequest(requestId, alice, alice, DEPOSIT, DEPOSIT, NostosAsyncVaultP4.RequestStatus.Claimed);
    }

    // ---- Receiver and claim-wrapper behavior ----

    function test_SafeTransferFromToReceiverWorks() public {
        P4ERC721Receiver receiver = new P4ERC721Receiver();
        uint256 requestId = _depositAndRequest(alice, alice, DEPOSIT);

        vm.prank(alice);
        ticket.safeTransferFrom(alice, address(receiver), requestId);

        assertTrue(receiver.received());
        assertEq(ticket.ownerOf(requestId), address(receiver));
        assertEq(vault.activeRequestId(alice), requestId);
        assertEq(vault.balanceOf(address(vault)), DEPOSIT);
        assertEq(vault.reservedClaimableAssets(), 0);
        _assertRequest(requestId, alice, alice, DEPOSIT, 0, NostosAsyncVaultP4.RequestStatus.Pending);
    }

    function test_SafeTransferFromToInvalidReceiverReverts() public {
        P4InvalidERC721Receiver invalidReceiver = new P4InvalidERC721Receiver();
        uint256 requestId = _depositAndRequest(alice, alice, DEPOSIT);

        vm.prank(alice);
        vm.expectRevert();
        ticket.safeTransferFrom(alice, address(invalidReceiver), requestId);

        assertEq(ticket.ownerOf(requestId), alice);
        assertEq(vault.activeRequestId(alice), requestId);
        assertEq(vault.balanceOf(address(vault)), DEPOSIT);
        assertEq(vault.reservedClaimableAssets(), 0);
        _assertRequest(requestId, alice, alice, DEPOSIT, 0, NostosAsyncVaultP4.RequestStatus.Pending);
    }

    function test_RequestToInvalidReceiverRevertsAtomically() public {
        P4InvalidERC721Receiver invalidReceiver = new P4InvalidERC721Receiver();
        _depositInto(vault, alice, DEPOSIT);

        vm.prank(alice);
        vm.expectRevert();
        vault.requestRedeem(DEPOSIT, address(invalidReceiver), alice);

        assertEq(vault.balanceOf(alice), DEPOSIT);
        assertEq(vault.balanceOf(address(vault)), 0);
        assertEq(vault.nextRequestId(), 1);
        assertEq(vault.requestController(1), address(0));
        assertEq(vault.activeRequestId(address(invalidReceiver)), 0);
        assertEq(vault.reservedClaimableAssets(), 0);
        vm.expectRevert();
        ticket.ownerOf(1);
    }

    function test_StandardClaimWrappersUseTicketAuthorization() public {
        uint256 requestId = _depositAndRequest(alice, alice, DEPOSIT);
        _settle(requestId);

        vm.prank(alice);
        ticket.transferFrom(alice, bob, requestId);

        vm.prank(alice);
        vm.expectRevert(bytes("NostosAsyncVaultP4: not ticket authorized"));
        vault.redeem(DEPOSIT, alice, alice);

        vm.prank(bob);
        uint256 shares = vault.withdraw(DEPOSIT, carol, alice);
        assertEq(shares, DEPOSIT);
        assertEq(vault.activeRequestId(alice), 0);
        assertEq(vault.reservedClaimableAssets(), 0);
        assertEq(vault.balanceOf(address(vault)), 0);
        _assertRequest(requestId, alice, alice, DEPOSIT, DEPOSIT, NostosAsyncVaultP4.RequestStatus.Claimed);
    }

    function test_ClaimRedeemUsesExplicitRequestId() public {
        uint256 requestA = _depositAndRequest(alice, alice, 2_000e6);
        uint256 requestB = _depositAndRequest(bob, bob, 3_000e6);
        _settle(requestA);
        _settle(requestB);

        // Alice's active request is selected by requestId, not by Bob's or
        // any caller-local history. The other request remains untouched.
        vm.prank(alice);
        vault.claimRedeem(requestA, carol);

        assertEq(vault.activeRequestId(alice), 0);
        assertEq(vault.activeRequestId(bob), requestB);
        assertEq(vault.reservedClaimableAssets(), 3_000e6);
        assertEq(ticket.ownerOf(requestB), bob);
        _assertRequest(requestA, alice, alice, 2_000e6, 2_000e6, NostosAsyncVaultP4.RequestStatus.Claimed);
        _assertRequest(requestB, bob, bob, 3_000e6, 3_000e6, NostosAsyncVaultP4.RequestStatus.Claimable);
    }

    // ---- Helpers ----

    function _newUnconfiguredVault() internal returns (NostosAsyncVaultP4 candidate) {
        vm.prank(admin);
        candidate = new NostosAsyncVaultP4(IERC20(address(usdt)));
    }

    function _depositInto(NostosAsyncVaultP4 target, address owner, uint256 assets) internal {
        vm.startPrank(owner);
        usdt.approve(address(target), assets);
        uint256 shares = target.deposit(assets, owner);
        vm.stopPrank();
        assertEq(shares, assets);
    }

    function _depositAndRequest(address owner, address controller, uint256 shares)
        internal
        returns (uint256 requestId)
    {
        _depositInto(vault, owner, shares);
        vm.prank(owner);
        requestId = vault.requestRedeem(shares, controller, owner);
    }

    function _settle(uint256 requestId) internal {
        vm.prank(settler);
        uint256 assets = vault.settleRequest(requestId);
        assertGt(assets, 0);
    }

    function _assertRequest(
        uint256 requestId,
        address controller,
        address owner,
        uint256 shares,
        uint256 assetsClaimable,
        NostosAsyncVaultP4.RequestStatus status
    ) internal view {
        assertEq(_requestId(requestId, controller), requestId);
        assertEq(_requestController(requestId, controller), controller);
        assertEq(_requestOwner(requestId, controller), owner);
        assertEq(_requestShares(requestId, controller), shares);
        assertEq(_requestAssets(requestId, controller), assetsClaimable);
        assertEq(uint256(_requestStatus(requestId, controller)), uint256(status));
    }

    function _requestId(uint256 requestId, address controller) internal view returns (uint256 storedRequestId) {
        (storedRequestId,,,,,,,,) = vault.requests(requestId, controller);
    }

    function _requestController(uint256 requestId, address controller)
        internal
        view
        returns (address storedController)
    {
        (, storedController,,,,,,,) = vault.requests(requestId, controller);
    }

    function _requestOwner(uint256 requestId, address controller) internal view returns (address storedOwner) {
        (,, storedOwner,,,,,,) = vault.requests(requestId, controller);
    }

    function _requestShares(uint256 requestId, address controller) internal view returns (uint256 storedShares) {
        (,,, storedShares,,,,,) = vault.requests(requestId, controller);
    }

    function _requestAssets(uint256 requestId, address controller) internal view returns (uint256 storedAssets) {
        (,,,, storedAssets,,,,) = vault.requests(requestId, controller);
    }

    function _requestStatus(uint256 requestId, address controller)
        internal
        view
        returns (NostosAsyncVaultP4.RequestStatus storedStatus)
    {
        (,,,,,,,, storedStatus) = vault.requests(requestId, controller);
    }
}
