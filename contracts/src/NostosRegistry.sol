// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @notice Nostos integration-status registry. Anchors integration status and
/// metadata hashes ONLY - it never stores APY, TVL/NAV, or risk scores.
contract NostosRegistry is Ownable {
    enum IntegrationStatus {
        DiscoveryOnly,
        DepositSupported,
        RedemptionSupported,
        InstantLiquiditySupported,
        Paused
    }

    struct Integration {
        bytes32 integrationId;
        address nostosVault;
        bytes32 metadataHash;
        IntegrationStatus status;
        uint64 registeredAt;
        uint64 updatedAt;
    }

    mapping(bytes32 => Integration) public integrations;
    mapping(bytes32 => bool) public exists;
    bytes32[] public integrationIds;

    event IntegrationRegistered(
        bytes32 indexed integrationId,
        address nostosVault,
        bytes32 metadataHash,
        IntegrationStatus status,
        uint64 registeredAt
    );

    event IntegrationUpdated(
        bytes32 indexed integrationId,
        address nostosVault,
        bytes32 metadataHash,
        IntegrationStatus status,
        uint64 updatedAt
    );

    error ZeroIntegrationId();
    error AlreadyRegistered(bytes32 integrationId);
    error NotRegistered(bytes32 integrationId);
    error DiscoveryOnlyRequiresZeroVault();
    error NonDiscoveryRequiresVault();

    constructor(address initialOwner) Ownable(initialOwner) {}

    function register(
        bytes32 integrationId_,
        address nostosVault_,
        bytes32 metadataHash_,
        IntegrationStatus status_
    ) external onlyOwner returns (Integration memory) {
        if (integrationId_ == bytes32(0)) revert ZeroIntegrationId();
        if (exists[integrationId_]) revert AlreadyRegistered(integrationId_);
        _validateVault(status_, nostosVault_);

        uint64 timestamp = uint64(block.timestamp);
        Integration memory integration = Integration({
            integrationId: integrationId_,
            nostosVault: nostosVault_,
            metadataHash: metadataHash_,
            status: status_,
            registeredAt: timestamp,
            updatedAt: timestamp
        });
        integrations[integrationId_] = integration;
        exists[integrationId_] = true;
        integrationIds.push(integrationId_);
        emit IntegrationRegistered(
            integrationId_,
            nostosVault_,
            metadataHash_,
            status_,
            timestamp
        );
        return integration;
    }

    function update(
        bytes32 integrationId_,
        address nostosVault_,
        bytes32 metadataHash_,
        IntegrationStatus status_
    ) external onlyOwner returns (Integration memory) {
        if (!exists[integrationId_]) revert NotRegistered(integrationId_);
        _validateVault(status_, nostosVault_);

        Integration storage integration = integrations[integrationId_];
        integration.nostosVault = nostosVault_;
        integration.metadataHash = metadataHash_;
        integration.status = status_;
        integration.updatedAt = uint64(block.timestamp);
        emit IntegrationUpdated(
            integrationId_,
            nostosVault_,
            metadataHash_,
            status_,
            integration.updatedAt
        );
        return integration;
    }

    function getIntegration(
        bytes32 integrationId_
    ) external view returns (Integration memory) {
        return integrations[integrationId_];
    }

    function integrationCount() external view returns (uint256) {
        return integrationIds.length;
    }

    function _validateVault(
        IntegrationStatus status_,
        address nostosVault_
    ) internal pure {
        if (status_ == IntegrationStatus.DiscoveryOnly) {
            if (nostosVault_ != address(0)) revert DiscoveryOnlyRequiresZeroVault();
        } else {
            if (nostosVault_ == address(0)) revert NonDiscoveryRequiresVault();
        }
    }
}