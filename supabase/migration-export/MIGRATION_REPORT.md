# Migration Report — Orderflow Boutique

**Generated:** 2026-06-03  
**Source project ref:** `iyqooryhmshlajuhabmc`  
**Target project ref:** `sukehkrhvasfnoheyvvx`  
**Production traffic switched:** **NO** — `.env` still points to old project; use `.env.staging` + `npm run dev:staging`

---

## 1. Export status

| Export item | Status | Location / notes |
|-------------|--------|------------------|
| SQL migrations (165 files) | ✅ Complete | `supabase/migrations/` |
| Migration file manifest | ✅ Generated | `supabase/migration-export/migration-file-list.txt` |
| Schema inventory (parsed) | ✅ Generated | `supabase/migration-export/schema-inventory.json` |
| Remote live schema dump | ⏳ Pending | Requires `supabase db dump` against old project + DB password |
| Edge function source export | ✅ Complete | `supabase/functions/` (37 functions) |
| Storage bucket definitions | ✅ N/A | No buckets in migrations or app code |
| Data export (rows) | ⏳ Not started | Out of scope until schema validated |

---

## 2. Schema inventory summary

Parsed from all 165 migration files:

| Category | Count | Included in migrations? |
|----------|------:|-------------------------|
| Tables (CREATE statements) | 85 | ✅ Yes |
| Tables (net active ~84) | 84 | ✅ (`rejected_orders` created then dropped) |
| ALTER TABLE references | 87 | ✅ Yes |
| RLS policies | 257 | ✅ Yes |
| Triggers | 76 | ✅ Yes |
| Functions / RPCs | 45 | ✅ Yes |
| Indexes | 134 | ✅ Yes |
| Views | 0 | ✅ N/A (none defined) |
| Enums | 1 | ✅ `app_role` |
| Extensions | 5 | ✅ See §4 |
| Storage buckets | 0 | ✅ N/A |
| Edge functions | 37 | ✅ Separate deploy |

Full table list: see `schema-inventory.json` → `tables` (84 net tables including `order_status_history`; excludes dropped `rejected_orders` from runtime).

---

## 3. Verification: types.ts vs migrations (drift)

`src/integrations/supabase/types.ts` was generated from the **old** linked project and is **out of date**.

| Drift type | Items | Action |
|------------|-------|--------|
| Tables in migrations, missing from types | `order_status_history` | Regenerate types after `db push` |
| Tables created then dropped | `rejected_orders` | No action (intentionally removed) |
| RPC/trigger functions not in types | 16 functions including `order_status_dwell_report`, `validate_safe_movement_balance`, `validate_order_status_transition`, `sync_safe_balance`, etc. | Regenerate types after `db push` |
| Phase 2 columns | `auto_mark_delivered`, `allow_negative_balance` | Applied by migration `20260603140000_phase2_controls.sql` |

**Conclusion:** Migrations are **ahead** of committed TypeScript types. This is expected; not a blocker for schema migration.

---

## 4. Extensions & infrastructure

| Extension | In migration SQL? | Manual setup on new project? |
|-----------|-------------------|------------------------------|
| `pgcrypto` | ✅ | Enable if not auto-enabled |
| `pg_cron` | ✅ | Enable in Dashboard → Database → Extensions |
| `pg_net` | ✅ | Enable in Dashboard |
| `pgmq` | ✅ | Queues created in `20260515174150_email_infra.sql` |
| `supabase_vault` | ✅ | Vault secret for email cron is **manual** |

---

## 5. Edge functions inventory (37)

All present under `supabase/functions/`:

`admin-manage-users`, `apply-order-stock`, `auth-email-hook`, `carrier-webhook`, `create-order`, `extract-order-from-image`, `facebook-oauth-callback`, `facebook-oauth-start`, `facebook-sync-insights`, `landing-ssr`, `list-shipping-dropdown`, `match-city`, `mazbot-poll`, `process-confirmation-reminders`, `process-email-queue`, `push-easyorders-quantities`, `push-subscribe`, `receive-return`, `receive-settlement`, `send-push`, `ship-orders`, `store-create-member`, `sync-carrier-statuses`, `sync-easyorder`, `sync-easyorders-products`, `sync-return-shipments`, `sync-returns`, `sync-settlement-shipments`, `sync-settlements`, `sync-shipping-zones`, `sync-warehouse-products`, `webhook-order`, `whatsapp-ai-reply`, `whatsapp-classify-intent`, `whatsapp-send`, `whatsapp-send-confirmation`, `whatsapp-webhook`

