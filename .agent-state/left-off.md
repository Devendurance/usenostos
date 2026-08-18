# Left Off

## Current Task
Vercel production deployment readiness fix is complete. P3 remains complete; P4 ticketization is not started.

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

## Blockers
- No repository build blocker remains.
- If the Vercel Dashboard has an override, it must use the repository root, Next.js framework preset, `npm run build` or default build command, and framework-default output directory. Do not use `.next-build`.

## Next Action
Redeploy from the current uncommitted working tree after applying the dashboard settings above. Do not start P4 in this task.
