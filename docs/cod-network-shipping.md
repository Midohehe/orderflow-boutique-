# Saudi Network / COD Network shipping

Requested scope: opt-in, per-store sending from Orders to COD Network, configured by the platform super admin. The existing Turbo Express integration remains available independently.

## Setup and use

1. Super admin → platform settings → **شركات الشحن** → choose the actual store.
2. Enter the account's **API Token** (COD Network → My profile → API developer → API Token), delivery country (default `SA`) and the corresponding collection currency (default `SAR`). Enable and save. The connection test uses a read-only order-list request.
3. In that store's Orders, select up to 50 orders and click **إرسال لشركة سعودي نيتورك**. Only enabled stores see the button; the server also enforces store access and activation.
4. Review the customer, city, district, address and each product/variant's COD Network SKU. Quantities and total come from the saved order. Customer edits in this review apply to the outbound shipment only. SKU associations can be remembered separately for each store/product/variant.
5. Confirm. Progress and success/error are shown per order. Successful orders move to **جاري التوصيل**, with a **سعودي نيتورك** badge and the returned carrier reference. Delivery/settlement synchronization for COD Network is outside this release; the status shown here confirms API creation only.

The payable amount is the order's product total plus its shipping fee, with no currency conversion. The order currency must match the configured carrier currency. COD Network's request schema has no separate shipping-fee/currency field: the total is distributed over item unit prices, keeping exact cents and quantities (at most 100 pieces per outbound line). A different returned total is shown as a warning, never silently substituted into the local order.

## Contract

Verified on 2026-10-06 from the [official Seller v2 documentation](https://developer.cod.network/#seller-v2/tag/orders/POST/v2/seller/orders).

- Fixed base URL `https://api.cod.network/v2/seller`, bearer API token.
- `POST /orders`: `full_name`, `phone`, `country`, `address`, `city`, `area`, `pay_mode: cod`, `items: [{sku, quantity, price}]`.
- Success includes `status: success`, `data.id`, and a reference/tracking number. No undocumented external-reference or idempotency field is sent.
- `GET /orders?limit=1&fields=id` tests connection; `GET /orders/{id}` reconciles an uncertain attempt.
- Invalid/expired authorization is reported for the admin to replace the token. Tokens are never returned to the UI after saving and never logged.

## Reliability and isolation

- Credentials, SKU links and durable send attempts are private RLS tables. Only safe configuration metadata is readable by authorized store users. All mutations use service-only RPCs behind verified user/store/admin checks.
- A locked parent order reserves the provider before the external POST. The legacy sender uses the same parent lock; only one provider can claim an order. Sent orders cannot be submitted twice.
- Order/item edits invalidate reviewed data. In-flight or uncertain attempts prevent material edits and deletion. The reviewed revision/configuration is checked again before sending.
- Definitive 4xx rejection releases the order for a corrected retry. Network timeouts, malformed success responses and 5xx responses remain uncertain and block automatic retries, because the carrier may already have created the order.
- After two minutes, **تحقق واربط** can reconcile using a carrier numeric order ID. The server checks customer phone and collection amount and only performs a GET, then finalizes the existing attempt. If no remote order can be found, keep the attempt blocked for investigation; there is no unsafe force-resend button.
- COD Network uses `shipping_provider=cod_network`, its own attempt/remote-ID table and `shipping_reference`. Legacy `shipping_id` stays null, excluding it from Turbo status jobs. Turbo webhook, return and settlement matching explicitly exclude COD Network, including prefix fallback matching.

## Verification and release

Local, isolated tests (no carrier orders created):

- `node scripts/check-cod-network.cjs`: request contract, cents/quantity preservation, permissions, disabled/foreign stores, secret masking, immutable amounts, revisions, duplicates, known failures, ambiguous results and recovery.
- `node scripts/check-cod-network-db.cjs`: executes the migration in PGlite, tests RLS/RPC privileges, claiming/finalization, cross-provider exclusion, frozen orders/items, retry and stale reviews.
- `node scripts/check-cod-network-ui.cjs`: per-store visibility, review/required SKU, readonly amounts, progress, partial results, successful-row exclusion, store switching and admin token handling.
- Production Vite build and lint of the new TypeScript files. The repository-wide TypeScript check retains the existing 36 diagnostics; this feature adds none.

Release order: apply `20261006120000_cod_network_shipping.sql`, deploy `cod-network` with `verify_jwt=false` (the handler validates bearer authentication itself), then deploy updated `ship-orders`, `carrier-webhook`, `sync-return-shipments`, `sync-settlement-shipments`, and publish the frontend. Preserve existing JWT settings for the legacy functions. A real end-to-end shipment still needs valid company credentials and an explicitly selected real order.
