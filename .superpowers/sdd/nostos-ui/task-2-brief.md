# Task 2 — Marketing routes

Implement all marketing routes and brand components after the shared foundation exists. Own only `app/(marketing)/**`, `components/brand/**`, and marketing-only styling/assets. Do not modify product routes or shared primitives except to consume them.

Routes: `/`, `/how-it-works`, `/for-issuers`, `/for-liquidity-providers`, `/risk-and-methodology`.

Requirements:
- Use copy from `docs/nostos-brand-messaging.md` and avoid unsupported guarantees, fake proof, sample values, or live Mainnet claims.
- Landing hero: “Capital on its way home.” Underline exactly Capital and home with lilac squiggles. Use abstract PENDING, CLAIMABLE, CLAIMED tilted cards only; no numeric data.
- Include four messaging pillars, lifecycle/how-it-works narrative, audience sections, objection FAQ, and final Explore vaults CTA.
- Implement one paper-peel transition into a forest corkboard section with decorative sticky notes/wires/clips, aria-hidden and reduced-motion-safe.
- Marketing footer is a four-column layout using implemented links only. Use text wordmark with lime dot and an informational public-record panel using “Settlement should leave a record.” Link to `/registry`; no newsletter form or dead policy links.
- Responsive layout follows 375/600/1024/1440 breakpoints and 44px touch targets.
- Add page metadata for each fixed route.

Report: `.superpowers/sdd/nostos-ui/task-2-report.md` with changed files, tests/commands, and concerns. Commit the implementation.
