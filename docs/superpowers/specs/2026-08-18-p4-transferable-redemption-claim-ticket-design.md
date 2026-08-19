# P4 Transferable Redemption Claim Ticket

## Status

Approved design. This document is intentionally uncommitted because the task
requires all changes to remain uncommitted.

## Objective

Turn every P4 asynchronous redemption request into a transferable ERC-721
economic claim without changing or implying an upgrade to the deployed P3
`NostosAsyncVault`.

The P4 lifecycle is:

```text
USDT -> deposit -> shares -> requestRedeem -> PENDING
-> settler -> CLAIMABLE -> current ticket owner claims -> CLAIMED
```

The P4 ticket is authoritative for current claim ownership. The P4 vault is
authoritative for shares, request state, settlement, reserved liquidity, and
the actual USDT payout.

## Scope

### In scope

- A new versioned `NostosAsyncVaultP4` deployment artifact.
- A new `NostosRedemptionTicket` ERC-721 contract.
- One-time vault-to-ticket configuration with an immutable ticket binding.
- Atomic request creation and ticket minting.
- Transfer-aware claim authorization.
- Standard ERC-721 transfer and approval behavior.
- A small `claimRedeem(requestId, receiver)` P4 extension.
- P4 deployment, registry, and settlement tooling guarded for BOT Testnet.
- Ticket-aware frontend reads, transfer, and claim UX.
- Demo-vault metadata and snapshot updates.
- Foundry, unit, typecheck, lint, build, and E2E coverage.

### Out of scope

- Any write to BOT Testnet or Mainnet.
- Any mutation or upgrade of the deployed P3 vault.
- Mainnet writes or configuration changes.
- Marketplace, order book, pricing, ticket financing, or InstantPool.
- Cancellation, partial claims, batching, or new settlement economics.
- OUSG/TBILL execution changes.
- P5 work.

## Existing P3 Boundary

The deployed P3 vault remains the existing `NostosAsyncVault` at the address
currently stored in the top-level `asyncVault` fields of
`contracts/addresses/bot-testnet.json`.

The P3 source, ABI, tests, CLI, and address history remain valid evidence of
the P3 lifecycle. P4 uses new source and artifact names so no code, address,
or registry entry suggests that P3 was upgraded.

The existing top-level address fields are never overwritten by P4 tooling.

## Contract Architecture

### `NostosRedemptionTicket`

`NostosRedemptionTicket.sol` inherits OpenZeppelin Contracts 5.3 `ERC721`.

Constructor and state:

```solidity
constructor(address vault_)
    ERC721("Nostos Redemption Claim Ticket", "NOSTOS-CLAIM")

address public immutable vault;
```

The constructor rejects the zero address. `vault` is immutable and identifies
the only contract allowed to create or destroy claims.

The contract exposes:

```solidity
function mint(address to, uint256 tokenId) external;
function burn(uint256 tokenId) external;
function isAuthorized(address spender, uint256 tokenId)
    external
    view
    returns (bool);
```

`mint` and `burn` revert unless `msg.sender == vault`. `mint` uses `_safeMint`
so a contract controller must implement `IERC721Receiver`. `burn` uses the
standard ERC-721 burn path. The contract does not store request status, shares,
assets, settlement timestamps, or a second owner field.

All standard ERC-721 methods remain inherited:

- `ownerOf`
- `transferFrom`
- `safeTransferFrom`
- `approve`
- `getApproved`
- `setApprovalForAll`
- `isApprovedForAll`

`isAuthorized` derives authorization from current ERC-721 state:

```text
spender == owner
or getApproved(tokenId) == spender
or isApprovedForAll(owner, spender)
```

The ticket supports the inherited ERC-721, ERC-721 Metadata, and ERC-165
interfaces. No enumerable, marketplace, or pricing extension is added.

### `NostosAsyncVaultP4`

`NostosAsyncVaultP4.sol` is a fresh, non-upgradeable P4 vault implementation
with the P3 ERC-4626 and ERC-7540-style behavior copied deliberately rather
than refactoring the deployed P3 source.

It preserves:

- the verified underlying asset constructor argument;
- 1:1 demo share-to-asset conversion;
- locked shares held by the vault;
- `Pending`, `Claimable`, and `Claimed` request states;
- one active request per controller;
- `SETTLER_ROLE` settlement authorization;
- `reservedClaimableAssets` accounting;
- pause behavior that leaves already-claimable funds claimable;
- SafeERC20, CEI, and ReentrancyGuard protections;
- existing ERC-4626 and applicable ERC-7540 signatures.

The P4 vault adds:

```solidity
address public redemptionTicket;

function configureRedemptionTicket(address ticket) external;

function claimRedeem(uint256 requestId, address receiver)
    external
    returns (uint256 assets);
```

