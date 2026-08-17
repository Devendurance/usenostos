# Project Memory

## Product
- Nostos is an RWA Yield Gateway and Settlement Protocol on BOT Chain.
- The planned product spans a Next.js frontend, Solidity contracts, and a Node.js keeper.

## Engineering Decisions
- Frontend uses the Next.js App Router and root `app/` directory.
- BOT Mainnet (production): chain id 677, RPC `https://rpc.botchain.ai`, explorer `https://scan.botchain.ai`. Single source of truth: `lib/chain/bot-mainnet.ts`.
- BOT Testnet (staging): chain id 968, RPC `https://rpc.bohr.life`, explorer `https://scan.bohr.life`, faucet `https://faucet.botchain.ai/basic`. Single source of truth: `lib/chain/bot-testnet.ts`.
- Network selection is always explicit; there is no fallback or automatic switching. Guards in `lib/chain/guards.ts` (`assertBotMainnetChain`, `assertBotTestnetChain`) verify the live chain id, never RPC URL strings.
- Settlement tokens: Mainnet USDT VERIFIED at `0xaBabc7Ddc03e501d190C676BF3d92ef0e6e87a3C` (6 decimals); Testnet USDT VERIFIED at `0x75edC9335175Fc0552D51D48439F229c10420fe3` (6 decimals). Testnet and Mainnet token records are distinct and never interchangeable.
- Private keys: Mainnet-only `BOT_BUILDER_PRIVATE_KEY`; Testnet-only `BOT_TESTNET_PRIVATE_KEY`. Testnet scripts never fall back to the Mainnet key. Never `NEXT_PUBLIC_*`, never committed or logged.
- Mainnet writes require `P0_ENABLE_MAINNET_WRITE=true` and chain 677; testnet writes require `P0_ENABLE_TESTNET_WRITE=true` and chain 968. Both disabled by default.
- `eth_getLogs` on the official RPCs is documented as disabled but responded during live probes; treat log indexing as unguaranteed and plan P7 around an approved indexer.
- `rpc.bohr.life` may route requests to backends at different sync heights (empirically observed). `lib/chain/testnet-rpc-health.ts` classifies HEALTHY/DEGRADED/STALE_BACKENDS_DETECTED; `lib/chain/testnet-write.ts` makes Testnet writes resilient via a signed-once, bounded, idempotent raw-transaction rebroadcast. Genuine insufficient funds (all fresh samples agree) are never retried.
- The repository state folder is `.agent-state/` and is committed to Git; state files are factual snapshots, not a chat transcript.

## Design Constraints
- `DESIGN.md` is the governing UI reference for future frontend work.
- Read relevant Next.js guidance in `node_modules/next/dist/docs/` before writing Next.js code.
- Do not add secrets or credentials to state files.
- Testnet addresses/hashes must never be copied into Mainnet configuration; transaction hashes must always carry their chain identity.

## Verification
- Unit tests: `npm test` (Vitest). E2E: `npm run test:e2e` (Playwright). Typecheck: `npx tsc --noEmit`. Lint: `npm run lint`. Build: `npm run build`.
- Live network checks belong in the doctor scripts (`npm run doctor:mainnet`, `npm run doctor:testnet`), never in unit tests.