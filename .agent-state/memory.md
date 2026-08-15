# Project Memory

## Product
- Nostos is an RWA Yield Gateway and Settlement Protocol on BOT Chain.
- The planned product spans a Next.js frontend, Solidity contracts, and a Node.js keeper.

## Engineering Decisions
- The frontend uses the Next.js App Router and root `app/` directory.
- The repository state folder is `.agent-state/` and is committed to Git.
- State files are factual Markdown snapshots, not a chat transcript.

## Design Constraints
- `DESIGN.md` is the governing UI reference for future frontend work.
- Read relevant Next.js guidance in `node_modules/next/dist/docs/` before writing Next.js code.
- Do not add secrets or credentials to state files.

## Verification
- Available checks are `npm run lint` and `npm run build`.
- There is currently no `npm test` script.