`configureRedemptionTicket` is restricted to the default admin, rejects zero,
requires the supplied ticket's immutable `vault()` to equal `address(this)`,
and reverts if `redemptionTicket` is already configured. No replacement or
second activation path exists.

`requestRedeem` reverts while `redemptionTicket == address(0)`. Once configured,
successful request creation performs the following atomically:

```text
validate request/operator/active-request constraints
lock owner shares in the vault
allocate the next requestId
store the Pending request
set requestController and activeRequestId
ticket.mint(controller, requestId)
emit RedeemRequest
```

Any mint or safe-receiver failure reverts the complete transaction, including
the share transfer and request state.

The ticket is minted to `controller`, which is the economic claim recipient in
the existing request flow. The request's stored `owner` remains the original
share owner for request provenance and ERC-7540-style read data; it is never
used as the live claim authorization source.

### Claim authorization and compatibility

`claimRedeem(requestId, receiver)` resolves the request through
`requestController[requestId]`, checks `Claimable`, and calls the ticket's
current authorization view. The original controller cannot claim solely by
having created the request.

The existing-shaped `redeem(shares, receiver, controller)` and
`withdraw(assets, receiver, controller)` functions remain available. They use
the existing `activeRequestId[controller]` lookup and enforce the same current
ticket authorization before executing the claim. ERC-7540 vault operators do
not bypass ticket ownership for claims; they remain applicable to request
creation only.

The explicit P4 extension is the canonical frontend path because it accepts a
request ID directly and works naturally after transfer. No existing signature
is falsely redefined as an ERC-7540 transfer primitive.

Pending and claimable request views derive the displayed economic owner from
`ticket.ownerOf(requestId)` at read time. They do not copy that owner into a
mutable vault field. The original request owner/sender remains available as
request provenance.

### Final claim effects

All claim paths converge on one internal implementation:

```text
check Claimable and full amount
check current ticket owner or ERC-721 approval
decrease reservedClaimableAssets
mark request Claimed and clear activeRequestId
burn locked shares
burn Ticket #requestId
emit claim/request events
SafeERC20 transfer real USDT to receiver
```

The function remains non-reentrant and is not blocked by `pause` after the
request is Claimable. If the USDT transfer fails, the complete transaction
reverts, including the ticket burn and request effects.

## Settlement

P4 settlement remains identical in meaning to P3:

```text
Pending -> Claimable
```

Only `SETTLER_ROLE` can settle. Settlement checks required assets against
unreserved real USDT, increases `reservedClaimableAssets`, and does not inspect
or mutate ticket ownership. Transfers during Pending or Claimable do not alter
shares, assets, reserved liquidity, or request status.

The P4 settlement CLI reads and prints:

- request ID and controller;
- request state, shares, and required assets;
- P4 ticket address and current `ownerOf(requestId)`;
- vault assets, reserved assets, and unreserved liquidity;
- settlement transaction and explorer URL after an explicitly authorized
  write.

## Address Provenance and Deployment

The address file keeps existing P3 fields and adds a nested P4 record:

```json
{
  "registry": "...",
  "asyncVault": "<existing P3 address>",
  "asyncVaultTx": "<existing P3 deployment tx>",
  "asyncVaultBlock": "<existing P3 block>",
  "p4": {
    "asyncVault": "<P4 address>",
    "asyncVaultTx": "<P4 deployment tx>",
    "asyncVaultBlock": "<P4 block>",
    "asyncVaultDeployedAt": "<timestamp>",
    "redemptionTicket": "<ticket address>",
    "redemptionTicketTx": "<ticket deployment tx>",
    "redemptionTicketBlock": "<ticket block>",
    "redemptionTicketDeployedAt": "<timestamp>",
    "configureTx": "<configuration tx>",
    "configuredAt": "<timestamp>"
  }
}
```

P4 tooling persists intermediate deployment facts without erasing P3
provenance. On rerun it verifies existing P4 addresses and configuration state
before deciding whether a step is still required. It never silently replaces
an existing P4 deployment record.

The guarded command set is:

```text
P4_ENABLE_TESTNET_DEPLOY=true npm run deploy:vault:p4:testnet
P4_ENABLE_TESTNET_DEPLOY=true npm run register:vault:p4:testnet
P4_ENABLE_TESTNET_DEPLOY=true npm run settle:request:p4:testnet -- <requestId>
```

All scripts require the server-only `BOT_TESTNET_PRIVATE_KEY`, verify live
chain ID `968`, use verified Testnet USDT, preserve stale-RPC safeguards, and
remain disabled or refuse without explicit opt-in. None is run during P4
implementation.

## Registry and Metadata

