# Nostos

Nostos is the redemption and settlement layer for tokenized real-world assets. This repository currently contains the complete responsive frontend UI/UX shell for the product, built with Next.js 16 App Router, TypeScript, Tailwind CSS 4, Radix Dialog, Lucide, and Playwright.

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Routes

Marketing: `/`, `/how-it-works`, `/for-issuers`, `/for-liquidity-providers`, `/risk-and-methodology`.

Product: `/explore`, `/vaults/[address]`, `/portfolio`, `/redemptions`, `/redemptions/[requestId]`, `/pool`, `/registry`, `/receipts/[requestId]`.

## UI-only boundary

The current phase intentionally has no wallet provider, contract, API, indexer, or fabricated runtime data. Connect-wallet controls open an explanatory preview dialog; provider actions and transaction actions remain unavailable. Product data surfaces use truthful disconnected, empty, unavailable, and integration-pending states.

The visual system is documented in [DESIGN.md](./DESIGN.md), and approved product copy lives in [docs/nostos-brand-messaging.md](./docs/nostos-brand-messaging.md).

## Verification

```bash
npm run lint
npx tsc --noEmit
npm run build
npx playwright install chromium
npm run test:e2e
```
