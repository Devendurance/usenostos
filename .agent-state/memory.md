# Project Memory

## Product
- Nostos is an RWA Yield Gateway and Settlement Protocol on BOT Chain.
- The planned product spans a Next.js frontend, Solidity contracts, and a Node.js keeper.

## Engineering Decisions
- Frontend uses the Next.js App Router and root `app/` directory.
- BOT Mainnet (production): chain 677, RPC `https://rpc.botchain.ai`, explorer `https://scan.botchain.ai`.
- BOT Testnet (staging): chain 968, RPC `https://rpc.bohr.life`, explorer `https://scan.bohr.life`, faucet `https://faucet.botchain.ai/basic`.
- Network selection is always explicit; no fallback or automatic switching; guards verify live chain id.
- Settlement tokens: Mainnet USDT VERIFIED `0xaBabc7Ddc03e501d190C676BF3d92ef0e6e87a3C`; Testnet USDT VERIFIED `0x75edC9335175Fc0552D51D48439F229c10420fe3`. Records are distinct and never interchangeable.
- P1 frontend policy is testnet-only and fail-closed: `FRONTEND_POLICY = { environment: "testnet", requiredChainId: 968, writesEnabled: false }`. Even `NEXT_PUBLIC_NOSTOS_ENV=mainnet` cannot enable Mainnet.
- Wallet layer: Wagmi v3 config scoped to `botTestnet` with injected/EIP-1193 connectors only; no WalletConnect, no project IDs, no private keys in frontend. Provider boundary is a client component in the root layout.
- Live reads (tBOT native balance, Testnet USDT `balanceOf`) run only when connected on 968. Read states are idle/loading/ready/unavailable; failed reads are never zero.
- Server-only secrets stay in `BOT_BUILDER_PRIVATE_KEY` / `BOT_TESTNET_PRIVATE_KEY` and are never imported from `app/` or `components/` (enforced by test).
- `rpc.bohr.life` may serve stale backends; P0.5 diagnostics classify HEALTHY/DEGRADED/STALE_BACKENDS_DETECTED and Testnet writes use a signed-once idempotent rebroadcast.
- P2 RWA discovery: OUSG (Ondo) and TBILL (OpenEden) are `DISCOVERY_ONLY` source-backed records in `lib/rwa/`; dynamic APY/TVL/NAV are never fabricated (`Not reported`). The `NostosRegistry` contract (contracts/src) anchors integration status + metadata hashes only. Testnet deploy/register require `P2_ENABLE_TESTNET_DEPLOY=true` and refuse chain 677.
- The repository state folder is `.agent-state/` and is committed to Git; state files are factual snapshots, not a chat transcript.

## Design Constraints
- `DESIGN.md` is the governing UI reference; never redesign the existing shell.
- Read relevant Next.js guidance in `node_modules/next/dist/docs/` before writing Next.js code.
- Do not add secrets or credentials to state files.
- Testnet addresses/hashes must never be copied into Mainnet config; transaction hashes always carry chain identity.

## Verification
- Unit: `npm test` (Vitest). E2E: `npm run test:e2e` (Playwright). Typecheck: `npx tsc --noEmit`. Lint: `npm run lint`. Build: `npm run build`.
- Live network checks belong in the doctor scripts, never in unit tests.