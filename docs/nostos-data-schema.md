# Nostos: Smart Contract Data Structures & Database Schema

This document serves as the authoritative technical reference for Nostos, a decentralized RWA Yield Gateway & Settlement Protocol on BOT Chain. It outlines the exact data structures, database schema, API endpoints, and frontend state management schemas to be implemented by coding agents.

---

## 1. On-Chain Data Structures (Solidity)

The following structs, enums, and state variables form the core of the Nostos smart contract architecture. 

### 1.1 NostosGatewayVault State
This contract handles user deposits, yield accrual, and asynchronous redemption requests (ERC-7540 compliant).

```solidity
// Core vault state
uint256 public totalManagedAssets;
uint256 public currentEpochId;
mapping(uint256 => Epoch) public epochs;
mapping(uint256 => RedemptionRequest) public redemptionRequests;
uint256 public nextRequestId;

struct Epoch {
    uint256 epochId;
    uint256 totalSharesQueued;
    uint256 totalAssetsSettled;
    uint256 startTimestamp;
    uint256 finalizedTimestamp;
    EpochStatus status; // Open, Closed, Finalized
}

enum EpochStatus { Open, Closed, Finalized }

struct RedemptionRequest {
    uint256 requestId;
    address owner;
    uint256 shares;
    uint256 assetsClaimable;
    uint256 epochId;
    uint256 requestTimestamp;
    RequestStatus status;
}

enum RequestStatus { Pending, Claimable, Claimed, InstantCashed }
```

### 1.2 NostosQueueEngine State
This contract tokenizes redemption requests into transferable NFTs/tickets, enabling secondary markets and instant cashouts.

```solidity
struct RedemptionTicket {
    uint256 ticketId;
    address currentOwner;
    address originalOwner;
    uint256 shares;
    uint256 estimatedAssets;
    uint256 finalAssets;
    uint256 epochId;
    uint256 createdAt;
    uint256 claimedAt;
    TicketStatus status;
}

enum TicketStatus { Pending, Claimable, Claimed, Transferred }

mapping(uint256 => RedemptionTicket) public tickets;
mapping(address => uint256[]) public userTickets;
uint256 public nextTicketId;
uint256 public totalPendingShares;
```

### 1.3 NostosInstantPool State
This contract provides instant liquidity for users willing to take a haircut on their pending redemption tickets.

```solidity
uint256 public totalPoolLiquidity;
uint256 public availableLiquidity;
uint256 public lockedLiquidity; // locked in pending tickets
uint256 public discountBps; // default 30 (0.3%)
uint256 public protocolFeeBps; // default 3 (0.03%)
address public protocolFeeRecipient;

mapping(address => uint256) public lpDeposits;
mapping(uint256 => PoolClaim) public poolClaims; // ticketId -> claim info

struct PoolClaim {
    uint256 ticketId;
    uint256 paidToUser;
    uint256 expectedSettlement;
    uint256 protocolFee;
    uint256 lpProfit;
    bool settled;
}
```

### 1.4 NostosRegistry State
A central registry to track all verified vaults, APYs, and asset classifications.

```solidity
struct VaultInfo {
    address vaultAddress;
    string name;
    string symbol;
    string assetCategory; // 'treasury', 'credit', 'commodity', 'realestate'
    address underlyingAsset;
    uint256 currentAPY; // basis points
    uint256 averageSettlementTime; // seconds
    uint256 totalValueLocked;
    uint256 healthScore; // 0-10000 (basis points for 0-100%)
    bool isActive;
}

mapping(address => VaultInfo) public vaults;
address[] public vaultList;
```

### 1.5 Events (All Contracts)
These events must be emitted precisely as defined for the indexer to accurately track state changes.

```solidity
// Vault Events
event Deposited(address indexed user, uint256 assets, uint256 shares);
event RedeemRequested(uint256 indexed requestId, address indexed owner, uint256 shares, uint256 epochId);
event EpochFinalized(uint256 indexed epochId, uint256 totalAssetsSettled);
event RedeemClaimed(uint256 indexed requestId, address indexed owner, uint256 assets);

// Queue Events
event TicketCreated(uint256 indexed ticketId, address indexed owner, uint256 shares, uint256 epochId);
event TicketTransferred(uint256 indexed ticketId, address indexed from, address indexed to);
event TicketClaimed(uint256 indexed ticketId, address indexed owner, uint256 assets);

// InstantPool Events
event LiquidityDeposited(address indexed lp, uint256 amount);
event LiquidityWithdrawn(address indexed lp, uint256 amount);
event InstantCashoutExecuted(uint256 indexed ticketId, address indexed user, uint256 paidAmount, uint256 discount);
event PoolClaimSettled(uint256 indexed ticketId, uint256 totalAmount, uint256 lpProfit);

// Registry Events
event VaultRegistered(address indexed vault, string name, string category);
event VaultUpdated(address indexed vault, uint256 newAPY, uint256 newTVL);
```

---

## 2. Off-Chain Database Schema (Indexer/API)

The following tables define the relational database schema required to power the frontend API. This can be implemented in PostgreSQL or SQLite.

### 2.1 vaults table
| Column | Type | Description |
|--------|------|-------------|
| vault_address | string (PK) | On-chain vault contract address |
| name | string | Display name |
| symbol | string | Token symbol |
| asset_category | enum | treasury, credit, commodity, realestate |
| underlying_asset | string | Underlying token address |
| current_apy_bps | integer | Current APY in basis points |
| avg_settlement_seconds | integer | Average settlement time |
| total_value_locked | decimal | Current TVL |
| health_score | integer | 0-10000 |
| is_active | boolean | Whether vault accepts deposits |
| created_at | timestamp | Record creation time |
| updated_at | timestamp | Last update time |

