# Project Memory

## Product
- Nostos is an RWA Yield Gateway and Settlement Protocol on BOT Chain.
- The planned product spans a Next.js frontend, Solidity contracts, and a Node.js keeper.

## Engineering Decisions
- Frontend uses the Next.js App Router and root `app/` directory.
- BOT Chain Mainnet is the canonical network: chain id 677, RPC `https://rpc.botchain.ai`, explorer `https://scan.botchain.ai`, native BOT (18 decimals). Single source of truth is `lib/chain/bot-mainnet.ts`; never hardcode these values elsewhere.
- Settlement token USDT is VERIFIED at `0xaBabc7Ddc03e501d190C676BF3d92ef0e6e87a3C` (6 decimals), confirmed by official BOT dev docs and on-chain reads. Never create MockUSDT.
- `eth_getLogs` on the official RPC is documented as disabled; a P0 probe succeeded for a 200-block range, so treat log indexing as unguaranteed and plan P7 around an approved indexer.
- Private key must live only in `BOT_BUILDER_PRIVATE_KEY` (server-only), never in `NEXT_PUBLIC_*`, never committed or logged.
- Mainnet writes require explicit opt-in (`P0_ENABLE_MAINNET_WRITE=true`) and chain-677 enforcement; the write-proof is disabled by default.
- The repository state folder is `.agent-state/` and is committed to Git; state files are factual snapshots, not a chat transcript.

## Design Constraints
- `DESIGN.md` is the governing UI reference for future frontend work.
- Read relevant Next.js guidance in `node_modules/next/dist/docs/` before writing Next.js code.
- Do not add secrets or credentials to state files.

## Verification
- Unit tests: `npm test` (Vitest). E2E: `npm run test:e2e` (Playwright). Typecheck: `npx tsc --noEmit`. Lint: `npm run lint`. Build: `npm run build`.
- Live network checks belong in the doctor script (`npm run doctor:mainnet`), never in unit tests.