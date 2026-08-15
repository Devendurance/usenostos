# Project State

## Snapshot
- Product: Nostos, an RWA Yield Gateway and Settlement Protocol on BOT Chain.
- Current status: Next.js foundation scaffolded; product implementation has not replaced the starter page.
- Frontend location: `app/`.

## Architecture
- Frontend: Next.js 16.3.1 App Router with TypeScript, React 19, Tailwind CSS 4, and ESLint.
- Current route: the generated `/` page in `app/page.tsx`.
- Root layout and metadata: `app/layout.tsx`.
- Design reference: `DESIGN.md`.
- Product planning: `docs/nostos-*.md`.

## Completed
- Created the Next.js application with `npx create-next-app@latest . --use-npm --yes`.
- Installed dependencies and generated the App Router structure.
- Confirmed `npm run lint` and `npm run build` succeed.
- Added product, architecture, data-schema, build-plan, research, and brand documentation.

## Commands
- `npm run dev` - start the development server.
- `npm run lint` - run ESLint.
- `npm run build` - create a production build.
- `npm run start` - serve a production build.

## Known Issues And Gaps
- No `npm test` script or test framework is configured.
- The home page and metadata are still the create-next-app starter content.
- Contract, keeper, wallet, and product UI implementation described in the planning docs is not yet present.
- `docs/nostos-build-plan.md` describes a Next.js 15 target while the installed project uses Next.js 16.3.1.
