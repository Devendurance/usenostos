// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC721Receiver} from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {NostosAsyncVaultP4} from "./NostosAsyncVaultP4.sol";
import {NostosRedemptionTicket} from "./NostosRedemptionTicket.sol";

/// @notice Nostos P5 protocol-owned instant-liquidity pool for P4 redemption
/// claim tickets. Buys PENDING tickets at a deterministic basis-point discount,
/// pays the seller real USDT immediately, and later harvests the full settlement
/// when the underlying P4 request becomes CLAIMABLE.
///
/// DEMO / 0% YIELD / TESTNET SETTLEMENT INFRASTRUCTURE. No LP shares, no ERC-4626.
/// No RWA backing, no yield claim, testnet only.
contract NostosInstantPool is AccessControl, Pausable, ReentrancyGuard, IERC721Receiver {
    using SafeERC20 for IERC20;

    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    uint256 private constant BASIS = 10_000;

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

    Pricing private _pricing;
    uint256 private _expectedTicketId;

    mapping(uint256 => InstantPosition) public positions;
    uint256 public positionCount;

    uint256 public outstandingFaceValue;
    uint256 public outstandingCostBasis;
    uint256 public realizedSpread;

    event LiquidityFunded(address indexed funder, uint256 amount);
    event LiquidityWithdrawn(address indexed withdrawer, uint256 amount);
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
        uint256 indexed ticketId, uint256 indexed requestId, uint256 faceValue, uint256 costBasis, uint256 spread
    );

    constructor(IERC20 asset_, NostosAsyncVaultP4 vault_, NostosRedemptionTicket ticket_) {
        require(address(asset_) != address(0), "InstantPool: zero asset");
        require(address(vault_) != address(0), "InstantPool: zero vault");
        require(address(ticket_) != address(0), "InstantPool: zero ticket");
        require(ticket_.vault() == address(vault_), "InstantPool: ticket not bound to vault");
        require(vault_.redemptionTicket() == address(ticket_), "InstantPool: vault does not reference ticket");
        asset = asset_;
        vault = vault_;
        ticket = ticket_;
        _pricing = Pricing({
            baseDiscountBps: 100,
            utilizationSlopeBps: 1_000,
            sizeSlopeBps: 500,
            minDiscountBps: 0,
            maxDiscountBps: 3_000,
            maxUtilizationBps: 9_000
        });
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MANAGER_ROLE, msg.sender);
        _grantRole(PAUSER_ROLE, msg.sender);
    }

    // ---- Views ----

    function liquidAssets() public view returns (uint256) {
        return asset.balanceOf(address(this));
    }

    function utilizationBps() public view returns (uint256) {
        uint256 liquid = liquidAssets();
        uint256 outstanding = outstandingFaceValue;
        uint256 denom = liquid + outstanding;
        if (denom == 0) return 0;
        return outstanding * BASIS / denom;
    }

    function getPricing() public view returns (Pricing memory) {
        return _pricing;
    }

    function quoteTicket(uint256 ticketId) external view returns (Quote memory) {
        (, uint256 faceValue) = _eligiblePendingRequest(ticketId);
        return _quote(faceValue);
    }

    // ---- Admin / manager ----

    function setPricing(
        uint256 baseDiscountBps,
        uint256 utilizationSlopeBps,
        uint256 sizeSlopeBps,
        uint256 minDiscountBps,
        uint256 maxDiscountBps,
        uint256 maxUtilizationBps
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(minDiscountBps <= maxDiscountBps, "InstantPool: min > max");
        require(
            baseDiscountBps >= minDiscountBps && baseDiscountBps <= maxDiscountBps, "InstantPool: base out of bounds"
        );
        require(maxDiscountBps <= BASIS, "InstantPool: max discount exceeds 100%");
        require(maxUtilizationBps > 0 && maxUtilizationBps <= BASIS, "InstantPool: bad max utilization");
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

    function fund(uint256 amount) external onlyRole(MANAGER_ROLE) {
        require(amount > 0, "InstantPool: zero amount");
        asset.safeTransferFrom(_msgSender(), address(this), amount);
        emit LiquidityFunded(_msgSender(), amount);
    }

    function withdrawLiquidity(uint256 amount) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(amount > 0, "InstantPool: zero amount");
        require(outstandingFaceValue == 0, "InstantPool: exposure outstanding");
        require(amount <= liquidAssets(), "InstantPool: insufficient liquidity");
        asset.safeTransfer(_msgSender(), amount);
        emit LiquidityWithdrawn(_msgSender(), amount);
    }

    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    // ---- Purchase ----

    function sellTicket(uint256 ticketId, uint256 minAmountOut)
        external
        nonReentrant
        whenNotPaused
        returns (uint256 amountOut)
    {
        require(ticket.ownerOf(ticketId) == _msgSender(), "InstantPool: seller does not own ticket");
        (, uint256 faceValue) = _eligiblePendingRequest(ticketId);

        Quote memory q = _quote(faceValue);
        require(q.amountOut >= minAmountOut, "InstantPool: slippage");
        require(q.amountOut <= liquidAssets(), "InstantPool: insufficient liquidity");
        require(q.amountOut > 0, "InstantPool: zero payout");
        require(q.postTradeUtilizationBps <= _pricing.maxUtilizationBps, "InstantPool: utilization cap");

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
        require(msg.sender == address(ticket), "InstantPool: unsolicited token");
        require(_expectedTicketId == tokenId, "InstantPool: unsolicited ticket");
        _expectedTicketId = 0;
        return IERC721Receiver.onERC721Received.selector;
    }

    // ---- Harvest ----

    function harvest(uint256 ticketId) external nonReentrant returns (uint256 assets) {
        InstantPosition storage pos = positions[ticketId];
        require(pos.status == Status.Active, "InstantPool: no active position");
        require(ticket.ownerOf(ticketId) == address(this), "InstantPool: pool does not own ticket");

        address controller = vault.requestController(ticketId);
        require(controller != address(0), "InstantPool: unknown request");
        (,,,,,,,, NostosAsyncVaultP4.RequestStatus status) = vault.requests(ticketId, controller);
        require(status == NostosAsyncVaultP4.RequestStatus.Claimable, "InstantPool: not claimable");

        uint256 faceValue = pos.faceValue;
        uint256 costBasis = pos.costBasis;

        pos.status = Status.Settled;
        pos.settledAt = uint64(block.timestamp);
        outstandingFaceValue -= faceValue;
        outstandingCostBasis -= costBasis;
        realizedSpread += faceValue - costBasis;

        assets = vault.claimRedeem(ticketId, address(this));
        require(assets == faceValue, "InstantPool: settlement mismatch");
        emit TicketHarvested(ticketId, ticketId, faceValue, costBasis, faceValue - costBasis);
    }

    // ---- Internals ----

    function _eligiblePendingRequest(uint256 ticketId) internal view returns (address controller, uint256 faceValue) {
        controller = vault.requestController(ticketId);
        require(controller != address(0), "InstantPool: unknown request");
        require(ticket.ownerOf(ticketId) != address(this), "InstantPool: ticket already owned by pool");
        (,,, uint256 shares,,,,, NostosAsyncVaultP4.RequestStatus status) = vault.requests(ticketId, controller);
        require(status == NostosAsyncVaultP4.RequestStatus.Pending, "InstantPool: request not pending");
        require(shares > 0, "InstantPool: zero shares");
        faceValue = vault.sharesToAssets(shares);
        require(faceValue > 0, "InstantPool: zero face value");
    }

    function _quote(uint256 faceValue) internal view returns (Quote memory q) {
        uint256 liquid = liquidAssets();
        uint256 outstanding = outstandingFaceValue;
        uint256 denom = liquid + outstanding;
        require(denom > 0, "InstantPool: no liquid assets");

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
