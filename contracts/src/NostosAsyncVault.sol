// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC4626, ERC20, IERC20} from "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ERC165} from "@openzeppelin/contracts/utils/introspection/ERC165.sol";
import {IERC7540} from "./interfaces/IERC7540.sol";
import {IERC7575} from "./interfaces/IERC7575.sol";

/// @notice Nostos asynchronous-settlement demonstration vault (BOT Testnet).
/// Deposits are ordinary ERC-4626 (approve USDT -> deposit -> shares).
/// Redemptions are ERC-7540-style: requestRedeem locks shares (Pending), a
/// SETTLER_ROLE transitions to Claimable only against reserved real USDT, and
/// redeem/withdraw claim by burning locked shares and paying USDT.
///
/// DEMO / 0% YIELD / TESTNET SETTLEMENT INFRASTRUCTURE.
/// No OUSG/TBILL backing, no RWA-backing claim, testnet only.
contract NostosAsyncVault is
    ERC20("Nostos Async Settlement Vault", "NOS-VAULT"),
    ERC4626,
    AccessControl,
    Pausable,
    ReentrancyGuard,
    IERC7540,
    IERC7575
{
    using SafeERC20 for IERC20;

    bytes32 public constant SETTLER_ROLE = keccak256("SETTLER_ROLE");

    enum RequestStatus {
        None,
        Pending,
        Claimable,
        Claimed
    }

    struct RedemptionRequest {
        uint256 requestId;
        address controller;
        address owner;
        uint256 shares;
        uint256 assetsClaimable;
        uint64 requestedAt;
        uint64 claimableAt;
        uint64 claimedAt;
        RequestStatus status;
    }

    uint256 public nextRequestId = 1;
    mapping(uint256 => address) public requestController;
    mapping(uint256 => mapping(address => RedemptionRequest)) public requests;
    mapping(address => uint256) public activeRequestId;
    mapping(address => mapping(address => bool)) private _operators;

    uint256 public reservedClaimableAssets;

    event RequestMadeClaimable(
        uint256 indexed requestId,
        address indexed controller,
        uint256 shares,
        uint256 assets
    );
    event RequestClaimed(
        uint256 indexed requestId,
        address indexed controller,
        uint256 assets
    );

    constructor(IERC20 asset_) ERC4626(asset_) {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(SETTLER_ROLE, msg.sender);
    }

    // ---- ERC-4626 / ERC-7575 ----

    function share() external view returns (address) {
        return address(this);
    }

    /// @dev ERC4626 resolves share decimals to the underlying (USDT, 6).
    function decimals()
        public
        view
        virtual
        override(ERC20, ERC4626)
        returns (uint8)
    {
        return ERC4626.decimals();
    }

    function previewRedeem(uint256) public view virtual override returns (uint256) {
        revert("NostosAsyncVault: async redemption; no preview");
    }

    function previewWithdraw(uint256) public view virtual override returns (uint256) {
        revert("NostosAsyncVault: async redemption; no preview");
    }

    function _deposit(
        address caller,
        address receiver,
        uint256 assets,
        uint256 shares
    ) internal virtual override whenNotPaused {
        super._deposit(caller, receiver, assets, shares);
    }

    // ---- ERC-7540 operators ----

    function isOperator(address controller, address operator)
        public
        view
        virtual
        returns (bool)
    {
        return operator == controller || _operators[controller][operator];
    }

    function setOperator(address operator, bool approved)
        external
        virtual
        returns (bool)
    {
        address controller = _msgSender();
        _operators[controller][operator] = approved;
        emit OperatorSet(controller, operator, approved);
        return true;
    }

    function _requireOperator(address controller) internal view {
        require(
            isOperator(controller, _msgSender()),
            "NostosAsyncVault: not an operator"
        );
    }

    // ---- Request ----

    function requestRedeem(
        uint256 shares,
        address controller,
        address owner
    )
        public
        virtual
        override
        nonReentrant
        whenNotPaused
        returns (uint256 requestId)
    {
        require(shares > 0, "NostosAsyncVault: zero shares");
        require(
            owner == _msgSender() || isOperator(owner, _msgSender()),
            "NostosAsyncVault: unauthorized"
        );
        require(
            activeRequestId[controller] == 0,
            "NostosAsyncVault: active request exists"
        );

        // Lock shares from the owner into the vault immediately.
        _transfer(owner, address(this), shares);

        requestId = nextRequestId++;
        RedemptionRequest storage req = requests[requestId][controller];
        req.requestId = requestId;
        req.controller = controller;
        req.owner = owner;
        req.shares = shares;
        req.requestedAt = uint64(block.timestamp);
        req.status = RequestStatus.Pending;
        requestController[requestId] = controller;
        activeRequestId[controller] = requestId;

        emit RedeemRequest(requestId, controller, shares, 0);
    }

    // ---- Settlement (SETTLER_ROLE) ----

    /// @dev Demonstration exchange rate: 1 share = 1 asset (both 6 decimals).
    function sharesToAssets(uint256 shares) public pure returns (uint256) {
        return shares;
    }

    function settleRequest(uint256 requestId)
        public
        virtual
        onlyRole(SETTLER_ROLE)
        nonReentrant
        whenNotPaused
        returns (uint256 assets)
    {
        address controller = requestController[requestId];
        require(controller != address(0), "NostosAsyncVault: unknown request");
        RedemptionRequest storage req = requests[requestId][controller];
        require(req.status == RequestStatus.Pending, "NostosAsyncVault: not pending");

        assets = sharesToAssets(req.shares);
        uint256 vaultBalance = IERC20(asset()).balanceOf(address(this));
        uint256 unreserved = vaultBalance - reservedClaimableAssets;
        require(
            assets <= unreserved,
            "NostosAsyncVault: insufficient unreserved liquidity"
        );

        reservedClaimableAssets += assets;
        req.assetsClaimable = assets;
        req.status = RequestStatus.Claimable;
        req.claimableAt = uint64(block.timestamp);

        emit RequestMadeClaimable(requestId, controller, req.shares, assets);
    }

    // ---- Claim ----

    function redeem(
        uint256 shares,
        address receiver,
        address controller
    ) public virtual override nonReentrant returns (uint256 assets) {
        _requireOperator(controller);
        return _claim(shares, receiver, controller);
    }

    function withdraw(
        uint256 assets,
        address receiver,
        address controller
    ) public virtual override nonReentrant returns (uint256 shares) {
        _requireOperator(controller);
        return _claimSharesForAssets(assets, receiver, controller);
    }

    function _claim(
        uint256 shares,
        address receiver,
        address controller
    ) internal returns (uint256 assets) {
        uint256 requestId = activeRequestId[controller];
        require(requestId != 0, "NostosAsyncVault: no active request");
        RedemptionRequest storage req = requests[requestId][controller];
        require(req.status == RequestStatus.Claimable, "NostosAsyncVault: not claimable");
        require(req.shares == shares, "NostosAsyncVault: partial claim unsupported");
        return _executeClaim(requestId, controller, req, receiver);
    }

    function _claimSharesForAssets(
        uint256 assets,
        address receiver,
        address controller
    ) internal returns (uint256 shares) {
        uint256 requestId = activeRequestId[controller];
        require(requestId != 0, "NostosAsyncVault: no active request");
        RedemptionRequest storage req = requests[requestId][controller];
        require(req.status == RequestStatus.Claimable, "NostosAsyncVault: not claimable");
        require(
            req.assetsClaimable == assets,
            "NostosAsyncVault: partial claim unsupported"
        );
        shares = req.shares;
        _executeClaim(requestId, controller, req, receiver);
    }

    function _executeClaim(
        uint256 requestId,
        address controller,
        RedemptionRequest storage req,
        address receiver
    ) internal returns (uint256 assets) {
        assets = req.assetsClaimable;
        uint256 shares = req.shares;

        // Checks-effects-interactions.
        reservedClaimableAssets -= assets;
        req.status = RequestStatus.Claimed;
        req.claimedAt = uint64(block.timestamp);
        delete activeRequestId[controller];

        _burn(address(this), shares);
        emit Withdraw(_msgSender(), receiver, controller, assets, shares);
        emit RequestClaimed(requestId, controller, assets);

        IERC20(asset()).safeTransfer(receiver, assets);
    }

    // ---- ERC-7540 read getters ----

    function pendingRedeemRequest(uint256 requestId, address controller)
        public
        view
        virtual
        returns (RedeemRequestData memory)
    {
        RedemptionRequest storage req = requests[requestId][controller];
        require(req.status == RequestStatus.Pending, "NostosAsyncVault: not pending");
        return
            RedeemRequestData({sender: req.owner, owner: req.owner, assets: 0, shares: req.shares});
    }

    function claimableRedeemRequest(uint256 requestId, address controller)
        public
        view
        virtual
        returns (RedeemRequestData memory)
    {
        RedemptionRequest storage req = requests[requestId][controller];
        require(req.status == RequestStatus.Claimable, "NostosAsyncVault: not claimable");
        return
            RedeemRequestData({
                sender: req.owner,
                owner: req.owner,
                assets: req.assetsClaimable,
                shares: req.shares
            });
    }

    // ---- ERC-165 ----

    function supportsInterface(bytes4 interfaceId)
        public
        view
        virtual
        override(AccessControl)
        returns (bool)
    {
        return
            interfaceId == type(IERC7540).interfaceId ||
            interfaceId == type(IERC7575).interfaceId ||
            super.supportsInterface(interfaceId);
    }

    // ---- Admin/pause ----

    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }
}