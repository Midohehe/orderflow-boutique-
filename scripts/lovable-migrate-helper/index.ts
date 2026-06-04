/**
 * Deploy this ONCE on your Lovable Cloud project (source), then delete after migration.
 *
 * In Lovable chat:
 *   "Create edge function migrate-helper with this code, deploy it, verify_jwt = false"
 *
 * Replace ACCESS_KEY with a long random string (keep it secret).
 * After migration: delete this function and rotate secrets.
 */

const BUILD_ID = "2026-03-04-orderflow";
const ACCESS_KEY = "REPLACE_WITH_LONG_RANDOM_KEY";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "x-access-key, x-client-info, apikey, content-type",
};

const responseHeaders = {
  ...corsHeaders,
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
  "X-Build-Id": BUILD_ID,
};

const json = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload, null, 2), { status, headers: responseHeaders });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: responseHeaders });

  const key = req.headers.get("x-access-key")?.trim();
  if (!key || key !== ACCESS_KEY) {
    return json({ error: "Unauthorized" }, 401);
  }

  const supabaseDbUrl = Deno.env.get("SUPABASE_DB_URL")?.trim();
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim();
  if (!supabaseDbUrl || !serviceRoleKey) {
    return json({ error: "Missing SUPABASE_DB_URL or SUPABASE_SERVICE_ROLE_KEY on source" }, 500);
  }

  let body: Record<string, unknown> | null = null;
  try {
    const raw = await req.text();
    if (raw.trim()) body = JSON.parse(raw);
  } catch {
    /* ping without body is ok */
  }

  if (body?.action === "ping") {
    return json({ ok: true, build_id: BUILD_ID, checks: { db_url: true, service_role: true } });
  }

  return json({
    build_id: BUILD_ID,
    generated_at: new Date().toISOString(),
    supabase_db_url: supabaseDbUrl,
    service_role_key: serviceRoleKey,
  });
});
