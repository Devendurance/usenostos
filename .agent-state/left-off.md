# Left Off

## Current Task
P5 Nostos InstantPool Core is IMPLEMENTED and VERIFIED (uncommitted working tree; P4 already committed in `4673041`/`f6dcd1f`). No P5 deployment/funding/harvest performed; no transactions; `bot-testnet.json` has no `p5` key.

## P5 Deliverables (all uncommitted)
- `contracts/src/NostosInstantPool.sol` + `contracts/test/NostosInstantPool.t.sol` (32 forge tests; total 97 forge tests passing).
- Tooling: `scripts/registry/p5-plan.ts`, `deploy-instant-pool.ts`, `fund-instant-pool.ts`, `harvest-instant-pool.ts`, `tests/unit/p5-plan.test.ts` (4 tests). All guarded by `P5_ENABLE_TESTNET_DEPLOY=true`; deploy verified DISABLED (exit 0) without opt-in; fund/harvest refuse (no persisted pool) with zero writes.
- Frontend: `lib/contracts/nostos-instant-pool-abi.ts`, `lib/chain/instant-pool-hooks.ts`, `components/product/instant-pool-panel.tsx`, `app/(product)/pool/page.tsx` (live panel when persisted/fixture `p5.instantPool`, truthful placeholder fallback). Modified: `lib/chain/deployed-addresses.ts` (P5Deployment type + `p5` fixture), `package.json` (3 scripts), `playwright.config.ts` (`NEXT_PUBLIC_NOSTOS_E2E_P5_FIXTURE`), `scripts/registry/artifact.ts` (instantPool ABI/bytecode).
- E2E: `tests/e2e/p5-rpc-fixture.ts` + `tests/e2e/p5-instant-pool.spec.ts` (4 tests).
- Docs: spec + plan under `docs/superpowers/`.

## Verification (fresh, 2026-08-19)
- `npm test`: 118 vitest pass. `npx tsc --noEmit`: clean. `npm run lint`: clean. `rm -rf .next && npm run build`: clean (placeholder renders in production).
- `npm run test:e2e`: 35/35 pass (fresh server; a stale reused `next dev` server caused transient failures until killed).
- `forge build --root contracts`: clean (pre-existing OZ ERC4626 + P3 test warnings only). `forge test --root contracts -vv`: 97 pass. `forge fmt --check` on P5 files: clean.
- `contracts/out` + `contracts/cache` restored to HEAD (no P5 artifacts left untracked).
- P5 tuple returns mapped to objects in `instant-pool-hooks.ts` (wagmi returns arrays for tuple-returning reads).

## Next Action
Optional: review uncommitted P5 diff (`git diff`, untracked files) and commit when the user asks. Do not deploy/fund/harvest. P6 not started.

## P4 Design
- Spec: `docs/superpowers/specs/2026-08-18-p4-transferable-redemption-claim-ticket-design.md`
- Plan: `docs/superpowers/plans/2026-08-18-p4-transferable-redemption-claim-ticket.md`
- Architecture: fresh non-upgradeable `NostosAsyncVaultP4` plus immutable-bound `NostosRedemptionTicket`.
- Claim authority follows current ERC-721 owner or approval; P3 deployment remains unchanged.
- No deployment, registry write, settlement write, USDT transfer, or P5 work performed.

## Task 2 Constraints
- Do not modify `contracts/src/NostosAsyncVault.sol` or its tests.
- Preserve Task 1 ticket files and approved uncommitted spec/plan/state.
- Ticket ID equals request ID; configure once and require `ticket.vault() == address(this)`.
- Requests must configure/mint atomically; claims use current ticket owner/approval only, remain full-only, reserve-aware, SafeERC20, CEI, non-reentrant, and claimable while paused.

## P4 Task 2 Completion
- Created `contracts/src/NostosAsyncVaultP4.sol` as a copied/versioned P3 lifecycle with one-time ticket configuration, atomic `_safeMint`, dynamic ticket authorization, explicit `claimRedeem`, ticket-aware request views, ticket burn, and preserved pause/reserve/CEI behavior.
- Created `contracts/test/NostosAsyncVaultP4.t.sol` with 25 tests covering request/configuration, request rollback, pending/claimable transfers, owner/per-token/operator authorization, ERC-7540 operator rejection for claims, settlement/accounting, pause, receiver failures, wrappers, double claims, and compatibility.
- No P3 source or tests were modified. Task 1 files and approved docs remain preserved as pre-existing uncommitted work.
- Task 2 files: `contracts/src/NostosAsyncVaultP4.sol`, `contracts/test/NostosAsyncVaultP4.t.sol`, `.agent-state/left-off.md`, and the required task report.

## Completed In This Session
- Confirmed the favicon fix from commit `b5c2f1e`: `app/favicon.ico` is absent, `public/favicon.ico` is tracked, and `app/layout.tsx` explicitly references `/favicon.ico`.
- Reproduced the Vercel output failure: `npm run build` exited `0` but created only `.next-build` because `next.config.ts` defaulted `distDir` to `.next-build`.
- Removed the custom `distDir`; Next now uses its standard `.next` output. Removed the stale `.next-build/` ignore entry.
- Added `tests/unit/deployment-config.test.ts`, including a verified red-green regression check for the default output directory.
- Updated the stale demo-vault E2E assertion to match persisted deployment address `0x2b0475ca0b12e3b8f9634c6ac3190e96508385d4`.
- Made `tests/unit/script-env.test.ts` isolate inherited private-key environment state without changing production secret precedence or loading behavior.

