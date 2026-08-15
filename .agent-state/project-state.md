# Project State

## Snapshot
- Product: Nostos, an RWA Yield Gateway and Settlement Protocol on BOT Chain.
- Current status: complete UI-only frontend implementation with truthful unavailable/empty product states.
- Frontend location: `app/`.

## Architecture
- Frontend: Next.js 16.3.1 App Router with TypeScript, React 19, Tailwind CSS 4, and ESLint.
- Route groups: marketing (`/`, `/how-it-works`, `/for-issuers`, `/for-liquidity-providers`, `/risk-and-methodology`) and product (`/explore`, `/vaults/[address]`, `/portfolio`, `/redemptions`, `/redemptions/[requestId]`, `/pool`, `/registry`, `/receipts/[requestId]`).
- Shared UI: `components/ui`, `components/brand`, `components/shell`, `components/product`.
- Root layout and metadata: `app/layout.tsx`.
- Design reference: `DESIGN.md`.
- Product planning: `docs/nostos-*.md`.

## Completed
- Created the Next.js application with `npx create-next-app@latest . --use-npm --yes`.
- Installed dependencies and generated the App Router structure.
- Implemented all approved marketing and product routes with responsive shells and semantic empty states.
- Added Radix dialog, Lucide icons, local General Sans fonts, and Playwright E2E coverage.
- Rebuilt the marketing header/hero against the supplied prototype with a truthful Nostos flow collage, shadcn-compatible brand button variants, and restrained GSAP motion.
- Added `design-qa.md` and a 1440×900 hero capture under `design-qa-assets/`.
- Confirmed lint, typecheck, production build, and 19 browser smoke tests pass.
- Added product, architecture, data-schema, build-plan, research, and brand documentation.

## Commands
- `npm run dev` - start the development server.
- `npm run lint` - run ESLint.
- `npx tsc --noEmit` - typecheck.
- `npm run build` - create a production build.
- `npm run test:e2e` - run Playwright browser smoke tests.
- `npm run start` - serve a production build.
- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3100 npm run test:e2e -- --workers=1` - run browser checks against an existing production server on port 3100.

## Known Issues And Gaps
- Wallet, contract, keeper, API, and product data adapters are intentionally not implemented; connect actions remain preview-only and disabled.
- Inter body copy uses the system fallback stack because Google font fetching is unavailable in the build environment; General Sans is loaded locally as required by the design system.
- `docs/nostos-build-plan.md` describes a Next.js 15 target while the installed project uses Next.js 16.3.1.
