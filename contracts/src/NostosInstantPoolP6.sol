// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC721Receiver} from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {NostosAsyncVaultP4} from "./NostosAsyncVaultP4.sol";
import {NostosRedemptionTicket} from "./NostosRedemptionTicket.sol";

/// @notice Nostos P6 public instant-liquidity pool. Permissionless LPs deposit
/// USDT for non-transferable nLP shares. The pool buys PENDING P4 tickets at a
/// deterministic discount, values pending claims at cost basis, and takes a
/// 10% protocol fee on realized spread.
///
/// DEMO / 0% YIELD / TESTNET SETTLEMENT INFRASTRUCTURE. Not ERC-4626.
/// No RWA backing, no yield claim, testnet only.
contract NostosInstantPoolP6 is ERC20, AccessControl, Pausable, ReentrancyGuard, IERC721Receiver {
    using SafeERC20 for IERC20;

    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    uint256 private constant BASIS = 10_000;
    uint256 private constant PROTOCOL_FEE_BPS = 1_000;
    uint256 private constant VIRTUAL_ASSETS = 1e6;
    uint256 private constant VIRTUAL_SHARES = 1e18;
    uint64 private constant WITHDRAWAL_COOLDOWN = 24 hours;

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
    address public immutable protocolTreasury;

    Pricing private _pricing;
    uint256 private _expectedTicketId;

    mapping(uint256 => InstantPosition) public positions;
    mapping(address => uint64) public withdrawalUnlockAt;
    uint256 public positionCount;

    uint256 public outstandingFaceValue;
    uint256 public outstandingCostBasis;
    uint256 public cumulativeGrossSpread;
    uint256 public accruedProtocolFees;
    uint256 public cumulativeProtocolFees;

    event LiquidityDeposited(address indexed depositor, uint256 assets, uint256 shares, uint64 unlockAt);
    event LiquidityRedeemed(address indexed redeemer, uint256 shares, uint256 assets);
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
        uint256 spread,
        uint256 protocolFee
    );
    event ProtocolFeesClaimed(address indexed treasury, uint256 amount);

    constructor(IERC20 asset_, NostosAsyncVaultP4 vault_, NostosRedemptionTicket ticket_, address protocolTreasury_)
        ERC20("Nostos Instant LP", "nLP")
    {
        require(address(asset_) != address(0), "InstantPoolP6: zero asset");
        require(address(vault_) != address(0), "InstantPoolP6: zero vault");
        require(address(ticket_) != address(0), "InstantPoolP6: zero ticket");
        require(protocolTreasury_ != address(0), "InstantPoolP6: zero treasury");
        require(ticket_.vault() == address(vault_), "InstantPoolP6: ticket not bound to vault");
        require(vault_.redemptionTicket() == address(ticket_), "InstantPoolP6: vault does not reference ticket");
        asset = asset_;
        vault = vault_;
        ticket = ticket_;
        protocolTreasury = protocolTreasury_;
        _pricing = Pricing({
            baseDiscountBps: 100,
            utilizationSlopeBps: 1_000,
            sizeSlopeBps: 500,
            minDiscountBps: 0,
            maxDiscountBps: 3_000,
            maxUtilizationBps: 9_000
        });
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(PAUSER_ROLE, msg.sender);
    }

    // ---- Views ----

    function availableLiquidity() public view returns (uint256) {
        uint256 balance = asset.balanceOf(address(this));
        uint256 fees = accruedProtocolFees;
        return balance > fees ? balance - fees : 0;
    }

    function lpNav() public view returns (uint256) {
        return availableLiquidity() + outstandingCostBasis;
    }

    function convertToShares(uint256 assets) public view returns (uint256 shares) {
        require(assets > 0, "InstantPoolP6: zero assets");
        shares = Math.mulDiv(assets, totalSupply() + VIRTUAL_SHARES, lpNav() + VIRTUAL_ASSETS);
        require(shares > 0, "InstantPoolP6: zero shares");
    }

    function convertToAssets(uint256 shares) public view returns (uint256 assets) {
        require(shares > 0, "InstantPoolP6: zero shares");
        assets = Math.mulDiv(shares, lpNav() + VIRTUAL_ASSETS, totalSupply() + VIRTUAL_SHARES);
        require(assets > 0, "InstantPoolP6: zero assets");
    }

    function sharePrice() public view returns (uint256) {
        return convertToAssets(1e18);
    }

    function previewDeposit(uint256 assets) public view returns (uint256) {
        return convertToShares(assets);
    }

    function previewRedeem(uint256 shares) public view returns (uint256) {
        return convertToAssets(shares);
    }

    function maxRedeem(address user) public view returns (uint256) {
        if (block.timestamp < withdrawalUnlockAt[user]) return 0;
        uint256 userShares = balanceOf(user);
        if (userShares == 0) return 0;
        uint256 liquid = availableLiquidity();
        if (liquid == 0) return 0;
        uint256 sharesFromCash = Math.mulDiv(liquid, totalSupply() + VIRTUAL_SHARES, lpNav() + VIRTUAL_ASSETS);
        return userShares < sharesFromCash ? userShares : sharesFromCash;
    }

    function utilizationBps() public view returns (uint256) {
        uint256 liquid = availableLiquidity();
        uint256 outstanding = outstandingFaceValue;
        uint256 denom = liquid + outstanding;
        if (denom == 0) return 0;
        return outstanding * BASIS / denom;
    }

    function lpRealizedProfit() public view returns (uint256) {
        return cumulativeGrossSpread - cumulativeProtocolFees;
    }

    function getPricing() public view returns (Pricing memory) {
        return _pricing;
    }

    function quoteTicket(uint256 ticketId) external view returns (Quote memory) {
        (, uint256 faceValue) = _eligiblePendingRequest(ticketId);
        return _quote(faceValue);
    }

    // ---- Admin / pause ----

    function setPricing(
        uint256 baseDiscountBps,
        uint256 utilizationSlopeBps,
        uint256 sizeSlopeBps,
        uint256 minDiscountBps,
        uint256 maxDiscountBps,
        uint256 maxUtilizationBps
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(minDiscountBps <= maxDiscountBps, "InstantPoolP6: min > max");
        require(
            baseDiscountBps >= minDiscountBps && baseDiscountBps <= maxDiscountBps, "InstantPoolP6: base out of bounds"
        );
        require(maxDiscountBps <= BASIS, "InstantPoolP6: max discount exceeds 100%");
        require(maxUtilizationBps > 0 && maxUtilizationBps <= BASIS, "InstantPoolP6: bad max utilization");
        _pricing = Pricing({
            baseDiscountBps: baseDiscountBps,
            utilizationSlopeBps: utilizationSlopeBps,
            sizeSlopeBps: sizeSlopeBps,
            minDiscountBps: minDiscountBps,
            maxDiscountBps: maxDiscountBps,
            maxUtilizationBps: maxUtilizationBps
        });
        emit PricingUpdated(
            baseDiscountBps, utilizationSlopeBps, sizeSlopeBps, minDiscountBps, maxDiscountBps, maxUtilizationBps
        );
    }

    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    // ---- LP capital ----

    function deposit(uint256 assets, uint256 minSharesOut)
        external
        nonReentrant
        whenNotPaused
        returns (uint256 shares)
    {
        shares = convertToShares(assets);
        require(shares >= minSharesOut, "InstantPoolP6: slippage");
        address depositor = _msgSender();
        asset.safeTransferFrom(depositor, address(this), assets);
        _mint(depositor, shares);
        uint64 unlockAt = uint64(block.timestamp) + WITHDRAWAL_COOLDOWN;
        withdrawalUnlockAt[depositor] = unlockAt;
        emit LiquidityDeposited(depositor, assets, shares, unlockAt);
    }

    function redeem(uint256 shares, uint256 minAssetsOut) external nonReentrant returns (uint256 assets) {
        address redeemer = _msgSender();
        require(block.timestamp >= withdrawalUnlockAt[redeemer], "InstantPoolP6: cooldown");
        assets = convertToAssets(shares);
        require(assets >= minAssetsOut, "InstantPoolP6: slippage");
        require(assets <= availableLiquidity(), "InstantPoolP6: insufficient liquidity");
        _burn(redeemer, shares);
        asset.safeTransfer(redeemer, assets);
        emit LiquidityRedeemed(redeemer, shares, assets);
    }

    function _update(address from, address to, uint256 value) internal virtual override {
        require(from == address(0) || to == address(0), "InstantPoolP6: transfers disabled");
        super._update(from, to, value);
    }

    // ---- Purchase ----

    function sellTicket(uint256 ticketId, uint256 minAmountOut)
        external
        nonReentrant
        whenNotPaused
        returns (uint256 amountOut)
    {
        require(ticket.ownerOf(ticketId) == _msgSender(), "InstantPoolP6: seller does not own ticket");
        (, uint256 faceValue) = _eligiblePendingRequest(ticketId);

        Quote memory q = _quote(faceValue);
        require(q.amountOut >= minAmountOut, "InstantPoolP6: slippage");
        require(q.amountOut <= availableLiquidity(), "InstantPoolP6: insufficient liquidity");
        require(q.amountOut > 0, "InstantPoolP6: zero payout");
        require(q.postTradeUtilizationBps <= _pricing.maxUtilizationBps, "InstantPoolP6: utilization cap");

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

    function onERC721Received(address, address, uint256 tokenId, bytes calldata) external returns (bytes4) {
        require(msg.sender == address(ticket), "InstantPoolP6: unsolicited token");
        require(_expectedTicketId == tokenId, "InstantPoolP6: unsolicited ticket");
        _expectedTicketId = 0;
        return IERC721Receiver.onERC721Received.selector;
    }

    // ---- Harvest ----

    function harvest(uint256 ticketId) external nonReentrant returns (uint256 assets) {
        InstantPosition storage pos = positions[ticketId];
        require(pos.status == Status.Active, "InstantPoolP6: no active position");
        require(ticket.ownerOf(ticketId) == address(this), "InstantPoolP6: pool does not own ticket");

        address controller = vault.requestController(ticketId);
        require(controller != address(0), "InstantPoolP6: unknown request");
        (,,,,,,,, NostosAsyncVaultP4.RequestStatus status) = vault.requests(ticketId, controller);
        require(status == NostosAsyncVaultP4.RequestStatus.Claimable, "InstantPoolP6: not claimable");

        uint256 faceValue = pos.faceValue;
        uint256 costBasis = pos.costBasis;
        uint256 grossSpread = faceValue - costBasis;
        uint256 protocolFee = Math.mulDiv(grossSpread, PROTOCOL_FEE_BPS, BASIS);

        pos.status = Status.Settled;
        pos.settledAt = uint64(block.timestamp);
        outstandingFaceValue -= faceValue;
        outstandingCostBasis -= costBasis;
        cumulativeGrossSpread += grossSpread;
        accruedProtocolFees += protocolFee;
        cumulativeProtocolFees += protocolFee;

        assets = vault.claimRedeem(ticketId, address(this));
        require(assets == faceValue, "InstantPoolP6: settlement mismatch");
        emit TicketHarvested(ticketId, ticketId, faceValue, costBasis, grossSpread, protocolFee);
    }

    // ---- Protocol fees ----

    function claimProtocolFees() external nonReentrant {
        require(_msgSender() == protocolTreasury, "InstantPoolP6: not treasury");
        uint256 amount = accruedProtocolFees;
        require(amount > 0, "InstantPoolP6: zero fees");
        accruedProtocolFees = 0;
        asset.safeTransfer(protocolTreasury, amount);
        emit ProtocolFeesClaimed(protocolTreasury, amount);
    }

    // ---- Internals ----

    function _eligiblePendingRequest(uint256 ticketId) internal view returns (address controller, uint256 faceValue) {
        controller = vault.requestController(ticketId);
        require(controller != address(0), "InstantPoolP6: unknown request");
        require(ticket.ownerOf(ticketId) != address(this), "InstantPoolP6: ticket already owned by pool");
        (,,, uint256 shares,,,,, NostosAsyncVaultP4.RequestStatus status) = vault.requests(ticketId, controller);
        require(status == NostosAsyncVaultP4.RequestStatus.Pending, "InstantPoolP6: request not pending");
        require(shares > 0, "InstantPoolP6: zero shares");
        faceValue = vault.sharesToAssets(shares);
        require(faceValue > 0, "InstantPoolP6: zero face value");
    }

    function _quote(uint256 faceValue) internal view returns (Quote memory q) {
        uint256 liquid = availableLiquidity();
        uint256 outstanding = outstandingFaceValue;
        uint256 denom = liquid + outstanding;
        require(denom > 0, "InstantPoolP6: no liquid assets");

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
