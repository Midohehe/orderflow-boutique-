# Orderflow Boutique (وصلة)

Arabic e-commerce and order-management platform built with React, Vite, and Supabase.

## Local development

Requirements: Node.js 18+ and npm.

```sh
git clone https://github.com/aramstore/orderflow-boutique.git
cd orderflow-boutique
npm install
npm run dev
```

The dev server runs at http://localhost:8080.

Copy `.env` from `.env.example` with your Supabase credentials:

```
VITE_SUPABASE_PROJECT_ID=your-project-ref
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-key
```

## Connect a new Supabase project

Use this when moving from the old Lovable/hosted project to your own Supabase account.

### 1. Create the project

1. Go to [supabase.com/dashboard](https://supabase.com/dashboard) and create a **new project**.
2. Open **Project Settings → API** and copy:
   - **Project URL**
   - **Project ref** (subdomain, e.g. `abcdefghijklmnop`)
   - **anon public** key

### 2. Point the app at the new project

**Option A — script (Windows):**

```powershell
cd orderflow-boutique
.\scripts\connect-supabase.ps1
```

**Option B — manual:** edit `.env` and set `supabase/config.toml` → `project_id` to your new ref.

Restart the dev server after changing `.env`.

### 3. Apply the database schema

Install/login/link with the Supabase CLI, then push all migrations:

```powershell
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
```

This creates all tables, RLS policies, triggers, and RPCs (~165 migration files).

### 4. Deploy edge functions

```powershell
npx supabase functions deploy
```

Supabase injects `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` automatically in the cloud.

### 5. Configure secrets (Dashboard → Edge Functions → Secrets)

| Secret | Required for |
|--------|----------------|
| `AI_API_KEY` | WhatsApp AI, city matching, image extraction |
| `AI_API_BASE_URL` | Optional. Default: OpenRouter |
| `SITE_URL` | Auth emails, OAuth redirects |
| `AUTH_HOOK_SECRET` | Auth email hook |
| `RESEND_API_KEY` | Sending auth emails |
| `APP_ORIGIN` | Landing page SSR |

### 6. Auth email hook (optional but recommended)

In **Authentication → Hooks**, set **Send Email** to:

```
https://YOUR_PROJECT_REF.supabase.co/functions/v1/auth-email-hook
```

Add header `Authorization: Bearer YOUR_AUTH_HOOK_SECRET`.

### 7. First admin user

After signing up in the app, promote your user in the SQL editor:

```sql
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin' FROM auth.users WHERE email = 'you@example.com'
ON CONFLICT DO NOTHING;
```

(Adjust table/column names if your schema uses a different admin pattern.)

### 8. Verify

```powershell
npm run dev
```

Sign up / log in and confirm data loads. Webhook URLs in **Integrations** and **Shipping Settings** will automatically use the new `VITE_SUPABASE_URL`.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Preview production build |
| `npm run lint` | Run ESLint |

## Stack

- Vite + React 18 + TypeScript
- Tailwind CSS + shadcn/ui
- Supabase (auth, database, edge functions)
- TanStack Query, React Router, PWA support

## Supabase edge functions

AI features (WhatsApp replies, city matching, order image extraction) use an **OpenAI-compatible API**. Set these secrets in your Supabase project:

| Secret | Description |
|--------|-------------|
| `AI_API_KEY` | API key (OpenAI, OpenRouter, etc.) |
| `AI_API_BASE_URL` | Optional. Defaults to `https://openrouter.ai/api/v1` |
| `AI_MODEL` | Optional default model override |

Auth emails use a **Send Email Hook** (`auth-email-hook`) with standard Supabase payload format:

| Secret | Description |
|--------|-------------|
| `AUTH_HOOK_SECRET` | Bearer token for hook verification |
| `RESEND_API_KEY` | Send via [Resend](https://resend.com), or use `EMAIL_SEND_URL` |
| `SITE_URL` | Public app URL for email links |

Landing-page SSR (`landing-ssr`) fetches the SPA shell from `APP_ORIGIN` (or `SITE_URL`). Set this to your deployed frontend URL.

## Deployment

1. Build the frontend: `npm run build`
2. Deploy `dist/` to any static host (Cloudflare Pages, Netlify, nginx, etc.)
3. Deploy Supabase edge functions: `supabase functions deploy`
4. Optionally use `cloudflare-worker/worker.js` to route `/p/*` to SSR and everything else to your SPA

## License

Private project.
