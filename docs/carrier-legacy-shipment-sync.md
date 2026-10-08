# Legacy Turbo shipment lookup

Some imported orders stored the carrier barcode in both `shipping_id` and
`shipping_reference`. Turbo's `shipment(id: ...)` expects an internal numeric ID,
so these orders returned no shipment even when the barcode remained valid.

`sync-carrier-statuses` now resolves those orders by exact barcode first. Other
orders use the internal ID with a barcode fallback. Returned IDs and references
must match before any local write; mismatched results leave the order unchanged.
The guarded update repairs `shipping_id` while keeping the public barcode.

Synchronization remains limited to non-deleted `shipped` orders. Writes check
the store, order status, shipping ID and existing reference to avoid applying a
response after reassignment. Unpacking uses the resolved ID and becomes final
only after the existing idempotent stock operation succeeds. Delivered carrier
statuses still require the normal settlement flow; no financial settlement is
created by synchronization.

Run `node scripts/check-carrier-sync-edge.cjs` for legacy ID recovery, barcode
fallback, mismatches, GraphQL errors, concurrent edits, unpacking retries and the
existing authorization/tenant/lease regressions. Deploy `sync-carrier-statuses`
with both shared modules included. No database migration is needed.
