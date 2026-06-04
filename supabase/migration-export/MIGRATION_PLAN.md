# Supabase Migration Plan — Orderflow Boutique

**Status:** Pre-migration (validation phase)  
**Source project:** `iyqooryhmshlajuhabmc` (current `.env` / `config.toml`)  
**Target project:** _(your new Supabase project — not linked yet)_  
**Policy:** Do **not** switch `VITE_SUPABASE_*` or production traffic until post-migration validation passes.

---

## Executive summary

The complete database schema is version-controlled as **165 SQL migration files** under `supabase/migrations/`. There is **no separate remote-only schema** in the repo; migrations are the authoritative export. A machine-readable inventory was generated at `supabase/migration-export/schema-inventory.json`.

| Object type | Count (from migrations) |
|-------------|-------------------------|
| Migration files | 165 |
| Tables (CREATE; net ~84 after DROP) | 85 created, 1 dropped (`rejected_orders`) |
| RLS policies | 257 |
| Triggers | 76 |
| DB functions (RPC/triggers) | 45 |
| Indexes | 134 |
| Views | 0 |
| Storage buckets (SQL) | 0 |
| Edge functions (repo) | 37 |
| Postgres extensions | pgcrypto, pg_cron, pg_net, pgmq, supabase_vault |

---

## Phase 0 — Export & inventory (current step)

### 0.1 Migrations export

**Location:** `supabase/migrations/*.sql` (165 files)  
**Manifest:** `supabase/migration-export/migration-file-list.txt`

No action needed — migrations are already in git.

### 0.2 Schema inventory

```powershell
cd C:\Users\Administrator\Projects\orderflow-boutique
node scripts/migration-inventory.mjs
```

**Output:** `supabase/migration-export/schema-inventory.json`

### 0.3 Optional: live schema dump from OLD project

Compare migrations against what is actually deployed on the current Supabase project:

```powershell
npx supabase login
npx supabase link --project-ref iyqooryhmshlajuhabmc
npx supabase db dump --schema public -f supabase/migration-export/remote-public-schema.sql
```

Requires database password from Supabase Dashboard → Project Settings → Database.

### 0.4 Regenerate TypeScript types (baseline)

Current `src/integrations/supabase/types.ts` is **stale** vs latest migrations. After any successful `db push` on the new project:

```powershell
npx supabase gen types typescript --linked > src/integrations/supabase/types.ts
```

Known drift before regen:

- Table `order_status_history` (Phase 1 migration) — in migrations, not in types
- RPCs: `order_status_dwell_report`, `validate_safe_movement_balance`, `validate_order_status_transition`, etc.
- Columns: `shipping_settings.auto_mark_delivered`, `safes.allow_negative_balance` (Phase 2)

---

## Phase 1 — Validation gate (required before link/migrate)

Review:

1. `supabase/migration-export/schema-inventory.json`
2. This document
3. `supabase/migration-export/MIGRATION_REPORT.md`

When approved, create:

```json
// supabase/migration-export/VALIDATION_APPROVED.json
{
  "approved_by": "your-name",
  "approved_at": "2026-06-03T12:00:00Z",
  "new_project_ref": "YOUR_NEW_PROJECT_REF",
  "notes": "Reviewed inventory and manual steps checklist"
}
```

Run validation script (does **not** migrate by default):

```powershell
.\scripts\validate-and-migrate.ps1
```

---

## Phase 2 — Link NEW project (schema only, no traffic switch)

```powershell
npx supabase login
npx supabase link --project-ref YOUR_NEW_PROJECT_REF
```

**Do not** run `connect-supabase.ps1` yet — that updates frontend `.env`.

Verify link:

```powershell
npx supabase projects list
cat supabase\.temp\project-ref   # if present after link
```

---

## Phase 3 — Apply migrations (after validation gate)

Only when `VALIDATION_APPROVED.json` exists:

```powershell
.\scripts\validate-and-migrate.ps1 -NewProjectRef YOUR_NEW_PROJECT_REF -ExecuteMigration
# or manually:
npx supabase db push
```

Expected result: empty database → full schema matching migration history.

**Rollback:** Supabase does not auto-rollback `db push`. For a fresh project, delete and recreate the project if push fails mid-way, or fix forward with a new migration.

---

## Phase 4 — Edge functions & secrets

### 4.1 Deploy all edge functions

```powershell
npx supabase functions deploy
```

37 functions — see `schema-inventory.json` → `edge_functions`.

