# Project State

## Snapshot
- Product: Nostos, an RWA Yield Gateway and Settlement Protocol on BOT Chain.
- Current status: complete UI-only frontend with truthful unavailable/empty product states; P0 BOT Mainnet network-truth layer installed and verified.
- Frontend location: `app/`.

## Architecture
- Frontend: Next.js 16.3.1 App Router with TypeScript, React 19, Tailwind CSS 4, ESLint.
- Route groups: marketing (`/`, `/how-it-works`, `/for-issuers`, `/for-liquidity-providers`, `/risk-and-methodology`) and product (`/explore`, `/vaults/[address]`, `/portfolio`, `/redemptions`, `/redemptions/[requestId]`, `/pool`, `/registry`, `/receipts/[requestId]`).
- Network truth layer (server-side only): `lib/chain/bot-mainnet.ts` (Viem `defineChain`, id 677), `lib/chain/provenance.ts`, `lib/chain/settlement-token.ts`, `lib/chain/builder-wallet.ts`, `lib/chain/write-proof.ts`.
- Diagnostic/ops scripts: `scripts/doctor-mainnet.ts`, `scripts/mainnet-write-proof.ts`.
- Unit tests: `tests/unit/*.test.ts` (Vitest); E2E: `tests/e2e/nostos.spec.ts` (Playwright).
- Design reference: `DESIGN.md`. Product planning: `docs/nostos-*.md`.

## Completed
- Created the Next.js application with `npx create-next-app@latest . --use-npm --yes`.
- Implemented all approved marketing and product routes with responsive shells and semantic empty states; marketing hero/feature/footer refinements with local General Sans fonts and E2E coverage.
- P0 BOT Mainnet reality check: canonical chain 677 config, provenance surface, builder wallet reader, opt-in write-proof, read-only doctor, 23 Vitest unit tests, `.env.example`, gitignore allowlist.
- Live doctor run (2026-08-17): RPC reachable, chain id 677 verified, latest block ~19,979,422, eth_getBalance/eth_call/eth_getCode OK, eth_getLogs returned logs for a 200-block range.
- USDT verified: `0xaBabc7Ddc03e501d190C676BF3d92ef0e6e87a3C` listed as USDT on BOT Chain by official dev docs; on-chain name/symbol/decimals/totalSupply match; total supply matches CoinGecko/BingX.
- Confirmed lint, typecheck, 23 unit tests, and production build pass.

## Commands
- `npm run dev` - start the development server.
- `npm run lint` - run ESLint.
- `npx tsc --noEmit` - typecheck.
- `npm test` / `npm run test:unit` - run Vitest unit suite.
- `npm run build` - create a production build.
- `npm run test:e2e` - run Playwright browser smoke tests.
- `npm run doctor:mainnet` - read-only BOT Mainnet diagnostic (live RPC).
- `npm run write-proof:mainnet` - opt-in Mainnet write proof (disabled unless `P0_ENABLE_MAINNET_WRITE=true`).
- `npm run start` - serve a production build.

## Known Issues And Gaps
- Wallet, contract, keeper, API, and product data adapters are intentionally not implemented; connect actions remain preview-only.
- BOT docs warn the official Mainnet RPC disables `eth_getLogs`, but the P0 live probe received a successful response for a 200-block range; do not rely on it - plan P7 indexing around an approved third-party indexer and re-validate.
- BOT Scan's token page for the verified USDT token displays conflicting metadata ("Stub Token (goerli)"), an explorer display artifact; official docs and on-chain reads agree.
- Builder wallet is not configured in this environment; doctor reports `BUILDER WALLET: NOT CONFIGURED`.
- `docs/nostos-build-plan.md` describes a Next.js 15 target and contains stale MockUSDT/demo-data references that must not be reintroduced.