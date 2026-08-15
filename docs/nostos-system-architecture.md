# Nostos System Architecture & User Flows

This document outlines the high-level system architecture, smart contract architecture, interaction flows, user interface journeys, data flow, frontend component tree, and security model for the Nostos decentralized RWA Yield Gateway & Settlement Protocol.

## 1. High-Level System Architecture

```mermaid
graph TD
    %% Frontend Components
    subgraph Frontend [Nostos Next.js App]
        UI[User Interface]
        Wagmi[Wagmi / Viem]
        UI --> Wagmi
    end

    %% External Services
    subgraph External [External Data Sources]
        YieldAPI[RWA Yield APIs]
        PriceFeed[Price / NAV Oracle]
    end

    %% Off-chain Services
    subgraph Offchain [Off-chain Services]
        Keeper[Keeper Bot]
        Indexer[RWA Data Indexer]
    end

    %% BOT Chain Smart Contracts
    subgraph SmartContracts [BOT Chain Smart Contracts]
        NostosVault[NostosGatewayVault]
        NostosQueue[NostosQueueEngine]
        InstantPool[NostosInstantPool]
        MockUSDT[MockERC20 USDT]
    end

    %% Interactions
    Wagmi -- RPC Calls --> SmartContracts
    Keeper -- trigger finalizeEpoch() --> NostosVault
    Indexer -- Listen to Events --> SmartContracts
    Wagmi -- Read State --> Indexer
    Keeper -. fetch yield .-> YieldAPI
    Keeper -. fetch NAV .-> PriceFeed

    NostosVault <--> NostosQueue
    NostosVault <--> MockUSDT
    InstantPool <--> NostosQueue
    InstantPool <--> MockUSDT
```

## 2. Smart Contract Architecture

```mermaid
classDiagram
    class NostosGatewayVault {
        +uint256 totalAssets
        +uint256 epochId
        +enum epochState
        +mapping redemptionRequests
        +deposit(assets, receiver)
        +mint(shares, receiver)
        +requestRedeem(shares, owner, data)
        +claimRedeem(requestId)
        +finalizeEpoch()
    }
    
    class NostosQueueEngine {
        +struct RedemptionTicket
        +createTicket()
        +transferTicket()
        +getTicketStatus()
        +getQueuePosition()
    }

    class NostosInstantPool {
        +uint256 totalLiquidity
        +uint256 discountBps
        +uint256 protocolFeeBps
        +depositLiquidity(amount)
        +withdrawLiquidity(amount)
        +instantCashout(ticketId)
        +claimSettledTicket(ticketId)
    }

    class NostosRegistry {
        +mapping registeredVaults
        +registerVault()
        +getVaultInfo()
        +updateYieldData()
    }

    class MockUSDT {
        +mint(to, amount)
    }

    class RedemptionTicket {
        <<struct>>
        +uint256 ticketId
        +address owner
        +uint256 shares
        +uint256 assets
        +uint256 epochId
        +enum status
    }

    NostosGatewayVault --> NostosQueueEngine : Uses for tickets
    NostosInstantPool --> NostosQueueEngine : Buys tickets
```

## 3. Contract Interaction Flows

### 3.1 Deposit Flow

```mermaid
sequenceDiagram
    actor User
    participant Frontend
    participant USDT as MockUSDT
    participant Vault as NostosGatewayVault

    User->>Frontend: Click Deposit
    Frontend->>USDT: approve(Vault, amount)
    USDT-->>Frontend: Success
    Frontend->>Vault: deposit(amount, User)
    Vault->>USDT: transferFrom(User, Vault, amount)
    Vault->>Vault: mint(shares) to User
    Vault-->>User: Issue nUSDY (Vault Shares)
```

### 3.2 Standard Redemption Flow

```mermaid
sequenceDiagram
    actor User
    participant Vault as NostosGatewayVault
    participant Queue as NostosQueueEngine
    participant Keeper as Keeper Bot
    participant USDT as MockUSDT

    User->>Vault: requestRedeem(shares)
    Vault->>Queue: createTicket(User, shares)
    Queue-->>User: Mint Redemption Ticket (Pending)
    
    Note over Keeper,Vault: Time Passes (Epoch Maturity)
    Keeper->>Vault: finalizeEpoch()
    Vault->>Queue: Update epoch tickets to Claimable
    Vault->>USDT: Inject liquidity for settlement
    
    User->>Vault: claimRedeem(ticketId)
    Vault->>Queue: Update ticket status to Claimed
    Vault->>USDT: transfer(User, settledAmount)
```

### 3.3 Instant Cashout Flow

```mermaid
sequenceDiagram
    actor User
    participant Pool as NostosInstantPool
    participant Queue as NostosQueueEngine
    participant Vault as NostosGatewayVault
    participant Keeper as Keeper Bot
    participant USDT as MockUSDT

    User->>Pool: instantCashout(ticketId)
    Pool->>Queue: getTicketStatus(ticketId)
    Queue-->>Pool: Status: Pending
    Pool->>Queue: transferTicket(User, Pool)
    Pool->>USDT: transfer(User, amount - 0.3% discount)
    
    Note over Keeper,Vault: Later (Epoch Finalized)
    Keeper->>Vault: finalizeEpoch()
    Vault->>Queue: Update tickets to Claimable
    
    Pool->>Vault: claimRedeem(ticketId)
    Vault->>USDT: transfer(Pool, fullAmount)
```

