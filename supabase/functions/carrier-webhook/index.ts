// Public webhook endpoint to receive shipment status updates from the shipping company (Turbo).
// Auth: token via ?token= or header `x-webhook-token` matching profiles.webhook_token.
// Payload: flexible — we extract shipping reference + status from common shapes.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-token, secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function pick(obj: any, keys: string[]): any {
  for (const k of keys) {
    if (obj && obj[k] !== undefined && obj[k] !== null && obj[k] !== "") return obj[k];
  }
  return null;
}

function extractRefAndStatus(body: any): { ref: string | null; status: string | null } {
  if (!body || typeof body !== "object") return { ref: null, status: null };
  // Try several common shapes
  const candidates = [body, body.data, body.shipment, body.order, body.payload].filter(Boolean);
  let ref: any = null;
  let status: any = null;
  for (const c of candidates) {
    if (!ref) ref = pick(c, [
      "shipping_reference", "shipment_reference", "reference", "ref",
      "tracking_number", "trackingNumber", "shipmentReference",
      "barcode", "awb", "code", "id",
    ]);
    if (!status) status = pick(c, [
      "status", "shipment_status", "shipmentStatus", "state", "status_name", "statusName",
    ]);
    // nested status object
    if (!status) {
      const st = c.status || c.shipmentStatus;
      if (st && typeof st === "object") status = st.name || st.label || st.value;
    }
  }
  return { ref: ref ? String(ref).trim() : null, status: status ? String(status).trim() : null };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  try {
    const url = new URL(req.url);
    const token =
      url.searchParams.get("token") ||
      req.headers.get("x-webhook-token") ||
      req.headers.get("secret") || "";
    if (!token || token.length < 10) {
      return new Response(JSON.stringify({ error: "Missing webhook token" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: profile } = await supabase
      .from("profiles")
      .select("user_id, is_active")
      .eq("webhook_token", token)
      .maybeSingle();
    if (!profile || !profile.is_active) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body: any = await req.json().catch(() => ({}));
    console.log("carrier-webhook payload", JSON.stringify(body).slice(0, 1500));

    const { ref, status } = extractRefAndStatus(body);
    if (!ref) {
      return new Response(JSON.stringify({ error: "Missing shipping reference in payload" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!status) {
      return new Response(JSON.stringify({ error: "Missing status in payload" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: updated, error: uErr } = await supabase
      .from("orders")
      .update({
        carrier_status: status,
        carrier_status_updated_at: new Date().toISOString(),
        carrier_status_raw: body,
      })
      .eq("owner_id", profile.user_id)
      .eq("shipping_reference", ref)
      .select("id");

    if (uErr) {
      console.error("update failed", uErr);
      return new Response(JSON.stringify({ error: uErr.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!updated || updated.length === 0) {
      console.warn("no order matched", ref);
      return new Response(JSON.stringify({ ok: true, matched: 0, ref }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true, matched: updated.length, ref, status }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("carrier-webhook error", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});