# Pending order count

The pending tab lists non-deleted domestic orders (country_code NULL, LY or ly).
Its badge previously used orders_status_counts, which includes foreign pending
orders. A production aggregate confirmed the reported 11 versus 6 discrepancy:
6 domestic pending orders and 5 foreign pending orders.

The orders page now gets its pending badge count through the same tab predicate
and table permissions as the list. Other status counts and foreign orders are
unchanged. The count covers all matching pages, not only the displayed page.
No order data or database functions are changed.

Validation: scripts/check-pending-count.cjs covers domestic/foreign separation,
store scope, deleted orders, pagination, zero counts and query errors.
Production Vite build passed.
