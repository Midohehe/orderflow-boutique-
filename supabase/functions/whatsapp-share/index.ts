// Share a merchant's WhatsApp integration with another merchant by email.
// Creating a share needs the Auth Admin API (email -> user id) + service role,
// so it lives here. Listing / revoking / toggling are done directly from the UI
// via RLS on public.whatsapp_shares.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Decode a JWT payload without verifying (the gateway already verified it when
// verify_jwt = true). Returns the claims object or null.
function decodeJwt(token: string): any | null {
  try {
    const part = token.split(".")[1];
    if (!part) return null;
    const b64 = part.replace(/-/g, "+").replace(/_/g, "/");
    const pad = b64.length % 4 ? "=".repeat(4 - (b64.length % 4)) : "";
    const jsonStr = new TextDecoder().decode(
      Uint8Array.from(atob(b64 + pad), (c) => c.charCodeAt(0)),
    );
    return JSON.parse(jsonStr);
  } catch (_) {
    return null;
  }
}

async function findUserByEmail(admin: any, email: string): Promise<any | null> {
  const target = email.trim().toLowerCase();
  for (let page = 1; page <= 40; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) break;
    const users = data?.users || [];
    const hit = users.find((u: any) => String(u.email || "").toLowerCase() === target);
    if (hit) return hit;
    if (users.length < 200) break; // last page
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Identify the caller. The gateway (verify_jwt = true) has already verified
    // the JWT signature, so we can read the `sub` claim directly. Fall back to
    // admin.auth.getUser(token) if the claim is missing.
    const token = authHeader.replace(/^Bearer\s+/i, "");
    const claims = decodeJwt(token);
    let callerId: string | null = (claims?.sub as string) || null;
    const role = claims?.role || claims?.["role"];
    if (!callerId) {
      const { data: userData } = await admin.auth.getUser(token);
      callerId = userData?.user?.id || null;
    }
    if (!callerId || role === "anon" || role === "service_role") {
      return json({ error: "Unauthorized", debug: { role: role || null, hasSub: !!claims?.sub } }, 401);
    }

    // Resolve the merchant account behind the caller (staff -> parent owner).
    const { data: effOwner } = await admin.rpc("get_effective_owner_id", { _uid: callerId });
    const ownerId = (effOwner as string) || callerId;

    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "create");

    if (action === "create") {
      const email = String(body.email || "").trim().toLowerCase();
      if (!email || !email.includes("@")) return json({ error: "بريد إلكتروني غير صالح" }, 400);

      const recipient = await findUserByEmail(admin, email);
      if (!recipient) return json({ error: "لا يوجد حساب بهذا البريد الإلكتروني" }, 404);
      if (recipient.id === ownerId) return json({ error: "لا يمكنك مشاركة الواتساب مع نفسك" }, 400);

      // Recipient must be a merchant account (has a profile row).
      const { data: prof } = await admin.from("profiles").select("user_id")
        .eq("user_id", recipient.id).maybeSingle();
      if (!prof) return json({ error: "هذا الحساب ليس حساب تاجر" }, 400);

      // Sharer email snapshot (the merchant account behind the caller).
      let ownerEmail: string | null = null;
      try {
        const { data: ownerUser } = await admin.auth.admin.getUserById(ownerId);
        ownerEmail = ownerUser?.user?.email || null;
      } catch (_) { /* ignore */ }

      const { error: upErr } = await admin.from("whatsapp_shares").upsert({
        owner_id: ownerId,
        owner_email: ownerEmail,
        shared_with_user_id: recipient.id,
        shared_with_email: recipient.email,
        status: "active",
        recipient_active: true,
        updated_at: new Date().toISOString(),
      }, { onConflict: "owner_id,shared_with_user_id" });
      if (upErr) return json({ error: upErr.message }, 400);

      return json({ ok: true, shared_with_email: recipient.email });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e: any) {
    return json({ error: e?.message || String(e) }, 500);
  }
});
