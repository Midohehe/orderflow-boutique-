# Store countries and order review

Store settings → **دول المتجر** lets the store owner or super admin choose one or more countries (Libya is the default). Settings are scoped to the selected store.

- New orders from selected countries go straight to **قيد الانتظار**. Orders with no detected country also remain there.
- New orders from other countries appear in **خارج دول المتجر** (the former “من خارج ليبيا” tab). Country is detected from the visitor's IP by the existing order endpoint and is not proof of a shipping destination.
- Selecting orders on this tab enables **نقل المحدد إلى قيد الانتظار**. The action accepts only waiting, non-deleted, unassigned orders. It changes the review flag, preserving the original country, customer data, confirmation state, price and currency. Repeating the operation is harmless; invalid mixed batches fail atomically.
- Saving enabled countries also admits existing waiting review orders from those countries. Disabling a country affects future arrivals only and does not hide previously accepted work.
- Pending orders have a country filter with counts, including **غير محددة**. The filter runs on the server before pagination, and Excel uses the same filter. Order cards show the original country name/code.
- Review-tab counts, pending/confirmation counts and the dashboard pending count use the same routing flag. Shipped, delivered and other processed orders stay in their proper tabs and cannot be reset through this action.

## Implementation and release

Apply `20261006150000_store_order_countries.sql` before publishing the frontend. It adds `stores.operating_countries`, `orders.country_review_required`, an order insert/country-change routing trigger, two authenticated RPCs, and updated counter functions. The existing `create-order` endpoint requires no change: the database routes all insertion paths. A store-row lock serializes new arrivals with country-setting changes. The dashboard analytics body is preserved except for the pending-order predicate.

The initial backfill marks existing foreign pending orders for review. No country is overwritten to `LY` to simulate moving a request. The new country flag is independent of carrier integration, billing, inventory and delivery status.

## Local verification

- `node scripts/check-store-countries-db.cjs`: executes the migration in isolated PostgreSQL (PGlite); checks defaults, backfill, permissions, store isolation, atomic/idempotent transfer, auto-routing, country enable/disable, existing carrier guards, dashboard/confirmation counts and unchanged analytics.
- `node scripts/check-pending-count.cjs`: verifies listing/count parity, country and unknown filters, pagination, accepted foreign orders, and filtered Excel export.
- `node scripts/check-store-countries-ui.cjs`: checks the country catalog/search, multiple selection, required selection, store switching and owner access, save feedback/cache refresh, country dropdown counts and transfer progress/error/stale-response handling.

No production orders are changed by these tests. Deployment is separate from local implementation.
