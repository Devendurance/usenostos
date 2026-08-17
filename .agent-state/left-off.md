# Left Off

## Current Task
P2 RWA discovery + Registry foundation is complete. Next milestone is P3.

## Completed In This Session
- Installed Foundry 1.7.1 and initialized a Foundry workspace at `contracts/` (OpenZeppelin v5.3.0 + forge-std) without restructuring the Next.js app.
- Added `lib/rwa/` domain layer: types (SourcedValue/SourceReference/IntegrationStatus/RwaOpportunity), display rules (`Not reported`, provenance affordances, `canDeposit`/`canRedeem`, filter/sort on real fields only).
- Added source-backed OUSG (Ondo) and TBILL (OpenEden) records with field-level provenance and `DISCOVERY_ONLY` status.
- Added deterministic canonical metadata serialization + hashing (`lib/rwa/metadata.ts`) and `npm run snapshot:rwa`.
- Populated Explore with real OUSG/TBILL cards; Vault Detail resolves slugs and shows a clear `DISCOVERY ONLY` state with no deposit/redeem actions.
- Added `NostosRegistry` contract (OpenZeppelin Ownable, status + metadata-hash only, duplicate/guard/events) with 8 passing Foundry tests.
- Added testnet deploy/register tooling (`scripts/registry/*`, `P2_ENABLE_TESTNET_DEPLOY` opt-in, `assertBotTestnetChain`, artifact reader, addresses persistence). Not executed.

## Files Involved
- `lib/rwa/*` (types, display, metadata, opportunities/{ousg,tbill,index})
- `components/product/opportunity-card.tsx`, `explorer-controls.tsx`
- `app/(product)/explore/page.tsx`, `app/(product)/vaults/[address]/page.tsx`
- `contracts/` (foundry.toml, remappings.txt, src/NostosRegistry.sol, test/NostosRegistry.t.sol, script/DeployNostosRegistry.s.sol, addresses/bot-testnet.json, lib/ submodules)
- `scripts/metadata-snapshot.ts`, `scripts/registry/{plan,artifact,deploy,register}.ts`
- `tests/unit/{rwa-display,rwa-opportunities,rwa-metadata,registry-plan}.test.ts`, `tests/e2e/nostos.spec.ts`
- `.env.example`, `package.json`, `eslint.config.mjs`
- `docs/superpowers/plans/2026-08-17-p2-rwa-discovery-registry-foundation.md`

## Verification
- `npm test`: 89 passed.
- `npx tsc --noEmit`: passed.
- `npm run lint`: passed.
- `npm run build`: passed (all routes).
- `npm run test:e2e`: 27 passed.
- `forge test` (contracts): 8 passed.
- `npm run snapshot:rwa` printed deterministic integration ids + metadata hashes.

## Blockers
- Registry deployment and OUSG/TBILL registration are NOT executed (require `P2_ENABLE_TESTNET_DEPLOY=true`, a `BOT_TESTNET_PRIVATE_KEY`, and explicit authorization).
- No live/current APY/TVL/NAV source is integrated; dynamic values stay `Not reported`.
- Metadata is hash-anchored only; no metadata hosting URI yet (documented limitation).

## Next Action
P3 not started. For manual verification run the P2 manual browser script (Explore shows only OUSG + TBILL with provenance; each Vault Detail shows DISCOVERY ONLY with no deposit/redeem; wallet P1 behavior intact).