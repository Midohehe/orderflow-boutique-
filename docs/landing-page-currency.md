# Per-page landing currency

The landing editor's pricing section stores `landing_pages.currency_code`.
NULL means inherit the store's currency; an explicit supported ISO code overrides
only that page. Existing pages remain NULL. The shared currency catalog is used
by the store settings, editor, public client, SSR, and checkout.

Amounts are **denominated as entered**, without exchange-rate conversion. This
includes inherited product prices, quantity offers, store offers and delivery
fees. The editor explains this. This change does not introduce foreign-exchange
accounting or convert existing finance reports into reports grouped by currency.

Checkout resolves currency from the matching page/product and the product's
store, ignores client-supplied currency, and snapshots `orders.currency_code`.
Existing orders remain NULL. The snapshot is used in order cards/details,
stickers and confirmation messages. The returned currency and total are used
for purchase pixels and the thank-you page. Custom text manually entered into
Puck/WhatsApp templates is not rewritten.

SSR seed v3 embeds the resolved currency, so the first server paint, structured
data and client hydration agree. Older seeds revalidate. The client stores raw
store settings in its cache and applies the page override separately.

## Deployment

1. Apply `20261005160000_landing_page_currency.sql` before new code reads columns.
2. Deploy `create-order`, `landing-ssr`, and `whatsapp-send-confirmation`, including
   the shared currency module and each function's existing shared dependencies.
3. Deploy the frontend using the existing production process. Invalidate landing
   HTML caches so old SSR seeds are replaced; normal page edits also purge caches.

The additive migration remains compatible with the previous frontend/functions.
Production deployment is performed separately on an explicit publish request.

## Offline checks

- `node scripts/check-landing-currency.cjs`
- `node scripts/check-landing-currency-ui.cjs` (React test dependencies)
- `node scripts/check-landing-currency-db.cjs` (`PGLITE_MODULE` if not installed locally)
- Production Vite build; compare TypeScript/ESLint diagnostics against repository baseline.

The tests stub all external effects; they do not create production orders or send messages.