### 3.4 LP Deposit/Withdraw Flow

```mermaid
sequenceDiagram
    actor LP
    participant Pool as NostosInstantPool
    participant USDT as MockUSDT

    LP->>USDT: approve(Pool, amount)
    LP->>Pool: depositLiquidity(amount)
    Pool->>USDT: transferFrom(LP, Pool, amount)
    Pool-->>LP: Record LP Share
    
    Note over LP,Pool: Time passes, Pool earns discount fees
    
    LP->>Pool: withdrawLiquidity(shareAmount)
    Pool->>USDT: transfer(LP, shareAmount + yield)
```

### 3.5 Keeper/Oracle Flow

```mermaid
sequenceDiagram
    participant Cron as Cron Job
    participant Keeper as Keeper Bot
    participant Oracle as Price/NAV Oracle
    participant Vault as NostosGatewayVault

    Cron->>Keeper: Trigger Check
    Keeper->>Vault: Check Epoch Status
    alt Epoch Matured
        Keeper->>Oracle: fetch NAV/Yield
        Oracle-->>Keeper: Return latest data
        Keeper->>Vault: finalizeEpoch(epochId, settledAmount)
        Vault-->>Keeper: Success, Emits EpochFinalized
    end
```

## 4. User Interface Flows

### 4.1 First-Time User Journey

```mermaid
flowchart TD
    Landing[Landing Page] --> Connect[Connect Wallet]
    Connect --> Discovery[Discovery Explorer]
    Discovery --> Select[Select Vault]
    Select --> Review[Review Yield & Details]
    Review --> Approve[Approve USDT]
    Approve --> Deposit[Confirm Deposit]
    Deposit --> Portfolio[View Portfolio]
```

### 4.2 Redemption Journey

```mermaid
flowchart TD
    Portfolio[Portfolio Dashboard] --> Select[Select Position]
    Select --> ClickRedeem[Click Redeem]
    ClickRedeem --> Amount[Choose Amount]
    Amount --> Options{Select Option}
    Options -- Standard --> RequestRedeem[Confirm Standard Redeem]
    Options -- Instant --> InstantCashout[Confirm Instant Cashout]
    RequestRedeem --> Track[Track Queue Progress]
    InstantCashout --> Receive[Receive Discounted USDT Instantly]
```

### 4.3 LP Journey

```mermaid
flowchart TD
    LPDash[LP Dashboard] --> DepositPool[Deposit USDT to Pool]
    DepositPool --> Metrics[Monitor Pool Metrics: TVL, APR]
    Metrics --> Withdraw[Withdraw Liquidity + Yield]
```

## 5. Data Flow Architecture

```mermaid
graph LR
    subgraph OnChain [On-Chain State]
        Events[Contract Events]
        State[Contract Balances/State]
    end

    subgraph OffChain [Off-Chain Infrastructure]
        Indexer[Data Indexer]
        DB[(Queryable Database)]
        Keeper[Keeper Bot]
    end

    subgraph Client [Frontend App]
        RPC[Direct RPC Calls]
        API[API / GraphQL]
    end

    Events --> Indexer
    Indexer --> DB
    DB --> API
    State --> RPC
    RPC --> Client
    API --> Client
    Client -- Transactions --> State
    Keeper -- Finalize/Update --> State
```

## 6. Frontend Component Architecture

```mermaid
graph TD
    App[App Shell]
    App --> Header
    App --> Sidebar
    App --> MainContent
    
    MainContent --> Discovery[Pages: Discovery]
    MainContent --> VaultDetail[Pages: Vault Detail]
    MainContent --> Portfolio[Pages: Portfolio]
    MainContent --> Queue[Pages: Redemption Queue]
    MainContent --> LP[Pages: LP Dashboard]
    
    Shared[Shared Components]
    Shared -.-> Wallet[WalletConnect]
    Shared -.-> Card[VaultCard]
    Shared -.-> Tracker[QueueTracker]
    Shared -.-> Modal[TransactionModal]
    
    Hooks[React Hooks]
    Hooks -.-> useVault[useVaultData]
    Hooks -.-> useQueue[useRedemptionQueue]
    Hooks -.-> usePool[useInstantPool]
    Hooks -.-> usePort[usePortfolio]
```

## 7. Security Model

- **Role-based Access Control (RBAC):**
  - **Owner:** Can upgrade contracts, pause/unpause, adjust fees (within limits).
  - **Keeper:** Authorized to call `finalizeEpoch()` and inject settlement liquidity.
  - **User:** Can only interact with their own assets and tickets.

- **Pausable Pattern:**
  - Implemented on `NostosGatewayVault` and `NostosInstantPool` to halt deposits, standard redemptions, and instant cashouts during emergencies.
  - Withdrawal of already settled assets remains active if possible.

- **Reentrancy Guards:**
  - Standard `nonReentrant` modifier applied to all state-changing functions, especially `deposit()`, `claimRedeem()`, `instantCashout()`, and LP functions.

- **Slippage & Parameter Protection:**
  - Hardcoded maximum limits on `discountBps` to prevent governance attacks on LPs/Users.
  - Oracle checks for NAV drops before allowing instant cashout to prevent pool draining on bad debt.
  - Verification that the `ticketId` exists and is `Pending` before processing `instantCashout()`.