The demo-vault metadata changes only the Nostos demonstration record to state:

- BOT Testnet settlement infrastructure;
- 0% yield;
- no RWA backing;
- asynchronous redemption;
- transferable redemption claim ticket.

OUSG and TBILL remain `DISCOVERY_ONLY`. The metadata snapshot produces a new
hash for the demo-vault record. P4 registry tooling uses the P4 vault address
and new hash, but no registry transaction is sent during this task.

## Frontend

The P4 address and ticket address are loaded only from the nested persisted P4
record. If that record is absent, the existing P3 demo panel remains active and
truthful. The existing P3 address is never treated as a ticketized vault.

When P4 is available, the vault detail route renders a ticket-aware panel with
live reads for:

- vault and ticket addresses;
- request ID, controller, status, shares, and claimable assets;
- current ticket owner;
- ERC-721 per-token approval and operator approval;
- current wallet's ticket authorization;
- the current wallet's owned unclaimed tickets.

Owned-ticket discovery reads `nextRequestId` and checks each existing token ID
with `ownerOf` through the provider. Burned IDs are ignored when the standard
owner read reverts. This is deliberately a small-demo discovery mechanism, not
an indexer or local ownership cache.

The panel displays:

```text
REDEMPTION CLAIM
Ticket #7
Request #7
Status Pending / Claimable
Current owner 0x...
```

The transfer form validates a nonzero EVM address and calls
`safeTransferFrom(currentOwner, recipient, ticketId)`. Transfer and claim
transactions use REVIEW, SIGN, SUBMITTED, CONFIRMING, CONFIRMED, and FAILED
stages with real BOT Scan links.

The panel includes:

> The redemption ticket represents the right to receive this request's
> settlement proceeds. Transferring it transfers that right.

After transfer, all displayed ownership and Claim availability are refreshed
from contract reads. A previous owner cannot claim, and a new owner can find
the ticket through current on-chain ownership.

No marketplace, Instant Cashout, fake liquidity, APY, TVL, or local ownership
state is introduced.

## Testing

### Foundry coverage

Add P4 tests for:

1. exactly one ticket minted per request;
2. `ticketId == requestId`;
3. only the vault can mint and burn;
4. request rejection before ticket configuration;
5. one-time configuration and no replacement;
6. PENDING ticket transfer;
7. CLAIMABLE ticket transfer;
8. transfer preserving request shares/assets/status;
9. original owner rejection after transfer;
10. current ticket owner successful claim;
11. approved per-token operator claim;
12. ERC-721 `setApprovalForAll` operator claim;
13. unauthorized wallet rejection;
14. successful claim burns the ticket;
15. double-claim rejection;
16. reserved-liquidity invariant after transfer and claim;
17. multi-user claims do not cross request ownership;
18. paused vault still permits already-claimable claim;
19. `safeTransferFrom` to a valid `IERC721Receiver`;
20. `safeTransferFrom` to an invalid receiver reverts atomically;
21. request mint to an invalid receiver reverts the request atomically;
22. standard ERC-721 approvals and interface support.

All applicable P3 tests remain and continue to target the P3 contract. P4 tests
target only the new P4 contracts.

### TypeScript and E2E coverage

- Add unit coverage for P4 deployment-plan gating, address schema, P4 metadata,
  and ticket-aware settlement reporting.
- Add E2E coverage for P4 ticket display, transfer form validation, transfer
  stages, refreshed owner state, and claim visibility using an isolated RPC
  fixture. The fixture is test-only; production reads remain real contract
  reads.
- Keep existing truthful-state and P3 fallback E2E coverage.

## Verification Gate

Run:

```bash
npm test
npx tsc --noEmit
npm run lint
npm run build
npm run test:e2e

cd contracts
forge test
cd ..
```

No completion claim is made until all relevant commands pass. No deployment,
registry write, USDT transfer, or settlement write is part of verification.

## Acceptance Criteria

The implementation is complete when all of the following are true locally:

- P3 source, address, scripts, and tests remain intact and clearly identified.
- P4 request creation mints exactly one ticket atomically.
- Ticket ownership is transferable in both Pending and Claimable states.
- Claim authority follows current ERC-721 owner/approval state immediately.
- Alice cannot claim after transferring to Bob; Bob can claim after settlement.
- Successful claim burns the ticket and leaves no double-claim path.
- Reserved liquidity and locked-share accounting remain correct.
- Ticket configuration is required, bound to the vault, and irreversible.
- P4 address history is stored separately from P3 history.
- Frontend ownership and actions come from real reads.
- Metadata truthfully describes transferable asynchronous redemption.
- All unit, typecheck, lint, build, E2E, and Foundry gates pass.
- No blockchain write or P5 feature has been performed.
