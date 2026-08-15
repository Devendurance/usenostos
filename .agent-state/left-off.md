# Left Off

## Current Task
Implement the approved prototype-faithful Nostos header and hero redesign.

## Completed In This Session
- Rebuilt the marketing header and hero to match the supplied prototype composition: restrained 80px header, centered nav, three-line General Sans headline, stepped supporting copy, twin-offset CTA, and clean two-column collage.
- Added the truthful wallet / vault terms / redemption request / settlement record collage with a small GSAP stagger and desktop-only pointer parallax.
- Restored the typed shadcn/Base UI `LinkButton` adapter and `hero`, `quiet`, and `header` variants; fixed the wallet trigger variant and mapped General Sans/body typography correctly.
- Split the muted surface and muted text tokens, added the local dev origin allowance needed by Playwright, and added prototype-specific browser assertions plus 1024px overflow coverage.
- Captured the 1440×900 implementation review in `design-qa.md` and `design-qa-assets/nostos-hero-1440.png`.

## Files Involved
- `components/brand/marketing-hero.tsx`, `components/brand/marketing.module.css`, `components/shell/marketing-header.tsx`
- `components/ui/button.tsx`, `components/shell/wallet-preview-dialog.tsx`, `app/layout.tsx`, `app/globals.css`
- `tests/e2e/nostos.spec.ts`, `design-qa.md`

## Verification
- `npm run lint` passes.
- `npx tsc --noEmit` passes.
- `npm run build` passes for all 14 routes.
- Production-server Playwright run passes: 22 tests at 375, 768, 1024, and 1440px, including wallet dialog, mobile drawer, CTA destinations, malformed vault 404, and zero-fabricated-data assertions.
- Final post-CSS checks: `npm run lint` and `npx tsc --noEmit` pass; `npm run build` and the 22-test Playwright run pass after the CTA shadow-direction refinement.
- Source-only `git diff --check` passes; generated `.next-build` remains intentionally untouched despite unrelated generated whitespace noise.

## Blockers
- Existing unrelated documentation changes remain unstaged and must be preserved.
- No live wallet, contract, API, or data adapters are in scope; all product data surfaces must remain truthful unavailable/empty states.

## Next Action
Hand off the completed first-viewport redesign. Keep wallet/data integrations disabled until the product integration phase.
