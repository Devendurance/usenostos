# Left Off

## Current Task
Sprint A RWA discovery layer is implemented and verified. Uncommitted. No contract deploy. No CMC key was present for live doctor.

## Delivered
Provider-neutral CMC discovery catalog, API routes, Explore upgrade, discovered-asset detail, doctor:cmc-rwa, unit + e2e coverage. P3–P6 contracts unchanged.

## Verification
- npm test: 165 passed
- tsc: clean
- lint: clean (after unused-var fix)
- build: clean (includes /api/rwa/* and /explore/[id])
- test:e2e: 42 + 7 passed
- doctor:cmc-rwa: UNAVAILABLE (no key)

## Next
Add COINMARKETCAP_API_KEY locally and run `npm run doctor:cmc-rwa` then Explore. Sprint B issuer adapters not started.
