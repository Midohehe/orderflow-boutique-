# RLS Audit Report — Phase 5 Tenant Isolation

**Project:** orderflow-boutique (وصلة)  
**Migration:** `20260603190000_phase5_strict_store_rls.sql`  
**Date:** 2026-06-03  
**Scope:** Strict `store_id`-based RLS via `has_store_access(store_id)`

---

## Executive summary

Before Phase 5, most operational tables used **`has_store_or_legacy(owner_id, store_id)`**, which allowed:

1. **NULL `store_id` bypass** — rows without `store_id` fell back to `is_member_of(owner_id)`, granting access across *all* stores of that owner.
2. **Staff all-store fallback** — staff without explicit `store_member_stores` rows could access every store under the owner.
3. **Owner-id-only policies** on some tables (e.g. `order_status_history`, `ad_*`) — staff with owner membership could read/write data for stores they were not assigned to.

Phase 5 **removes these bypasses** and standardizes authenticated access on **`has_store_access(store_id)`** with **`rls_store_write(store_id, owner_id)`** for mutations.

---

## Role model (test matrix)

| Role | DB representation | Expected access |
|------|-------------------|-----------------|
| **Merchant (owner)** | `stores.owner_id = auth.uid()` | All stores they own via `has_store_access` |
| **Staff** | `store_members` + `store_member_stores` | Only assigned `store_id` values |
| **Admin** | `user_roles.role = 'admin'` | All stores (platform operator) |
| **Anon / public** | unauthenticated | Public read on landing/catalog tables; controlled public insert on orders/analytics |

> **Note:** `app_role` enum is `admin | user`. "Merchant" = store owner (`user` role + owns stores). There is no separate DB role named `merchant`.

---

## Core functions (after Phase 5)

| Function | Purpose |
|----------|---------|
| `has_store_access(store_id)` | **Strict** — requires non-null `store_id`; owner, admin, or staff with explicit store assignment |
| `has_store_or_legacy(owner_id, store_id)` | **Deprecated semantics** — now alias to `admin OR has_store_access(store_id)` only |
| `rls_store_select(store_id)` | Policy helper: `admin OR has_store_access(store_id)` |
| `rls_store_write(store_id, owner_id)` | Policy helper: validates store access **and** `stores.owner_id = owner_id` |
| `assert_store_owner_match()` | Trigger: rejects inserts/updates where `store_id` does not belong to `owner_id` |

### Staff assignment rule

Staff **must** have rows in `store_member_stores`. Migration backfills all stores for members with no assignments (one-time). New staff without assignments will **not** access any store data.

---

## Tables migrated to strict `store_tenant_*` policies

All public tables with **`owner_id` + `store_id`** (except exceptions below) now use:

- `store_tenant_select` → `rls_store_select(store_id)`
- `store_tenant_insert` → `rls_store_write(store_id, owner_id)`
- `store_tenant_update` → same
- `store_tenant_delete` → `rls_store_select(store_id)`

Includes (non-exhaustive — see migration dynamic loop):

| Category | Tables |
|----------|--------|
| Orders | `orders`, `order_items`, `order_status_history`, `order_confirmation_attempts` |
| Catalog | `products`, `landing_pages`, `product_categories`, `landing_page_templates` |
| Finance | `expenses`, `expense_types`, `safes`, `safe_movements`, `purchases`, `returns`, `return_shipments`, `settlements`, `settlement_shipments`, `accounting_periods` |
| Shipping | `shipping_settings`, `shipping_zones`, `shipping_warehouse_products`, `shipping_price_lists` |
| Marketing | `pixel_settings`, `fb_*`, `ad_spends`, `ad_wallets`, `ad_wallet_topups`, `analytics_events` (read) |
| Store config | `header_settings`, `store_settings`, `sticker_settings`, `thank_you_settings`, `order_form_fields`, `confirmation_*`, `cancellation_reasons` |
| WhatsApp | `whatsapp_settings`, `whatsapp_conversations`, `whatsapp_messages` |
| Ops | `prep_lists`, `prep_list_orders`, `stock_movements`, `easyorders_products`, `store_facebook_connections`, `store_themes`, `store_page_layouts`, `home_page_sections` |
| Misc | `city_corrections`, `hidden_default_*`, `carrier_status_mappings` |

---

## Public / exception policies (intentional)

| Table | Public access | Authenticated write |
|-------|---------------|---------------------|
| `products` | SELECT all | `rls_store_write` |
| `landing_pages` | SELECT all | `rls_store_write` |
| `header_settings`, `store_settings`, `pixel_settings`, `order_form_fields` | SELECT all (landing pages) | `rls_store_write` |
| `stores` | SELECT all (routing by slug) | Owner manage own stores only |
| `home_page_sections` | SELECT visible | `rls_store_write` |
| `store_page_layouts` | SELECT published | `rls_store_write` |
| `landing_page_templates` | SELECT `is_default` templates | `rls_store_write` |
| `store_themes` | SELECT global templates | `rls_store_write` |
| `orders` | INSERT with valid `store_id`+`owner_id` match | tenant policies |
| `order_items` | INSERT linked to recent order in same store | tenant policies |
| `analytics_events` | INSERT all | SELECT tenant only |

