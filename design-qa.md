# Nostos prototype hero QA

Reference: `C:\Users\USER\Downloads\4f6dda2eae11f91fa2fe95a3e176474e.jpg`

Implementation capture: [design-qa-assets/nostos-hero-1440.png](C:\Users\USER\Documents\ideas\botchain-rwa-product\design-qa-assets\nostos-hero-1440.png)

Viewport: 1440 × 900, light theme, production build served locally. The first viewport was compared against the supplied prototype for composition, headline scale, line breaks, CTA treatment, header spacing, collage layering, and whitespace.

Checks completed:

- Header uses the restrained wordmark / centered navigation / right-side wallet action composition; all approved destinations remain linked.
- Hero headline is explicitly set as `Capital` / `on its way` / `home.` in General Sans Medium, with lilac squiggles under the first and last lines.
- Supporting copy and CTA group step inward beneath the headline. The primary action uses a crisp white face with a black offset twin and the secondary action is text-led with a play icon.
- Flow collage uses four code-native artifacts with only truthful labels: Not connected, Verification pending, PENDING, and Registry pending. No addresses, amounts, APYs, ETAs, transaction IDs, balances, or live records are rendered.
- Responsive checks cover 375, 768, 1024, and 1440px widths with no horizontal overflow. Mobile reorders text before the simplified three-card collage and preserves a working drawer.
- Reduced-motion and coarse-pointer paths skip pointer parallax; desktop motion is limited to a short stagger and a few-pixel pointer response.

Result: **passed**. No remaining P0–P2 typography, spacing, color, asset, or responsive mismatches were observed in the first-viewport review.

## Landing fold and CTA refinement

Reference: `C:\Users\USER\Downloads\3bd222b35828f52646e93074fcdf1bc8.jpg`

Implementation captures: [design-qa-assets/nostos-fold-1440.png](C:\Users\USER\Documents\ideas\botchain-rwa-product\design-qa-assets\nostos-fold-1440.png), [design-qa-assets/nostos-fold-375.png](C:\Users\USER\Documents\ideas\botchain-rwa-product\design-qa-assets\nostos-fold-375.png)

Viewport review: 1440 × 900 and 375 × 900 in the in-app browser, light theme, with the completed hero left unchanged.

Checks completed:

- The full-bleed forest grid now carries a layered white sheet with a deep gray underside curl, rounded overlap, directional shadow, and a lower board for settlement states.
- Original optimized `paper-curl.webp`, `pushpin.webp`, and `paperclip.webp` assets render at intrinsic dimensions; hardware remains decorative and hidden from assistive technology.
- Fold copy and states remain truthful: `PENDING — Request recorded`, `CLAIMABLE — Next action visible`, and `PUBLIC RECORD — CLAIMED — Settlement leaves a receipt`; no financial values, addresses, APYs, transaction IDs, or fabricated records appear.
- Mobile reduces the note board to the pending note and public record, keeps the compact pill CTA readable above the curl, and has no horizontal overflow.
- The shared `--muted` surface token is distinct from `--muted-foreground`; secondary marketing copy remains readable on white, lilac, and forest surfaces.
- The pre-footer Explore vaults action uses the same `hero` variant and twin-offset movement as the hero CTA while retaining its `/explore` destination. The fold CTA remains the documented compact black pill to `/how-it-works`.

final result: passed

## Landing reveal motion

The landing page now uses a small client-only GSAP island to reveal the post-hero sections once as they enter the viewport. IntersectionObserver handles visibility decisions; GSAP animates only opacity and vertical transform, with no scroll polling or layout animation. Reduced-motion users receive the fully visible static layout, and product/interior routes do not mount the reveal scope.

Focused browser checks passed for the landing-only scope and reduced-motion fallback.

final result: passed

## Supplied Nostos wordmark rollout

Source: `C:\Users\USER\AppData\Local\Temp\codex-clipboard-ebe233c4-8e73-431d-abc3-de39487a3601.png`

The supplied mark is cropped to transparent 1484 × 286 assets in `public/images/brand/` and is rendered through the shared `BrandMark` component. Light and dark variants are used in the marketing header, footer, product sidebar/mobile navigation, marketing drawer, and branded 404 surface.

Desktop and mobile browser checks confirmed the mark remains crisp, readable, and contained without horizontal overflow. The footer uses the inverse treatment for contrast while preserving the lilac inner accent.

final result: passed
