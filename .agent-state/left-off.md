# Left Off

## Current Task
Refine the landing page below the hero: rebuild the paper-fold/corkboard feature, repair muted text contrast tokens across shared consumers, and apply the hero CTA treatment to the final Explore vaults action.

## Completed In This Session
- Rebuilt the marketing header and hero to match the supplied prototype composition: restrained 80px header, centered nav, three-line General Sans headline, stepped supporting copy, twin-offset CTA, and clean two-column collage.
- Added the truthful wallet / vault terms / redemption request / settlement record collage with a small GSAP stagger and desktop-only pointer parallax.
- Restored the typed shadcn/Base UI `LinkButton` adapter and `hero`, `quiet`, and `header` variants; fixed the wallet trigger variant and mapped General Sans/body typography correctly.
- Split the muted surface and muted text tokens, added the local dev origin allowance needed by Playwright, and added prototype-specific browser assertions plus 1024px overflow coverage.
- Captured the 1440×900 implementation review in `design-qa.md` and `design-qa-assets/nostos-hero-1440.png`.
- Rebuilt the full-bleed fold with a white overlapping sheet, blended curled corner, forest grid board, pinned pushpin/paperclip notes, compact `/how-it-works` pill CTA, and truthful pending/claimable/claimed copy.
- Added optimized `public/images/feature/paper-curl.webp`, `pushpin.webp`, and `paperclip.webp` assets plus 1440px and 375px fold captures.
- Updated every pre-footer Explore vaults action to the hero twin-offset variant and added a typed `data-variant` marker for browser assertions.
- Extended E2E coverage for fold assets, mobile note simplification, token separation, and CTA destinations.

## Files Involved
- `components/brand/marketing-hero.tsx`, `components/brand/marketing.module.css`, `components/shell/marketing-header.tsx`
- `components/ui/button.tsx`, `components/shell/wallet-preview-dialog.tsx`, `app/layout.tsx`, `app/globals.css`
- `tests/e2e/nostos.spec.ts`, `design-qa.md`

## Verification
- `npm run lint` passes.
- `npx tsc --noEmit` passes.
- `npm run build` passes for all 14 routes.
- Final checks pass: `npm run lint`, `npx tsc --noEmit`, `npm run build`, and `npm run test:e2e` (25 tests, including fold assets, CTA destinations, wallet dialog, mobile drawer, all routes, malformed vault 404, and zero-fabricated-data assertions).
- In-app browser review passed at 1440px and 375px; intermediate 768px/1024px overflow checks are green in Playwright.
- Source-only `git diff --check` passes; generated `.next-build` remains intentionally untouched despite unrelated generated cache changes.

## Blockers
- Existing unrelated documentation changes remain unstaged and must be preserved.
- No live wallet, contract, API, or data adapters are in scope; all product data surfaces must remain truthful unavailable/empty states.

## Next Action
Keep the hero and fold refinements intact while the next pass addresses any broader marketing-page visual polish. Local preview is running at `http://localhost:3000/`; wallet/data integrations remain disabled until the product integration phase.
