import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function cleanKey(raw?: string): string {
  if (!raw) return "";
  // Keep only base64url characters; strip quotes, commas, whitespace, padding
  return raw.replace(/[^A-Za-z0-9_-]/g, "");
}
const VAPID_PUBLIC_RAW = Deno.env.get("VAPID_PUBLIC_KEY") || "";
const VAPID_PRIVATE_RAW = Deno.env.get("VAPID_PRIVATE_KEY") || "";
const VAPID_PUBLIC = cleanKey(VAPID_PUBLIC_RAW);
const VAPID_PRIVATE = cleanKey(VAPID_PRIVATE_RAW);
console.log("VAPID key lengths", { pub: VAPID_PUBLIC.length, priv: VAPID_PRIVATE.length, rawPub: VAPID_PUBLIC_RAW.length });

// Sanitize subject: strip spaces, angle brackets, ensure mailto: or https:// prefix
function normalizeSubject(raw?: string): string {
  const fallback = "mailto:admin@example.com";
  if (!raw) return fallback;
  let s = raw.trim().replace(/[<>]/g, "").replace(/\s+/g, "");
  if (!s) return fallback;
  if (s.startsWith("mailto:") || s.startsWith("https://") || s.startsWith("http://")) return s;
  if (s.includes("@")) return `mailto:${s}`;
  return `https://${s}`;
}
const VAPID_SUBJECT = normalizeSubject(Deno.env.get("VAPID_SUBJECT"));

let vapidReady = false;
let vapidError: string | null = null;
try {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
  vapidReady = true;
} catch (e: any) {
  vapidError = String(e?.message || e);
  console.error("VAPID init failed:", vapidError);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (!vapidReady) {
    return new Response(JSON.stringify({ error: "vapid_invalid", detail: vapidError, pubLen: VAPID_PUBLIC.length, privLen: VAPID_PRIVATE.length }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
  try {
    const body = await req.json();
    // { store_id?, user_id?, title, body, url?, image?, tag? }
    const { store_id, user_id, title, body: msgBody, url, image, tag } = body;
    if (!title) {
      return new Response(JSON.stringify({ error: "title required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // If store_id, check store has push_enabled
    if (store_id) {
      const { data: store } = await admin.from("stores").select("push_enabled, owner_id").eq("id", store_id).maybeSingle();
      if (!store?.push_enabled) {
        return new Response(JSON.stringify({ ok: true, skipped: "push_disabled" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    let query = admin.from("push_subscriptions").select("*");
    if (user_id) query = query.eq("user_id", user_id);
    else if (store_id) {
      // Get store owner + members and send to all their subscriptions
      const { data: store } = await admin.from("stores").select("owner_id").eq("id", store_id).maybeSingle();
      if (!store) {
        return new Response(JSON.stringify({ error: "store_not_found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      query = query.eq("user_id", store.owner_id);
    }
    const { data: subs, error } = await query;
    if (error) throw error;
    if (!subs || subs.length === 0) {
      return new Response(JSON.stringify({ ok: true, sent: 0 }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const payload = JSON.stringify({ title, body: msgBody || "", url: url || "/dashboard", image, tag });
    let sent = 0; let removed = 0;
    await Promise.all(subs.map(async (s: any) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload
        );
        sent++;
      } catch (err: any) {
        const code = err?.statusCode;
        if (code === 404 || code === 410) {
          await admin.from("push_subscriptions").delete().eq("id", s.id);
          removed++;
        } else {
          console.error("push error", code, err?.body || err?.message);
        }
      }
    }));

    return new Response(JSON.stringify({ ok: true, sent, removed }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: String(e?.message || e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});