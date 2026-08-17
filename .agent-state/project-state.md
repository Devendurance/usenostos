# Project State

## Snapshot
- Product: Nostos, an RWA Yield Gateway and Settlement Protocol on BOT Chain.
- Current status: complete UI-only frontend with truthful unavailable/empty product states; P0 Mainnet network-truth layer and P0.5 Testnet staging foundation installed and verified.
- Frontend location: `app/`.

## Architecture
- Frontend: Next.js 16.3.1 App Router with TypeScript, React 19, Tailwind CSS 4, ESLint.
- Route groups: marketing (`/`, `/how-it-works`, `/for-issuers`, `/for-liquidity-providers`, `/risk-and-methodology`) and product (`/explore`, `/vaults/[address]`, `/portfolio`, `/redemptions`, `/redemptions/[requestId]`, `/pool`, `/registry`, `/receipts/[requestId]`).
- Network truth layer (server-side only): `lib/chain/bot-mainnet.ts` (677), `lib/chain/bot-testnet.ts` (968), `lib/chain/bot-networks.ts`, `lib/chain/guards.ts`, `lib/chain/provenance.ts`, `lib/chain/settlement-token.ts`, `lib/chain/builder-wallet.ts`, `lib/chain/write-proof.ts`, `lib/chain/write-proof-testnet.ts`.
- Diagnostic/ops scripts: `scripts/doctor-mainnet.ts`, `scripts/doctor-testnet.ts`, `scripts/mainnet-write-proof.ts`, `scripts/write-proof-testnet.ts`.
- Unit tests: `tests/unit/*.test.ts` (Vitest); E2E: `tests/e2e/nostos.spec.ts` (Playwright).
- Design reference: `DESIGN.md`. Product planning: `docs/nostos-*.md`. Environment lifecycle: `docs/nostos-environments.md`.

## Completed
- Created the Next.js application with `npx create-next-app@latest . --use-npm --yes`.
- Implemented all approved marketing and product routes with responsive shells and semantic empty states; marketing hero/feature/footer refinements with local General Sans fonts and E2E coverage.
- P0: canonical Mainnet 677 config, provenance, builder wallet reader, opt-in Mainnet write-proof, read-only Mainnet doctor, 23 unit tests; USDT `0xaBabc7Ddc03e501d190C676BF3d92ef0e6e87a3C` VERIFIED.
- P0.5: canonical Testnet 968 config (`lib/chain/bot-testnet.ts`), network map, environment guards, testnet provenance (`staging` designation), dedicated testnet wallet reader (`BOT_TESTNET_PRIVATE_KEY`), opt-in tBOT write-proof, read-only testnet doctor, 39 unit tests total, environment lifecycle doc.
- Live testnet doctor (2026-08-17): RPC reachable, chain 968 verified, latest block ~20,182,965, eth_call/eth_getCode/eth_getLogs supported; testnet USDT `0x75edC9335175Fc0552D51D48439F229c10420fe3` VERIFIED.
- Confirmed lint, typecheck, 39 unit tests, and production build pass.

## Commands
- `npm run dev` - start the development server.
- `npm run lint` - run ESLint.
- `npx tsc --noEmit` - typecheck.
- `npm test` / `npm run test:unit` - run Vitest unit suite.
- `npm run build` - create a production build.
- `npm run test:e2e` - run Playwright browser smoke tests.
- `npm run doctor:mainnet` - read-only Mainnet diagnostic (live RPC).
- `npm run doctor:testnet` - read-only Testnet diagnostic (live RPC) incl. RPC CONSISTENCY section.
- `npm run write-proof:mainnet` - opt-in Mainnet write proof (disabled unless `P0_ENABLE_MAINNET_WRITE=true`).
- `npm run write-proof:testnet` - opt-in Testnet tBOT write proof with preflight + idempotent rebroadcast (disabled unless `P0_ENABLE_TESTNET_WRITE=true`).
- `npm run start` - serve a production build.

## Known Issues And Gaps
- Wallet, contract, keeper, API, and product data adapters are intentionally not implemented; connect actions remain preview-only.
- BOT docs warn the official Mainnet RPC disables `eth_getLogs`, but live probes received successful responses; do not rely on it - plan P7 indexing around an approved third-party indexer.
- `rpc.bohr.life` is empirically observed serving requests from backends at different synchronization heights; the doctor detects this (HEALTHY/DEGRADED/STALE_BACKENDS_DETECTED) and the Testnet write proof rebroadcasts a single signed transaction idempotently. See `docs/nostos-environments.md`.
- BOT Scan's token page for the verified Mainnet USDT displays conflicting metadata ("Stub Token (goerli)"), an explorer display artifact.
- Testnet tBOT funding requires manual faucet claims (up to 10 tBOT / address / 24h); nothing is automated.
- `docs/nostos-build-plan.md` describes a Next.js 15 target and contains stale MockUSDT/demo-data references that must not be reintroduced.