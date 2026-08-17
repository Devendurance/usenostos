# Left Off

## Current Task
P0 BOT Mainnet reality check is complete. Next milestone is P1 (consuming the canonical chain definition and verified settlement token from the frontend).

## Completed In This Session
- Installed Viem (runtime), Vitest and tsx (dev), added `doctor:mainnet`, `write-proof:mainnet`, `test`, `test:unit` scripts, `.env.example`, and un-ignored `.env.example`.
- Added canonical BOT Mainnet chain definition (`lib/chain/bot-mainnet.ts`), provenance surface (`lib/chain/provenance.ts`), settlement-token record/gate (`lib/chain/settlement-token.ts`), server-only builder wallet reader (`lib/chain/builder-wallet.ts`), and opt-in write-proof guard (`lib/chain/write-proof.ts`).
- Added read-only doctor (`scripts/doctor-mainnet.ts`) and opt-in write-proof script (`scripts/mainnet-write-proof.ts`).
- Added 23 deterministic Vitest unit tests (`tests/unit/`) and `vitest.config.mts`.
- Live doctor run on BOT Mainnet: chain 677 verified, latest block ~19,979,422, RPC capability audit OK, `eth_getLogs` responded for a 200-block range.
- USDT investigation concluded: VERIFIED at `0xaBabc7Ddc03e501d190C676BF3d92ef0e6e87a3C` (symbol USDT, 6 decimals, total supply 58,960,200), based on official BOT dev docs and on-chain reads.

## Files Involved
- `lib/chain/*` (bot-mainnet, provenance, settlement-token, builder-wallet, write-proof)
- `scripts/doctor-mainnet.ts`, `scripts/mainnet-write-proof.ts`
- `tests/unit/*.test.ts`, `vitest.config.mts`
- `package.json`, `package-lock.json`, `.env.example`, `.gitignore`
- `docs/superpowers/plans/2026-08-17-p0-bot-mainnet-reality-check.md`

## Verification
- `npm test`: 23 passed.
- `npx tsc --noEmit`: passed.
- `npm run lint`: passed.
- `npm run build`: passed (all routes).
- `npm run doctor:mainnet`: chain 677 verified, latest block read, USDT VERIFIED.

## Blockers
- Builder wallet not configured in this environment; doctor reports NOT CONFIGURED. Add `BOT_BUILDER_PRIVATE_KEY` locally to enable wallet checks (never commit it).
- BOT Scan displays conflicting token metadata for the verified USDT token ("Stub Token (goerli)"); recorded as an explorer artifact.
- Existing unrelated documentation and UI worktree changes remain unstaged and must be preserved.

## Next Action
Begin P1: consume `botMainnet` and `BOT_USDT` from the frontend (chain switching, wallet connect flow), and re-run `npm run doctor:mainnet` before any contract or write work.