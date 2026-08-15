# Task 2 — Marketing routes report

## Status

Implemented all five marketing routes and their reusable brand components. The landing page follows the approved white/ink/lilac direction, uses only abstract settlement states in the hero, contains the single forest paper-peel section, and avoids fabricated runtime values. Interior pages use the same type, spacing, border, and messaging system without repeating the landing-page theatrical effects.

## Changed files

### Routes

- `app/(marketing)/page.tsx`
- `app/(marketing)/how-it-works/page.tsx`
- `app/(marketing)/for-issuers/page.tsx`
- `app/(marketing)/for-liquidity-providers/page.tsx`
- `app/(marketing)/risk-and-methodology/page.tsx`

### Brand components and marketing-only styles

- `components/brand/marketing-hero.tsx`
- `components/brand/message-pillars.tsx`
- `components/brand/paper-peel-feature.tsx`
- `components/brand/lifecycle.tsx`
- `components/brand/audience-grid.tsx`
- `components/brand/objection-faq.tsx`
- `components/brand/final-cta.tsx`
- `components/brand/interior-hero.tsx`
- `components/brand/section-heading.tsx`
- `components/brand/feature-list.tsx`
- `components/brand/marketing.module.css`

## Verification

- `npm run lint -- "app/(marketing)" "components/brand"` — passed.
- `git diff --check -- "app/(marketing)" "components/brand"` — passed.
- Unsupported/sample-claim scan across marketing paths — no sample balances, APYs, request IDs, transaction values, Mainnet claims, or guaranteed-yield language found. The only `risk-free` matches are the approved statement that no financial infrastructure is risk-free.
- `npx tsc --noEmit` — could not complete because the shared generated `.next/types/validator.ts` still referenced the concurrently deleted starter `app/page.tsx`.
- `npm run build` — attempted twice and stopped by Windows access denial while another parallel process held the shared `.next` lock. Per coordinator direction, final TypeScript/build verification is deferred to the single integration pass after parallel agents complete.

## Concerns / integration notes

- The shared `MarketingHeader` mobile menu control currently has no drawer behavior. This is outside Task 2 ownership and should be corrected in the shared-foundation/integration pass.
- `package.json` still contained `lenis` during Task 2 verification despite the foundation requirement not to add an animation library. This is outside Task 2 ownership.
- Browser interaction and responsive visual verification remain assigned to Task 4.
- Marketing copy deliberately says “clear redemption tracking,” not “live,” and describes instant liquidity as conditional on eligibility and pool capacity.
