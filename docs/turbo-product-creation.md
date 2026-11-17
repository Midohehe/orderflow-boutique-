# Turbo product creation

For stores with Turbo shipping enabled, new warehouse-linked products offer **إنشاء منتجات توربو عند الحفظ**, enabled initially. The user supplies a positive per-piece weight in the account's configured weight unit. Local product creation finishes first; a progress dialog then creates the carrier catalog entries one at a time. Each color/size combination becomes a separate product named `Product — Color - Size`. The SKU is used as its code, or a deterministic product/variant code is generated. Single products and legacy code-only variants are supported. Existing explicit warehouse links are retained.

The **توربو** button on a product card reopens the same process, including after refresh. Successful variants are skipped. Each success atomically persists its warehouse code on `products.variant_warehouse_codes` and refreshes the store-scoped warehouse cache with the carrier's actual `availableQuantity`. The process creates catalog records; it does not record physical warehouse receipts or copy local opening quantities into Turbo.

## Carrier contract

Verified from the public GraphQL schema at `https://turboex.ly:8001/graphql` on 2026-11-17. `saveProduct(input: ProductInput)` returns `Product`. Inputs are `code`, `name`, `price`, `weight`, `active` (optional `id` and `customerId` are deliberately omitted on create). Name, price, weight and active are non-null fields. Price is the saved local per-piece sale price. The authenticated customer's account supplies ownership. `listProducts(input:{code:[code]},first:100,page:1)` checks exact codes before creation. Responses include ID, code, name, price, weight and available quantity. Only schema introspection was performed against the real service; automated creation tests use mocked carrier responses.

## Reliability and permissions

- `create-turbo-products` verifies the bearer token and `has_store_access` before reading store credentials or product data. Settings must be enabled for the exact store; no fallback to another store's account. The endpoint follows the existing global/per-store configuration. Passwords and tokens stay server-side and provider error bodies are not reflected to the browser.
- `turbo_product_exports` keeps a private durable attempt for each product/variant, unique codes per store, the exact payload, and a hash binding the attempt to its endpoint/account. The service-only claim RPC locks the product, checks its material revision and reserves before any external creation. Concurrent calls cannot duplicate a reserved variant. A trigger freezes material changes and deletion while an attempt is sending or uncertain; local stock changes remain possible.
- A failed login/preflight or explicit GraphQL validation rejection is safely retryable. Timeouts, malformed results, ambiguous resolver errors and local finalization failures never automatically repeat a creation. Recovery looks up the exact saved code and requires matching name, price and weight. Initial collisions with pre-existing carrier codes require an explicit manual warehouse link instead of adopting an unrelated product. Account/code changes cannot redirect an uncertain attempt.
- Product edits preserve the empty variant-key mapping used for single products without a SKU, which is already understood by the shipping resolver. Normal color/size keys match the existing shipment lookup.

## Validation and release

Run `node scripts/check-turbo-products.cjs`, `node scripts/check-turbo-products-db.cjs`, and `node scripts/check-turbo-products-ui.cjs`. These cover combinations, stable unique codes, stock preservation, store isolation, reserved attempts, partial progress, safe retry/recovery, RLS and atomic mapping/cache writes. Run lint on the new TypeScript files and the production Vite build. The repository TypeScript baseline retains existing unrelated diagnostics; the new UI introduces none.

Release: apply `20261117120000_turbo_product_exports.sql`, deploy `create-turbo-products` with `verify_jwt=false` (the handler validates authentication), then publish the frontend. No existing product is exported during deployment. A live creation requires an explicitly selected product and a real carrier account; do not create disposable catalog records in production for verification.