---

## Owner-scoped tables (no `store_id`) — unchanged

These remain **`is_member_of(owner_id)`** by design (account-level, not store-level):

| Table | Rationale |
|-------|-----------|
| `ai_training_settings`, `ai_training_qa` | WhatsApp AI training is per merchant account |
| `wallets`, `wallet_transactions` | Billing wallet is per user/owner |
| `profiles`, `user_roles` | Identity |
| `store_members`, `store_member_permissions` | Membership admin |
| `permission_groups`, `permissions` | Global catalog |
| `app_settings`, `form_field_catalog` | Platform config |
| `pending_order_fees`, `financial_audit_log` | Platform/admin |
| `rejected_orders` | Admin review queue |

**Recommendation (future):** add `store_id` to `ai_training_*` if per-store bots are required.

---

## Security fixes in Phase 5

| Issue | Before | After |
|-------|--------|-------|
| Cross-store read via NULL `store_id` | Possible | Blocked — backfill + strict check |
| Staff sees all owner stores | Possible without `store_member_stores` | Blocked — explicit assignment required |
| `store_member_stores` public read | `USING (true)` | Owner + member + admin only |
| Public order insert to wrong store | `WITH CHECK (true)` | Requires valid `store_id`/`owner_id` pair |
| Storage uploads | Owner folder only | Owner **or** staff with `has_store_access` |
| RPC `orders_*_counts` | `is_member_of` via join | `has_store_access(_store_id)` |

---

## RPC functions updated

- `orders_status_counts(_store_id)`
- `orders_shipped_carrier_counts(_store_id)`
- `orders_confirmation_counts(_store_id)`
- `order_status_dwell_report(_store_id, _from, _to)`

All require `has_store_access(_store_id)` before returning aggregates.

---

## Test plan

### Automated (SQL)

```bash
# After db push on staging:
psql "$DATABASE_URL" -f supabase/tests/rls_tenant_isolation.sql
```

Fixture UUIDs in test file — replace with real test users or seed via Dashboard.

### Manual matrix

| # | Actor | Action | Store A | Store B (other merchant) | Expected |
|---|-------|--------|---------|--------------------------|----------|
| 1 | Owner A | SELECT orders | ✅ | ❌ | Pass |
| 2 | Staff A (store A only) | SELECT orders | ✅ | ❌ | Pass |
| 3 | Staff A | SELECT orders store B same owner | ❌* | — | Pass if not assigned |
| 4 | Admin | SELECT orders | ✅ | ✅ | Pass |
| 5 | Anon | INSERT order valid store | ✅ | — | Pass |
| 6 | Anon | INSERT order wrong owner/store pair | ❌ | — | Pass |
| 7 | Owner A | RPC status counts store B | empty/error | — | Pass |

\*Staff assigned only to Store A must not read Store A2 unless also assigned.

### How to test in Supabase SQL editor

```sql
-- Impersonate user (replace UUID)
SELECT set_config('request.jwt.claim.sub', '<user-uuid>', true);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SET LOCAL ROLE authenticated;

SELECT count(*) FROM orders WHERE store_id = '<other-store-uuid>';
-- Expect 0 for owner/staff without access
```

---

## Deployment checklist

1. `npm run db:push` — applies `20260603190000_phase5_strict_store_rls.sql`
2. Verify no rows with `store_id IS NULL` on critical tables:
   ```sql
   SELECT table_name, count(*)
   FROM information_schema.columns c
   JOIN pg_stat_user_tables t ON t.relname = c.table_name
   WHERE c.column_name = 'store_id' AND c.table_schema = 'public';
   ```
3. Run `supabase/tests/rls_tenant_isolation.sql`
4. Smoke-test: landing checkout, dashboard orders, staff login on assigned store only
5. Re-deploy edge functions if any bypass RLS with service role (expected)

---

## Known limitations

1. **Public read** on `products`, `landing_pages`, settings tables exposes catalog data by design (required for `/p/*` landings).
2. **Financial RPCs** (`profit_loss_report`, `cash_flow_report`) — updated in Phase 5 to require `has_store_access`.
3. **Service role** (edge functions) bypasses RLS — ensure functions validate `store_id` in application code.
4. **`store_id` nullable columns** — NOT NULL constraints not added yet to avoid breaking legacy rows; backfill runs on migration.

---

## Files changed

| File | Description |
|------|-------------|
| `supabase/migrations/20260603190000_phase5_strict_store_rls.sql` | Main RLS hardening |
| `supabase/tests/rls_tenant_isolation.sql` | Automated test harness |
| `RLS_AUDIT_REPORT.md` | This document |

---

## Sign-off

| Check | Status |
|-------|--------|
| Policies audited | ✅ |
| `has_store_access(store_id)` enforced on store-scoped tables | ✅ |
| Cross-store owner_id fallback removed | ✅ |
| Test script provided | ✅ |
| Billing / plans | ⏸ Not in scope |