**Deploy status on new project:** ⏳ Not deployed (awaiting validation gate)

---

## 6. Successfully prepared (ready to migrate)

| Item | Status |
|------|--------|
| Complete migration history in repo | ✅ |
| Schema inventory script | ✅ `scripts/migration-inventory.mjs` |
| Validation gate workflow | ✅ `scripts/validate-and-migrate.ps1` |
| Migration plan document | ✅ `MIGRATION_PLAN.md` |
| Connect script (post-validation) | ✅ `scripts/connect-supabase.ps1` |
| Supabase CLI (dev dependency) | ✅ `npm run supabase` |
| Production `.env` unchanged | ✅ Still points to old project |
| New project credentials configured | ✅ `.env.staging` |
| `config.toml` project_id updated | ✅ `sukehkrhvasfnoheyvvx` |
| Validation gate | ✅ `VALIDATION_APPROVED.json` |
| New project CLI linked | ⏳ Requires `supabase login` on your machine |
| `db push` executed | ⏳ Pending link + database password |

---

## 7. Requires manual migration (cannot be automated from SQL alone)

| # | Item | Why manual | Priority |
|---|------|------------|----------|
| 1 | Email queue **pg_cron** job | Documented in migration comments only; uses vault + `net.http_post` | High if auth emails used |
| 2 | Vault secret `email_queue_service_role_key` | Project-specific service role | High if email queue used |
| 3 | Auth **Send Email** hook URL | Dashboard configuration | High |
| 4 | Edge function **secrets** (`AI_API_KEY`, `SITE_URL`, etc.) | Not in repo | High for AI/WhatsApp |
| 5 | Facebook OAuth redirect URI | Meta developer console | Medium if FB ads used |
| 6 | External **webhooks** (Turbo, EasyOrders, Mazbot cron) | Third-party dashboards | High for integrations |
| 7 | **Admin user** bootstrap SQL | Per-environment | High |
| 8 | **Production data** copy | Separate from schema | Required for full parity |
| 9 | **Storage buckets** | Not used by app today | None unless you add uploads |
| 10 | Regenerate **`types.ts`** | Post-push step | Medium |

---

## 8. Storage buckets

**Finding:** No `storage.buckets` inserts in migrations. No `supabase.storage` usage in `src/`. Product images and assets appear to use external URLs or inline data.

**Action:** None for schema migration. Create buckets manually if you add file upload features later.

---

## 9. Views

**Finding:** Zero `CREATE VIEW` statements in migrations. `types.ts` confirms `Views: { [_ in never]: never }`.

**Action:** None.

---

## 10. Validation gate status

```
BLOCKED — supabase/migration-export/VALIDATION_APPROVED.json does not exist
```

To proceed with link + `db push`:

1. Review this report and `MIGRATION_PLAN.md`
2. Create `VALIDATION_APPROVED.json` with your new project ref
3. Run:

```powershell
.\scripts\validate-and-migrate.ps1 -NewProjectRef YOUR_NEW_REF -ExecuteMigration
```

---

## 11. Recommended next actions (in order)

1. **You:** Create new Supabase project; save project ref + anon key (do not switch production `.env` yet)
2. **Optional:** Dump live schema from old project for diff (`supabase db dump`)
3. **You:** Review inventory JSON + approve validation gate file
4. **Run:** `supabase link` → `supabase db push` on new project
5. **Run:** `supabase functions deploy` + set secrets
6. **Manual:** Email cron, auth hook, webhooks (§7)
7. **Run:** Post-migration validation checklist (MIGRATION_PLAN.md Phase 7)
8. **Only then:** `connect-supabase.ps1` + production deploy

---

## 12. Production traffic

| Environment | Supabase project | Status |
|-------------|------------------|--------|
| Current `.env` | `iyqooryhmshlajuhabmc` | Unchanged — still old project |
| New project | _(pending)_ | Not receiving traffic |

**Do not switch `VITE_SUPABASE_*` until Phase 7 validation passes.**

---

*Re-run inventory: `node scripts/migration-inventory.mjs`*  
*Re-run validation: `.\scripts\validate-and-migrate.ps1`*