### 4.2 Required secrets (Dashboard → Edge Functions → Secrets)

| Secret | Purpose |
|--------|---------|
| `AI_API_KEY` | WhatsApp AI, match-city, image OCR |
| `AI_API_BASE_URL` | Optional OpenRouter base URL |
| `AI_MODEL` | Optional model override |
| `SITE_URL` | Auth emails, OAuth redirects |
| `APP_ORIGIN` | Landing SSR shell fetch |
| `AUTH_HOOK_SECRET` | Auth email hook verification |
| `RESEND_API_KEY` | Email delivery (or `EMAIL_SEND_URL`) |

Functions receive `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` automatically.

### 4.3 Auth hook (manual)

Authentication → Hooks → Send Email:

```
https://YOUR_NEW_REF.supabase.co/functions/v1/auth-email-hook
```

Header: `Authorization: Bearer <AUTH_HOOK_SECRET>`

---

## Phase 5 — Manual migration (NOT in static SQL)

These were applied dynamically on the old project and **must be re-done** on the new project:

| Item | Source | Action on new project |
|------|--------|------------------------|
| Email queue pg_cron job | `20260515174150_email_infra.sql` comments | Create vault secret `email_queue_service_role_key` + schedule `process-email-queue` cron calling edge function via `pg_net` |
| pgmq queues | Same migration | Created by migration (`auth_emails`, `transactional_emails`, DLQs) — verify after push |
| Mazbot poll schedule | External / Dashboard cron | If used, point cron at `.../functions/v1/mazbot-poll` |
| Facebook OAuth redirect | Meta app settings | Update to new `facebook-oauth-callback` URL |
| Carrier / order webhooks | Turbo, EasyOrders, etc. | Re-copy webhook URLs from app (tokens regenerate per user) |
| Push notifications VAPID | If configured | Re-enter in app settings |
| First admin user | SQL | `INSERT INTO user_roles ... admin` after signup |
| Storage buckets | Not used in codebase | **None required** unless you add file uploads later |

---

## Phase 6 — Data migration (optional)

This plan covers **schema + functions only**. Moving **production data** (orders, products, users) requires a separate step:

- `pg_dump` / `pg_restore` from old DB, or
- Supabase replication / CSV export per table, or
- Start fresh on new project (recommended for staging validation first)

**Auth users:** use Supabase Auth export/import or require password reset on new project.

---

## Phase 7 — Post-migration validation (before traffic switch)

Run on **staging** pointing `.env` at the new project only after all checks pass:

| Check | How |
|-------|-----|
| Schema object counts | Re-run `node scripts/migration-inventory.mjs`, compare counts |
| Types regenerated | `types.ts` includes `order_status_history`, Phase 2 RPCs |
| Sign up / login | Auth + email hook |
| Create store + order | Core CRUD |
| Safe movement guard | Expense with insufficient balance blocked |
| Internal settlement | Only `delivered` orders settle |
| Carrier webhook | Test with sample payload |
| Shipping sync | `sync-carrier-statuses` with Turbo credentials |
| Financial reports | P&L, cash flow RPCs |
| WhatsApp / AI | If used, with `AI_API_KEY` |

When all pass, update production `.env` and redeploy frontend.

---

## Phase 8 — Production cutover

1. Maintenance window (optional)
2. Final data sync if migrating data
3. Update production `VITE_SUPABASE_*` + rebuild frontend
4. Update all external webhook URLs
5. Monitor logs for 24–48h
6. Keep old project read-only for rollback period

---

## Files & scripts reference

| File | Purpose |
|------|---------|
| `scripts/migration-inventory.mjs` | Parse migrations → JSON inventory |
| `scripts/validate-and-migrate.ps1` | Validation gate + optional link/push |
| `scripts/connect-supabase.ps1` | Update `.env` (use **after** validation only) |
| `supabase/migration-export/schema-inventory.json` | Full object inventory |
| `supabase/migration-export/MIGRATION_REPORT.md` | Status report |

---

## Risk register

| Risk | Mitigation |
|------|------------|
| Migrations fail mid-push | Use fresh project; fix SQL; re-push |
| Email cron not recreated | Follow Phase 5 manual steps |
| Stale `types.ts` | Regenerate after push |
| Webhooks still point to old project | Update all integrations before cutover |
| Extension permissions (pg_cron) | Enable in Dashboard → Database → Extensions |
| Service role in vault for email | Must use **new** project's service role key |
