// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice ERC-7540-style asynchronous redemption subset used by Nostos.
/// Request IDs are uint256 (Nostos inspectable-record adaptation).
interface IERC7540 {
    struct RedeemRequestData {
        address sender;
        address owner;
        uint256 assets;
        uint256 shares;
    }

    function requestRedeem(
        uint256 shares,
        address controller,
        address owner
    ) external returns (uint256 requestId);

    function pendingRedeemRequest(
        uint256 requestId,
        address controller
    ) external view returns (RedeemRequestData memory);

    function claimableRedeemRequest(
        uint256 requestId,
        address controller
    ) external view returns (RedeemRequestData memory);

    function isOperator(address controller, address operator)
        external
        view
        returns (bool);

    function setOperator(address operator, bool approved)
        external
        returns (bool);

    event RedeemRequest(
        uint256 indexed requestId,
        address indexed controller,
        uint256 indexed shares,
        uint256 assets
    );

    event OperatorSet(
        address indexed controller,
        address indexed operator,
        bool approved
    );
}