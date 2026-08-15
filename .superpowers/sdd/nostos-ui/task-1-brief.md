# Task 1 — Shared frontend foundation

Implement the shared foundation for the Nostos frontend. Own only root configuration, shared types/utilities, `components/ui`, `components/shell`, and the root/marketing/product layout scaffolding. Do not implement marketing page content or product domain pages.

Requirements:
- Next.js 16 App Router, Tailwind 4, TypeScript.
- Load local General Sans files from `public/fonts` with `next/font/local`; use Inter through `next/font/google` for UI/body.
- Light-only semantic tokens from DESIGN.md: ink #101010, white, lilac #9A87F7, pale blue #C6E6F8, forest #14382C, footer black #0D0D0D, footer gray #9A9A9A, newsletter/updates fill #1E1E1E, sticky pink/yellow.
- Replace starter metadata with Nostos title template and approved brand description.
- Create marketing and product route-group layouts without changing route URLs.
- Add semantic `PresentationState<T>` and `UnavailableReason` types with complete ready data and truthful unavailable/empty variants.
- Add reusable Container, Button, LinkButton, PageHeading, EmptyState, StatusBadge, Input, Section, and accessible Dialog/Drawer primitives.
- Add shared marketing/product headers, product sidebar/mobile drawer, text Nostos wordmark, and one wallet preview dialog. Connect wallet opens the dialog; provider buttons remain disabled and no connected state is possible.
- Use Radix Dialog and Lucide icons; add dependencies in package.json. Do not add Wagmi/Viem or a global store.
- Add branded global not-found and a product error boundary if it fits the owned shell files.
- Maintain WCAG semantics, focus-visible styles, 44px targets, reduced-motion behavior, and no automatic dark mode.

Report: `.superpowers/sdd/nostos-ui/task-1-report.md` with changed files, tests/commands, and concerns. Commit the implementation.
