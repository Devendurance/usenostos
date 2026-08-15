# Task 3 — Product routes

Implement all product routes and domain components after the shared foundation exists. Own only `app/(product)/**`, `components/product/**`, and product-only styling. Do not modify marketing routes or shared primitives except to consume them.

Routes: `/explore`, `/vaults/[address]`, `/portfolio`, `/redemptions`, `/redemptions/[requestId]`, `/pool`, `/registry`, `/receipts/[requestId]`.

Requirements:
- Render complete UI structures with zero fabricated runtime data. Use `—`, disconnected, empty, unavailable, integration-pending, or not-found states; never fictional rows, balances, APYs, charts, quotes, request IDs, receipts, or transactions.
- Explorer filters for Treasuries, Private Credit, Commodities, and Real Estate and local sort/filter interactions; empty result remains truthful.
- Validate vault addresses as `0x` plus 40 hex characters; malformed values call `notFound()`. Valid unknown addresses display only the supplied/truncated address and unavailable state. Request/receipt IDs are numeric route params; malformed values call `notFound()`.
- Vault detail contains terms, eligibility, settlement path, history empty panel, deposit form shell, disabled submission, and wallet/integration explanation.
- Portfolio includes disconnected summary, positions, accessible chart empty panel, and pending redemption structures.
- Redemptions contains amount/form anatomy, standard-versus-instant educational comparison, and request-detail state timeline. Instant cashout is only presented for an already-created pending claim and remains unavailable.
- Pool contains capacity/exposure/position/deposit/withdraw shells without APR or liquidity claims.
- Registry search is locally operable and returns integration-pending/no-record states. Receipt follows vault/request/path/gross/discount/net/state/chain/transaction hierarchy with unavailable values.
- Include unsupported-network, no-position, no-liquidity, quote-expired, claim-transferred-but-unsettled, and record-not-found presentation states where appropriate.
- Add page metadata and accessible responsive table/card behavior for each route.

Report: `.superpowers/sdd/nostos-ui/task-3-report.md` with changed files, tests/commands, and concerns. Commit the implementation.
