import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const APP_ORIGIN = "https://was-la.com";

function html(body: string) {
  return new Response(`<!doctype html><html dir="rtl"><head><meta charset="utf-8"><title>Facebook</title><style>body{font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#0f172a;color:#fff;text-align:center;padding:20px}</style></head><body><div>${body}</div></body></html>`, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

function redirectBack(status: "success" | "error", message?: string) {
  const url = new URL(`${APP_ORIGIN}/dashboard/facebook-ads`);
  url.searchParams.set("fb", status);
  if (message) url.searchParams.set("msg", message);
  return Response.redirect(url.toString(), 302);
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const errorParam = url.searchParams.get("error");

  if (errorParam) return redirectBack("error", errorParam);
  if (!code || !state) return html("معامل غير صالح");

  const sb = createClient(SUPABASE_URL, SERVICE_KEY);

  try {
    // Validate state
    const { data: st } = await sb.from("facebook_oauth_states" as any)
      .select("store_id, owner_id, created_at").eq("token", state).maybeSingle();
    if (!st) return html("حالة OAuth غير صالحة أو منتهية");
    await sb.from("facebook_oauth_states" as any).delete().eq("token", state);

    const { data: cfg } = await sb.from("facebook_app_config" as any).select("app_id, app_secret").limit(1).maybeSingle();
    const appId = (cfg as any)?.app_id;
    const appSecret = (cfg as any)?.app_secret;
    if (!appId || !appSecret) return html("لم تُعد بيانات تطبيق فيسبوك");

    const redirectUri = `${SUPABASE_URL}/functions/v1/facebook-oauth-callback`;

    // Exchange code -> short-lived token
    const tokenUrl = new URL("https://graph.facebook.com/v21.0/oauth/access_token");
    tokenUrl.searchParams.set("client_id", appId);
    tokenUrl.searchParams.set("client_secret", appSecret);
    tokenUrl.searchParams.set("redirect_uri", redirectUri);
    tokenUrl.searchParams.set("code", code);
    const tokenRes = await fetch(tokenUrl.toString());
    const tokenJson = await tokenRes.json();
    if (!tokenRes.ok || !tokenJson.access_token) {
      return html(`فشل تبادل الرمز: ${JSON.stringify(tokenJson)}`);
    }
    const shortToken = tokenJson.access_token as string;

    // Exchange to long-lived (60-day) token
    const llUrl = new URL("https://graph.facebook.com/v21.0/oauth/access_token");
    llUrl.searchParams.set("grant_type", "fb_exchange_token");
    llUrl.searchParams.set("client_id", appId);
    llUrl.searchParams.set("client_secret", appSecret);
    llUrl.searchParams.set("fb_exchange_token", shortToken);
    const llRes = await fetch(llUrl.toString());
    const llJson = await llRes.json();
    const accessToken = (llJson.access_token as string) || shortToken;
    const expiresIn = (llJson.expires_in as number) || 0;
    const expiresAt = expiresIn ? new Date(Date.now() + expiresIn * 1000).toISOString() : null;

    // Fetch user info
    const meRes = await fetch(`https://graph.facebook.com/v21.0/me?fields=id,name&access_token=${accessToken}`);
    const me = await meRes.json();

    // Fetch first ad account
    const acctRes = await fetch(`https://graph.facebook.com/v21.0/me/adaccounts?fields=id,name,account_id&limit=1&access_token=${accessToken}`);
    const acctJson = await acctRes.json();
    const firstAcct = acctJson?.data?.[0];

    await sb.from("store_facebook_connections" as any).upsert({
      store_id: (st as any).store_id,
      owner_id: (st as any).owner_id,
      fb_user_id: me?.id || null,
      fb_user_name: me?.name || null,
      access_token: accessToken,
      token_expires_at: expiresAt,
      ad_account_id: firstAcct?.id || null,
      ad_account_name: firstAcct?.name || null,
      scopes: "ads_read,ads_management,business_management,read_insights",
      updated_at: new Date().toISOString(),
    }, { onConflict: "store_id" });

    return redirectBack("success");
  } catch (e: any) {
    return html(`خطأ: ${e.message}`);
  }
});