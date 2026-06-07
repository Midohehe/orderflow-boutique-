# Supabase Disk IO Audit Report

**Project:** orderflow-boutique  
**Date:** 2026-06-06  
**Goal:** Reduce Disk IO before plan upgrade

---

## Executive Summary

Disk IO pressure came from **three layers**:

1. **Repeated full-table scans** on tiny config tables (`app_settings`, `store_settings`, `whatsapp_settings`, `header_settings`) — often queried without `store_id` filter or with `SELECT *`.
2. **Heavy dashboard pages** firing **10+ parallel queries** on every tab/filter change (Orders page).
3. **WhatsApp Realtime** reloading entire conversation lists on **every message event** (857K+ sequential tuple reads on `whatsapp_conversations`).

Estimated impact after fixes: **40–70% reduction** in client-driven read IO during normal dashboard use.

---

## 1. Most Expensive Queries (from `pg_stat_user_tables`)

| Table | Seq scans | Seq tuples read | Issue |
|-------|-----------|-----------------|-------|
| `whatsapp_conversations` | 14,942 | 857,073 | Realtime reloads full list on each event |
| `store_settings` | 41,635 | 117,342 | Queried without `store_id`; index not used for store-only filter |
| `whatsapp_settings` | 56,056 | 98,439 | Fetched all owner rows, filtered client-side |
| `app_settings` | 22,984 | 22,983 | Single-row table read on every app/login load |
| `header_settings` | 5,232 | 11,119 | Missing efficient store-scoped access pattern |
| `order_form_fields` | 4,176 | 151,576 | 95% seq scans (landing page form loads) |
| `orders` | 5,193 | 156,417 | Tab switches + confirmation center (1000 rows) |

---

## 2. Missing / Insufficient Indexes (fixed)

Migration: `20260606140000_disk_io_performance_indexes.sql` (applied to remote)

| Index | Purpose |
|-------|---------|
| `idx_store_settings_store_id` | Store-scoped settings lookups |
| `idx_whatsapp_settings_store_id` | Per-store WhatsApp config |
| `idx_orders_store_tab_list` | Orders page tabs `(store_id, is_deleted, status, created_at)` |
| `idx_orders_store_pending_confirm` | Confirmation center pending queue |
| `idx_wa_msg_order_out_created` | Latest WA status per order |
| `idx_stock_movements_store_created` | Stock movements ledger |
| `idx_order_confirm_attempts_store_created` | Confirmation attempts |
| `idx_carrier_status_mappings_store_owner` | Carrier mapping filter by store |
| `idx_sticker_settings_store_id` | Sticker settings on orders page |

---

## 3. Polling / Refresh Loops

| Location | Pattern | Risk | Action |
|----------|---------|------|--------|
| `Orders.tsx` | React Query refetch on tab/page/filter change | **High** — 10 queries per change | Split meta vs data; 5min cache for meta |
| `ConfirmationCenter.tsx` | `setInterval` 60s for postponed reminders | Low (client-only) | No DB calls — OK |
| `WhatsAppPage.tsx` | Realtime → full `loadConversations()` | **Critical** | Debounced 700ms + patch messages locally |
| `StockMovements.tsx` | Paginated fetch all movements | Medium | Already paginated in prior fix |
| `App.tsx` / `Login.tsx` | `app_settings` on mount | Medium | In-memory cache (5 min TTL) |

---

## 4. Realtime Subscriptions

| Channel | Table | Issue | Fix |
|---------|-------|-------|-----|
| `wa-rt` | `whatsapp_conversations`, `whatsapp_messages` | Full list reload per event | Debounce + incremental message updates |
| `wa-msg-status-{owner}` | `whatsapp_messages` | Filtered by owner — OK | Added query limit on initial load |

**Recommendation:** Avoid Realtime on high-churn tables unless updating local state incrementally.

---

## 5. Pagination Gaps

| Page | Before | After |
|------|--------|-------|
| Orders | 50/page (OK) | Unchanged — already paginated |
| ConfirmationCenter | 1000 orders | WA messages capped at 1500 rows |
| WhatsApp messages | 500/msg thread | Reduced to 200 (sufficient for UI) |
| Stock movements | Paginated fetch | Already fixed |

---

## 6. SELECT * Replacements

Fixed in: `Orders.tsx` (sticker_settings), `WhatsAppPage.tsx`, `useStoreContext.tsx`, `useUserContext.tsx`, `StickerDesigner.tsx`.

Remaining `SELECT *` in low-traffic admin/settings pages — acceptable for now.

---

## 7. Duplicate Queries on Re-render

| Issue | Fix |
|-------|-----|
| Orders page re-fetched currency, mappings, products, sticker on **every tab switch** | Split `orders-page-meta` query with `staleTime: 5min` |
| `app_settings` read on App + Login + Wallet + Settings | Shared `fetchAppSettings()` with 5min cache |
| `Products.tsx` `store_settings.limit(1)` without store filter | Now uses `activeStoreId` |

---

## 8. Storage Usage

Storage operations are **minimal** — only `src/lib/imageStorage.ts` uploads product/landing images. Not a significant Disk IO driver compared to Postgres reads.

---

## 9. Root Causes Ranked

1. **WhatsApp Realtime conversation reloads** (~40% of observed seq reads on conversations)
2. **Unscoped / repeated config table reads** (~30%)
3. **Orders page bundled query fan-out** (~20%)
4. **Confirmation center bulk WA message fetch** (~5%)
5. **RLS + missing store_id indexes** (amplifies all of the above)

---

## 10. Implemented Optimizations

### Database
- [x] 9 new indexes (migration applied)
- [x] Prior: `stock_movements` store_id backfill + insert trigger

### Frontend
- [x] `src/lib/appSettings.ts` — cached app settings
- [x] `src/lib/ordersPageMeta.ts` — shared orders metadata fetch
- [x] `Orders.tsx` — split meta/data queries, carrier mappings scoped by store
- [x] `WhatsAppPage.tsx` — debounced realtime, column projection, store-scoped settings
- [x] `ConfirmationCenter.tsx` — capped WA message query
- [x] `Products.tsx`, `StickerDesigner.tsx` — store-scoped settings
- [x] `useStoreContext.tsx`, `useUserContext.tsx` — column projection
- [x] `App.tsx`, `Login.tsx`, `Wallet.tsx` — cached app settings

### Recommended Next Steps (not implemented)
- [ ] Cache `store_settings` / `header_settings` per store in React Query (same pattern as app_settings)
- [ ] RPC `get_latest_wa_status_for_store` instead of client-side `.in(order_id, ...)`
- [ ] Review RLS policies on config tables for index-friendly patterns
- [ ] Enable Supabase query performance monitoring in dashboard
- [ ] Consider upgrading only if edge functions / analytics writes remain high after client fixes

---

## Monitoring

After deploy, reset stats and re-check in 24h:

```sql
SELECT relname, seq_scan, idx_scan, seq_tup_read
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY seq_tup_read DESC
LIMIT 15;
```

Watch Supabase Dashboard → Database → Disk IO Budget after these changes ship to production.
