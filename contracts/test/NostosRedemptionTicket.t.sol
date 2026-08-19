// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {IERC721Receiver} from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import {INostosRedemptionTicket} from "../src/interfaces/INostosRedemptionTicket.sol";
import {NostosRedemptionTicket} from "../src/NostosRedemptionTicket.sol";

contract RedemptionTicketReceiver is IERC721Receiver {
    function onERC721Received(address, address, uint256, bytes calldata) external pure returns (bytes4) {
        return IERC721Receiver.onERC721Received.selector;
    }
}

contract RedemptionTicketNonReceiver {}

contract NostosRedemptionTicketTest is Test {
    NostosRedemptionTicket ticket;

    address vault = address(0xBEEF);
    address alice = address(0xA11CE);
    address bob = address(0xB0B);
    address operator = address(0x0A0B);
    address stranger = address(0x5E11);

    uint256 constant TOKEN_ID = 7;

    function setUp() public {
        ticket = new NostosRedemptionTicket(vault);
    }

    function test_ConstructorRejectsZeroVault() public {
        vm.expectRevert();
        new NostosRedemptionTicket(address(0));
    }

    function test_OnlyVaultCanMint() public {
        vm.expectRevert(NostosRedemptionTicket.OnlyVault.selector);
        ticket.mint(alice, TOKEN_ID);

        vm.prank(vault);
        ticket.mint(alice, TOKEN_ID);
        assertEq(ticket.ownerOf(TOKEN_ID), alice);
    }

    function test_OnlyVaultCanBurn() public {
        vm.prank(vault);
        ticket.mint(alice, TOKEN_ID);

        vm.expectRevert(NostosRedemptionTicket.OnlyVault.selector);
        ticket.burn(TOKEN_ID);
        assertEq(ticket.ownerOf(TOKEN_ID), alice);

        vm.prank(vault);
        ticket.burn(TOKEN_ID);
        vm.expectRevert();
        ticket.ownerOf(TOKEN_ID);
    }

    function test_MintSetsOwnerAndSupportsApprovals() public {
        vm.expectEmit(true, true, true, true, address(ticket));
        emit IERC721.Transfer(address(0), alice, TOKEN_ID);
        vm.prank(vault);
        ticket.mint(alice, TOKEN_ID);

        assertEq(ticket.name(), "Nostos Redemption Claim Ticket");
        assertEq(ticket.symbol(), "NOSTOS-CLAIM");
        assertEq(ticket.vault(), vault);
        assertEq(INostosRedemptionTicket(address(ticket)).vault(), vault);
        assertEq(ticket.balanceOf(alice), 1);
        assertEq(ticket.ownerOf(TOKEN_ID), alice);

        vm.expectEmit(true, true, true, true, address(ticket));
        emit IERC721.Approval(alice, bob, TOKEN_ID);
        vm.prank(alice);
        ticket.approve(bob, TOKEN_ID);
        assertEq(ticket.getApproved(TOKEN_ID), bob);

        vm.expectEmit(true, true, true, true, address(ticket));
        emit IERC721.ApprovalForAll(alice, operator, true);
        vm.prank(alice);
        ticket.setApprovalForAll(operator, true);
        assertTrue(ticket.isApprovedForAll(alice, operator));
    }

    function test_TransferAndSafeTransferFollowERC721Rules() public {
        vm.prank(vault);
        ticket.mint(alice, TOKEN_ID);

        vm.prank(stranger);
        vm.expectRevert();
        ticket.transferFrom(alice, bob, TOKEN_ID);

        vm.prank(alice);
        ticket.approve(bob, TOKEN_ID);

        vm.expectEmit(true, true, true, true, address(ticket));
        emit IERC721.Transfer(alice, bob, TOKEN_ID);
        vm.prank(bob);
        ticket.transferFrom(alice, bob, TOKEN_ID);
        assertEq(ticket.ownerOf(TOKEN_ID), bob);
        assertEq(ticket.getApproved(TOKEN_ID), address(0));

        RedemptionTicketReceiver receiver = new RedemptionTicketReceiver();
        vm.prank(vault);
        ticket.mint(address(receiver), TOKEN_ID + 1);
        assertEq(ticket.ownerOf(TOKEN_ID + 1), address(receiver));

        vm.prank(vault);
        ticket.mint(alice, TOKEN_ID + 2);

        vm.expectEmit(true, true, true, true, address(ticket));
        emit IERC721.Transfer(alice, address(receiver), TOKEN_ID + 2);
        vm.prank(alice);
        ticket.safeTransferFrom(alice, address(receiver), TOKEN_ID + 2);
        assertEq(ticket.ownerOf(TOKEN_ID + 2), address(receiver));
    }

    function test_IsAuthorizedRecognizesOwnerApprovalAndOperator() public {
        vm.prank(vault);
        ticket.mint(alice, TOKEN_ID);

        assertTrue(ticket.isAuthorized(alice, TOKEN_ID));
        assertFalse(ticket.isAuthorized(bob, TOKEN_ID));
        assertFalse(ticket.isAuthorized(address(0), TOKEN_ID));

        vm.prank(alice);
        ticket.approve(bob, TOKEN_ID);
        assertTrue(ticket.isAuthorized(bob, TOKEN_ID));

        vm.prank(alice);
        ticket.approve(address(0), TOKEN_ID);
        assertFalse(ticket.isAuthorized(bob, TOKEN_ID));

        vm.prank(alice);
        ticket.setApprovalForAll(operator, true);
        assertTrue(ticket.isAuthorized(operator, TOKEN_ID));
    }

    function test_SafeTransferToInvalidReceiverReverts() public {
        RedemptionTicketNonReceiver invalidReceiver = new RedemptionTicketNonReceiver();

        vm.prank(vault);
        ticket.mint(alice, TOKEN_ID);

        vm.prank(vault);
        vm.expectRevert();
        ticket.mint(address(invalidReceiver), TOKEN_ID + 1);

        vm.prank(alice);
        vm.expectRevert();
        ticket.safeTransferFrom(alice, address(invalidReceiver), TOKEN_ID);
        assertEq(ticket.ownerOf(TOKEN_ID), alice);
    }

    function test_SupportsERC721AndERC165() public view {
        assertTrue(ticket.supportsInterface(type(IERC721).interfaceId));
        assertTrue(ticket.supportsInterface(type(IERC165).interfaceId));
        assertFalse(ticket.supportsInterface(0xffffffff));
    }
}
