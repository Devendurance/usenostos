# Project State

## Snapshot
- Product: Nostos, an RWA Yield Gateway and Settlement Protocol on BOT Chain.
- Current status: P1 live wallet + chain data foundation complete on BOT Testnet (968); UI shell stays as-is with real wallet connection and live balances; zero fabricated financial data.
- Frontend location: `app/`.

## Architecture
- Frontend: Next.js 16.3.1 App Router with TypeScript, React 19, Tailwind CSS 4, ESLint.
- Route groups: marketing and product (unchanged).
- Wallet/chain data layer: `lib/chain/wagmi-config.ts` (Wagmi v3, chains [botTestnet 968], injected connectors only, ssr), `components/providers/web3-provider.tsx` (Wagmi + React Query boundary in root layout), `lib/chain/frontend-policy.ts` (testnet-only policy, writes disabled), `lib/chain/read-state.ts` (idle/loading/ready/unavailable), `lib/chain/frontend-hooks.ts` (useWalletConnection, useBotNetwork, useNativeBalance, useSettlementTokenBalance).
- Wallet UI: `components/shell/wallet-preview-dialog.tsx` reworked into a real connect dialog (disconnected/connecting/connected/wrong-network/read-error states).
- Server/script-only network layer (unchanged): `lib/chain/*` (mainnet/testnet/guards/provenance/settlement-token/builder-wallet/write-proof*/testnet-rpc-health/testnet-write), `scripts/*` doctors and write proofs.
- Unit tests: `tests/unit/*.test.ts` (Vitest); E2E: `tests/e2e/nostos.spec.ts` (Playwright).

## Completed
- P0/P0.5 network truth + Testnet staging + RPC-consistency handling (unchanged and intact).
- P1: installed Wagmi 3.7.6 + @tanstack/react-query; wagmi config scoped to BOT Testnet; injected/EIP-1193 connectors; testnet-only environment gate (fail-closed, Mainnet can never activate); live tBOT + Testnet USDT balance hooks reading only on chain 968; truthful idle/loading/ready/unavailable read states (failed reads never zero); wrong-network block + user-triggered Switch network; disconnected/no-provider truthful states; client-import safety tests.
- Verified: 65 unit tests, typecheck, lint, build (all routes), 25 Playwright e2e tests.

## Commands
- `npm run dev`, `npm run lint`, `npx tsc --noEmit`, `npm test`, `npm run test:unit`, `npm run build`, `npm run test:e2e`, `npm run start`.
- Doctors: `npm run doctor:mainnet`, `npm run doctor:testnet`.
- Write proofs (disabled by default): `npm run write-proof:mainnet`, `npm run write-proof:testnet`.

## Known Issues And Gaps
- Injected-wallet flows (connect/switch) require a real wallet extension; automated e2e covers the disconnected/no-provider state only.
- No wallet/contract/data adapters for vaults, registry, pool, redemptions; product surfaces remain truthful unavailable/empty.
- Mainnet RPC `eth_getLogs` documented-disabled but live-responsive; `rpc.bohr.life` stale-backend behavior handled by P0.5 diagnostics (see `docs/nostos-environments.md`).
- BOT Scan explorer metadata conflict on Mainnet USDT remains a documented display artifact.
- `.env` (gitignored) holds the testnet private key; the frontend never reads it (client-import safety test enforces this).

## Next
P2 (not started).