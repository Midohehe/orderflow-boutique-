# Fresh start after reset — sukehkrhvasfnoheyvvx

**Reset completed:** public schema dropped, migration history cleared.

## Apply schema (one command — do NOT use MCP batches)

```powershell
cd C:\Users\Administrator\Projects\orderflow-boutique

# 1. Log in (browser opens once)
npm exec supabase -- login

# 2. Link project (enter database password when prompted)
npm exec supabase -- link --project-ref sukehkrhvasfnoheyvvx

# 3. Apply all 165 migrations in order (~2–5 min)
npm run db:push
```

Database password: **Supabase Dashboard → Project Settings → Database**

## After db:push succeeds

```powershell
# Deploy edge functions
npm run functions:deploy

# Regenerate TypeScript types
npm exec supabase -- gen types typescript --linked > src/integrations/supabase/types.ts

# Run app
npm run dev
```

## Dashboard setup (manual)

1. **Edge Functions → Secrets:** `AI_API_KEY`, `SITE_URL`, `RESEND_API_KEY`, `AUTH_HOOK_SECRET`
2. **Authentication → Hooks:** Send Email → `https://sukehkrhvasfnoheyvvx.supabase.co/functions/v1/auth-email-hook`
3. **SQL Editor** — after first signup, run `supabase/scripts/post-install-assign-admin.sql`  
   (replace `you@example.com` with your email; promotes to admin + backfills `owner_id`)

## .env (already correct)

```
VITE_SUPABASE_URL=https://sukehkrhvasfnoheyvvx.supabase.co
VITE_SUPABASE_PROJECT_ID=sukehkrhvasfnoheyvvx
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

**Do not use MCP apply_migration for bulk schema** — use `db push` only.