### 2.2 deposits table
| Column | Type | Description |
|--------|------|-------------|
| id | uuid (PK) | Unique identifier |
| vault_address | string (FK) | Reference to vaults table |
| user_address | string | Depositor wallet address |
| tx_hash | string | Transaction hash |
| assets_deposited | decimal | Amount of assets deposited |
| shares_received | decimal | Amount of shares minted |
| block_number | integer | Block number of tx |
| timestamp | timestamp | Block timestamp |

### 2.3 redemption_requests table
| Column | Type | Description |
|--------|------|-------------|
| request_id | integer (PK) | On-chain request ID |
| ticket_id | integer | Associated queue ticket |
| vault_address | string | Reference to vaults table |
| owner_address | string | Original requester |
| current_owner | string | Current ticket holder (may differ if transferred) |
| shares | decimal | Shares being redeemed |
| estimated_assets | decimal | Expected asset return |
| final_assets | decimal | NULL until finalized |
| epoch_id | integer | Epoch this request belongs to |
| status | enum | pending, claimable, claimed, instant_cashed |
| request_tx_hash | string | Tx hash for request creation |
| claim_tx_hash | string | Tx hash for claim (NULL until claimed) |
| requested_at | timestamp | Time of initial request |
| finalized_at | timestamp | Time epoch was finalized (NULL until finalized) |
| claimed_at | timestamp | Time assets were claimed (NULL until claimed) |

### 2.4 epochs table
| Column | Type | Description |
|--------|------|-------------|
| epoch_id | integer (PK) | Epoch identifier |
| vault_address | string | Reference to vaults table |
| total_shares_queued | decimal | Total shares queued in epoch |
| total_assets_settled | decimal | Total assets available after settlement (NULL until finalized) |
| status | enum | open, closed, finalized |
| started_at | timestamp | Epoch start time |
| finalized_at | timestamp | Epoch finalization time |

### 2.5 instant_cashouts table
| Column | Type | Description |
|--------|------|-------------|
| id | uuid (PK) | Unique identifier |
| ticket_id | integer | Reference to redemption_requests table |
| user_address | string | Who cashed out |
| paid_amount | decimal | Amount user received |
| discount_amount | decimal | Discount taken (haircut) |
| protocol_fee | decimal | Protocol's cut |
| lp_profit | decimal | Expected LP profit |
| tx_hash | string | Execution tx hash |
| timestamp | timestamp | Execution time |
| settled | boolean | Whether the ticket was later claimed by pool |

### 2.6 lp_positions table
| Column | Type | Description |
|--------|------|-------------|
| id | uuid (PK) | Unique identifier |
| lp_address | string | Liquidity Provider wallet address |
| deposited_amount | decimal | Total assets deposited |
| withdrawn_amount | decimal | Total assets withdrawn |
| current_balance | decimal | Current active balance |
| total_earned | decimal | Cumulative earnings |
| tx_hash | string | Tx hash of last update |
| timestamp | timestamp | Last update time |

---

## 3. API Endpoints (REST)

The indexer will expose the following REST API endpoints for the frontend client:

### Discovery
- `GET /api/vaults` - List all vaults with yield data and stats
- `GET /api/vaults/:address` - Get detailed information for a specific vault
- `GET /api/vaults/:address/history` - Historical yield and TVL data

### Portfolio
- `GET /api/portfolio/:userAddress` - User's active balances and positions across all vaults
- `GET /api/portfolio/:userAddress/deposits` - User's deposit transaction history
- `GET /api/portfolio/:userAddress/redemptions` - User's redemption history

### Queue
- `GET /api/queue/:vaultAddress` - Current epoch queue state and estimated settlement time
- `GET /api/queue/ticket/:ticketId` - Status of a specific redemption ticket
- `GET /api/queue/:userAddress/tickets` - List of all tickets owned by a user

### Instant Pool
- `GET /api/pool/stats` - Pool TVL, utilization rate, and LP APR
- `GET /api/pool/:lpAddress` - Detailed position for a specific LP
- `POST /api/pool/quote/:ticketId` - Calculate instant cashout quote (returns paid amount, discount, and fees)

---

## 4. Frontend State Management

Coding agents implementing the Next.js frontend should use Zustand (or Redux Toolkit) to manage the following state slices. The interfaces provided below serve as the exact specifications.

```typescript
// Wallet State
interface WalletState {
    address: string | null;
    chainId: number | null;
    isConnected: boolean;
}

// Vaults State
interface VaultsState {
    vaults: VaultInfo[];
    selectedVault: VaultInfo | null;
    loading: boolean;
    error: string | null;
}

// Portfolio State
interface PortfolioState {
    positions: Position[];
    totalValue: number;
    totalYield: number;
    loading: boolean;
}

// Queue State
interface QueueState {
    tickets: RedemptionTicket[];
    pendingCount: number;
    estimatedSettlementTime: number; // in seconds
    loading: boolean;
}

// Pool State
interface PoolState {
    tvl: number;
    utilization: number;
    apr: number;
    userPosition: LPPosition | null;
    loading: boolean;
}

// Transaction State
interface TxState {
    pendingTxs: Transaction[];
    recentTxs: Transaction[];
}
```