## Files Changed
- `next.config.ts`
- `.gitignore`
- `tests/unit/deployment-config.test.ts`
- `tests/unit/script-env.test.ts`
- `tests/e2e/nostos.spec.ts`
- `.agent-state/left-off.md`

## Verification
- Clean `npm run build`: passed; `.next` exists and `.next-build` is absent.
- `npm test`: 98 passed across 17 files.
- `npx tsc --noEmit`: passed.
- `npm run lint`: passed.
- `npm run test:e2e`: 28 passed.
- `forge test`: 32 passed.
- No `vercel.json`, `vercel.ts`, or Turborepo config exists in the repository.
- No private-key references were found under `app/` or `components/`.
- Worktree remains uncommitted.

## Root Causes
- Favicon: the old `app/favicon.ico` file was processed as an App Router metadata route and Next attempted to resolve `app/favicon.ico/route`, producing `ENOTDIR` because `favicon.ico` is a file, not a directory.
- Output: the repository-controlled `distDir` forced `.next-build`; Vercel checked the standard `.next` directory after the successful build and did not find it.

## P4 Task 1 Completion
- Created `contracts/src/interfaces/INostosRedemptionTicket.sol` with the vault, mint, burn, and authorization API.
- Created `contracts/src/NostosRedemptionTicket.sol` with immutable nonzero vault binding, exact ERC-721 metadata, vault-only safe mint/burn, and dynamic owner/approval/operator authorization.
- Created `contracts/test/NostosRedemptionTicket.t.sol` covering constructor validation, authority, ownership, approvals/events, transfer/safe receiver behavior, invalid receivers, authorization, and ERC-165/ERC-721 support.
- Test-first red run reached the expected missing-source compiler failure; implementation then passed all focused tests.
- No P3 source, product files, deployment addresses, or blockchain write commands were changed or run.

## P4 Task 1 Verification
- Installed Foundry binary: `forge Version 1.7.1`; `forge` is not on the shell PATH.
- Focused equivalent command: `"C:/Users/USER/.foundry/bin/forge.exe" test --match-path test/NostosRedemptionTicket.t.sol`; 8 passed, 0 failed, 0 skipped.
- Full Foundry suite: 40 passed, 0 failed, 0 skipped.
- `forge build`: passed with compilation already cached; scoped `forge fmt --check` passed.
- `npm test`: 98 passed; `npx tsc --noEmit`, `npm run lint`, and `npm run build` passed.
- Generated Foundry output/cache changes were removed or restored; worktree remains uncommitted.

## P4 Task 2 Verification
- Test-first RED: `"C:/Users/USER/.foundry/bin/forge.exe" test --match-path test/NostosAsyncVaultP4.t.sol` failed because `src/NostosAsyncVaultP4.sol` was missing.
- Focused P4: 25 passed, 0 failed, 0 skipped.
- Focused Task 1 ticket: 8 passed, 0 failed, 0 skipped.
- Full Foundry suite: 65 passed, 0 failed, 0 skipped across 4 suites.
- `forge fmt --check src/NostosAsyncVaultP4.sol test/NostosAsyncVaultP4.t.sol`: passed with no output.
- `forge build`: passed; cached final run reported `No files changed, compilation skipped` after the focused suite compiled the new sources successfully.
- `npm test`: 98 passed across 17 files; `npx tsc --noEmit`, `npm run lint`, and `npm run build` passed.
- Generated Foundry output was removed and the tracked Solidity cache was restored; no blockchain write or transaction command was run.
- Report: `.superpowers/sdd/2026-08-18-p4-transferable-redemption-claim-ticket/task-2-report.md`.

## Blockers
- No repository build blocker remains.
- If the Vercel Dashboard has an override, it must use the repository root, Next.js framework preset, `npm run build` or default build command, and framework-default output directory. Do not use `.next-build`.

## Next Action
Task 3 may consume the P4 artifacts only after explicit continuation; deployment/registry/settlement writes remain out of scope until separately authorized.

## P4 Final Completion
- Tasks 1-8 are complete: ticket/vault contracts, Foundry tests, guarded tooling, P4 metadata/ABIs, live-read frontend, isolated fixture E2E coverage, and final verification.
- P4 tooling now checks successful receipts, verifies vault-ticket binding before registry/settlement writes, samples RPC health, and retries the same signed raw transaction idempotently.
- P3 metadata remains separate from P4 ticketed metadata; P3 source and top-level address records were not changed.
- E2E fixture activation requires both `NEXT_PUBLIC_NOSTOS_E2E=true` and `NEXT_PUBLIC_NOSTOS_E2E_P4_FIXTURE`; production ignores the fixture.

## Final Verification
- `npm test`: 114 passed across 20 files.
- `npx tsc --noEmit`: passed.
- `npm run lint`: passed.
- `npm run build`: passed.
- `npm run test:e2e`: 31 passed.
- `C:/Users/USER/.foundry/bin/forge.exe test --root contracts`: 65 passed.
- `forge fmt --check` passed for all new Solidity files.
- P4 deploy/register/settle commands were run without opt-in and each exited disabled; no write was authorized or sent.
- Generated Foundry output/cache changes were removed or restored.
- `contracts/addresses/bot-testnet.json` still contains only the existing P3 address record.

## Known Environment Note
- `forge` is installed at `C:/Users/USER/.foundry/bin/forge.exe` but is not on the shell `PATH`; use the absolute path for future Solidity checks.
- Playwright still reports pre-existing Base UI warnings for marketing `LinkButton` native-button semantics; tests pass and those components were outside this task.

## Next Action
- No implementation work remains. If deployment is explicitly authorized later, run `forge build` first, review the persisted P4 record, then use the opt-in P4 commands only with the required environment variables.
