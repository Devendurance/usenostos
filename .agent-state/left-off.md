# Left Off

## Current Task
P0.5 Testnet RPC-consistency patch is complete: RPC health sampling, stale-backend classification, transaction preflight, and idempotent signed-once write-proof rebroadcast. Next milestone is P1.

## Completed In This Session
- Added `lib/chain/testnet-rpc-health.ts`: pure `classifyRpcHealth` + live `sampleTestnetRpcHealth`; statuses HEALTHY/DEGRADED/STALE_BACKENDS_DETECTED; centralized thresholds in `TESTNET_RPC_HEALTH_DEFAULTS`.
- Added `lib/chain/testnet-write.ts`: `classifyFunds` (SUFFICIENT / INSUFFICIENT_FUNDS / POSSIBLE_STALE_RPC_BACKEND), `estimateRequiredBalance`, `runIdempotentBroadcast` (bounded, same raw tx + hash), error classifiers, `formatPreflightReport` (no secrets).
- Enhanced `doctor:testnet` with an `RPC CONSISTENCY` section (5 samples, min/max/spread, consistency, health) and optional `BOT_TESTNET_KNOWN_BLOCK` floor check.
- Reworked `write-proof:testnet`: preflight report, fund classification, sign-once + derive hash, bounded rebroadcast of the identical raw transaction, reconciliation of already-known/nonce-too-low by hash, and clear POSSIBLE STALE RPC BACKEND vs INSUFFICIENT TESTNET FUNDS messaging.
- Added 18 new unit tests (57 total) covering classification, bounded retries, same-raw reuse, error detection, and no-secret preflight reports.
- Documented the observed `rpc.bohr.life` behavior in `docs/nostos-environments.md` and added `BOT_TESTNET_KNOWN_BLOCK` to `.env.example`.

## Files Involved
- `lib/chain/testnet-rpc-health.ts`, `lib/chain/testnet-write.ts`
- `scripts/doctor-testnet.ts`, `scripts/write-proof-testnet.ts`
- `tests/unit/rpc-health.test.ts`, `tests/unit/testnet-write.test.ts`
- `.env.example`, `docs/nostos-environments.md`
- `docs/superpowers/plans/2026-08-17-p0.5-testnet-rpc-consistency-patch.md`

## Verification
- `npm test`: 57 passed.
- `npx tsc --noEmit`: passed.
- `npm run lint`: passed.
- `npm run build`: passed (all routes).
- `npm run doctor:testnet`: chain 968 verified; RPC CONSISTENCY section shows 5 samples, spread 7, HEALTHY; configured testnet wallet `0x21E5Fc03E4305CC8CFb874253c6d66A8bdB0bcDa` with 9.99958 tBOT (nonce 1).
- `npm run write-proof:testnet`: confirmed inert (P0_ENABLE_TESTNET_WRITE not set). No transaction broadcast during the patch.

## Blockers
- `.env` (gitignored) contains the testnet private key; the doctor only ever prints the derived address and balance.
- No stale-backend inconsistency was observed during this patch's live run (RPC was HEALTHY), so the retry path was verified only by unit tests, not by a live stale broadcast.

## Next Action
Begin P1. Before any Testnet write, re-run `npm run doctor:testnet`; if `RPC HEALTH` is not HEALTHY, wait for a synchronized backend. When explicitly authorized, run `P0_ENABLE_TESTNET_WRITE=true npm run write-proof:testnet`.