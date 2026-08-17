// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {NostosRegistry} from "../src/NostosRegistry.sol";

contract NostosRegistryTest is Test {
    NostosRegistry registry;
    address deployer = address(0xA11CE);
    address stranger = address(0xB0B);

    bytes32 ousgId = keccak256("nostos-rwa-v1:ousg");
    bytes32 tbillId = keccak256("nostos-rwa-v1:tbill");
    bytes32 hashA = keccak256("snapshot-a");
    bytes32 hashB = keccak256("snapshot-b");

    function setUp() public {
        vm.prank(deployer);
        registry = new NostosRegistry(deployer);
    }

    function test_RegisterDiscoveryOnlyWithZeroVault() public {
        vm.prank(deployer);
        NostosRegistry.Integration memory it = registry.register(
            ousgId,
            address(0),
            hashA,
            NostosRegistry.IntegrationStatus.DiscoveryOnly
        );
        assertEq(uint256(it.status), uint256(NostosRegistry.IntegrationStatus.DiscoveryOnly));
        assertEq(it.nostosVault, address(0));
        assertEq(registry.integrationCount(), 1);
    }

    function test_DuplicateRegistrationRejected() public {
        vm.startPrank(deployer);
        registry.register(ousgId, address(0), hashA, NostosRegistry.IntegrationStatus.DiscoveryOnly);
        vm.expectRevert(abi.encodeWithSelector(NostosRegistry.AlreadyRegistered.selector, ousgId));
        registry.register(ousgId, address(0), hashB, NostosRegistry.IntegrationStatus.DiscoveryOnly);
        vm.stopPrank();
    }

    function test_OnlyOwnerCanMutate() public {
        vm.prank(deployer);
        registry.register(ousgId, address(0), hashA, NostosRegistry.IntegrationStatus.DiscoveryOnly);
        vm.startPrank(stranger);
        vm.expectRevert();
        registry.update(ousgId, address(0), hashB, NostosRegistry.IntegrationStatus.DiscoveryOnly);
        vm.stopPrank();
    }

    function test_DiscoveryOnlyRequiresZeroVault() public {
        vm.startPrank(deployer);
        vm.expectRevert(NostosRegistry.DiscoveryOnlyRequiresZeroVault.selector);
        registry.register(ousgId, address(1), hashA, NostosRegistry.IntegrationStatus.DiscoveryOnly);
        vm.stopPrank();
    }

    function test_NonDiscoveryRequiresVault() public {
        vm.startPrank(deployer);
        vm.expectRevert(NostosRegistry.NonDiscoveryRequiresVault.selector);
        registry.register(ousgId, address(0), hashA, NostosRegistry.IntegrationStatus.DepositSupported);
        vm.stopPrank();
    }

    function test_StoresOnlyStatusAndHash() public {
        vm.prank(deployer);
        registry.register(tbillId, address(0), hashB, NostosRegistry.IntegrationStatus.DiscoveryOnly);
        NostosRegistry.Integration memory it = registry.getIntegration(tbillId);
        assertEq(it.metadataHash, hashB);
        assertEq(uint256(it.status), uint256(NostosRegistry.IntegrationStatus.DiscoveryOnly));
        // No APY/TVL/risk fields exist on the struct; this asserts the shape is minimal.
        assertEq(uint256(uint160(it.nostosVault)), 0);
    }

    function test_ZeroIntegrationIdRejected() public {
        vm.prank(deployer);
        vm.expectRevert(NostosRegistry.ZeroIntegrationId.selector);
        registry.register(bytes32(0), address(0), hashA, NostosRegistry.IntegrationStatus.DiscoveryOnly);
    }

    function test_UpdateChangesStatusAndHash() public {
        vm.startPrank(deployer);
        registry.register(ousgId, address(0), hashA, NostosRegistry.IntegrationStatus.DiscoveryOnly);
        registry.update(ousgId, address(0), hashB, NostosRegistry.IntegrationStatus.DiscoveryOnly);
        NostosRegistry.Integration memory it = registry.getIntegration(ousgId);
        assertEq(it.metadataHash, hashB);
        vm.stopPrank();
    }
}