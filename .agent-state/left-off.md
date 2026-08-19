# Left Off

## Current Task
Preserve the supplied Nostos favicon image exactly, including its warm background and original colors. No transparency processing or branding redesign.

## Change
- `app/icon.png` now uses the supplied `codex-clipboard-c408e441-cde4-4e46-8650-b4665e45d15a.png` asset unchanged (512×512 PNG with the original warm background and black/lilac mark).
- `app/layout.tsx` continues to expose the icon through the App Router metadata path `/icon.png`.
- Existing favicon E2E coverage continues to target `/icon.png`.

## Verification
- Asset inspection: PNG 512×512, 4 channels, original background visible.
- Source and `app/icon.png` SHA-256 hashes match exactly.
- `npm run lint`: passed.
- `npx tsc --noEmit`: passed.
- `npm run build`: passed; `/icon.png` is present in the route manifest.
- `npm test -- --run`: 147 tests passed.
- Favicon Playwright smoke test: passed.

## Prior Work
P6 protocol-fee claim CLI added. Uncommitted. No fee claim, deploy, or Solidity contract change.

## Change
- `lib/chain/builder-wallet.ts`: `BOT_TESTNET_TREASURY_PRIVATE_KEY` getter, no deployer/Mainnet fallback
- `scripts/registry/p6-plan.ts`: `buildP6FeeClaimPlan`, `requireP6AccruedFees`
- `scripts/registry/claim-protocol-fees-p6.ts`
- `tests/unit/p6-fee-claim-plan.test.ts` plus env-safety / script-env coverage
- `lib/contracts/nostos-instant-pool-p6-abi.ts`: `claimProtocolFees()`
- `package.json`: `claim:protocol-fees:p6:testnet`
- P5 tooling and P6 Solidity unchanged.

## Verification
- `npm test`: 147 passed
- `npx tsc --noEmit`: passed
- `npm run lint`: passed
- `npm run claim:protocol-fees:p6:testnet` without opt-in: `P6 FEE CLAIM DISABLED` (no write)

## Next Action
User can claim with `P6_ENABLE_TESTNET_DEPLOY=true`, `P6_PROTOCOL_TREASURY=0xC446…`, and `BOT_TESTNET_TREASURY_PRIVATE_KEY` for that treasury wallet. Do not use the deployer key.
