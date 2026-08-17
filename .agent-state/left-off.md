# Left Off

## Current Task
P3 Nostos Async Settlement Vault implementation is complete (contract + tests + tooling + frontend). Next milestone is P4 ticketization (not started).

## Completed In This Session (P3 continuation)
- Recovered prior P3 state: `NostosAsyncVault.sol`, `interfaces/IERC7540.sol` + `IERC7575.sol`, `NostosAsyncVault.t.sol` (32 Foundry tests green), `scripts/registry/deploy-vault.ts` + `vault-plan.ts` + `artifact.ts`, and the P2 env-loading fix (already applied).
- Added demo-vault opportunity `lib/rwa/opportunities/demo-vault.ts` (REDEMPTION_SUPPORTED, 0% yield, no RWA backing) and added it to the opportunities list, card badge, and explore category.
- Added `lib/contracts/nostos-async-vault-abi.ts`, `lib/chain/deployed-addresses.ts`, `lib/chain/vault-hooks.ts` (live reads + writes), and `components/product/demo-vault-panel.tsx` (real approve→deposit, requestRedeem, claim with REVIEW→SIGN→SUBMITTED→CONFIRMING→CONFIRMED/FAILED stages + explorer links).
- Wired the demo vault into the Vault Detail route (`/vaults/nostos-async-vault`).
- Added `scripts/registry/settle.ts` (settlement CLI, P3 opt-in, chain-968 guard, reads request first, refuses insufficient unreserved liquidity) and `scripts/registry/register-vault.ts` (registers/updates the demo vault as REDEMPTION_SUPPORTED with nostosVault).
- Added npm scripts `deploy:vault:testnet`, `settle:request:testnet`, `register:vault:testnet`; unit tests `tests/unit/vault-plan.test.ts`; updated `rwa-opportunities.test.ts` and explore e2e for the demo vault.

## Files Involved
- `contracts/src/NostosAsyncVault.sol`, `contracts/src/interfaces/{IERC7540,IERC7575}.sol`, `contracts/test/NostosAsyncVault.t.sol`
- `lib/rwa/opportunities/demo-vault.ts`, `lib/contracts/nostos-async-vault-abi.ts`, `lib/chain/{deployed-addresses,vault-hooks}.ts`
- `components/product/{demo-vault-panel,opportunity-card,explorer-controls}.tsx`
- `app/(product)/vaults/[address]/page.tsx`
- `scripts/registry/{vault-plan,artifact,deploy-vault,settle,register-vault}.ts`
- `tests/unit/{vault-plan,rwa-opportunities}.test.ts`, `tests/e2e/nostos.spec.ts`
- `package.json`, `.agent-state/*`, `docs/superpowers/plans/2026-08-17-p3-...md`

## Verification
- `npm test`: 97 passed.
- `npx tsc --noEmit`: passed.
- `npm run lint`: passed.
- `npm run build`: passed (all routes).
- `npm run test:e2e`: 28 passed.
- `forge test` (contracts): 32 passed.
- `npm run snapshot:rwa` prints the demo vault integration id `0x508c…5a2b` + metadata hash `0xd946…74e9`.
- `deploy:vault:testnet` / `settle:request:testnet` exit DISABLED without `P3_ENABLE_TESTNET_DEPLOY=true`; `register:vault:testnet` refuses until asyncVault is persisted. No deployment/settlement/registration executed.

## Blockers
- The demo vault is NOT deployed to BOT Testnet (requires explicit authorization + `P3_ENABLE_TESTNET_DEPLOY=true`); the frontend truthfully shows "Vault not deployed".
- Settlement authority is admin CLI tooling only; the UI never marks a request Claimable by timer.
- Stale `rpc.bohr.life` backends may transiently disagree with the explorer during manual verification.

## Next Action
P4 not started. Manual end-to-end: deploy vault → register in NostosRegistry → connect wallet on 968 → deposit USDT → requestRedeem → run settle CLI → claim → verify on BOT Scan.