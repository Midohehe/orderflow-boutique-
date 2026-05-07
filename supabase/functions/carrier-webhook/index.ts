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

// Accurate / Turbo callback shape (per docs):
// {
//   shipmentId, typeCode, shipmentStatusCode, returnTypeCode,
//   deliveryTypeCode, deliveredAmount, collectedFees, deliveryDate,
//   cancellationReasonId, notes
// }
function extractFromPayload(body: any): {
  shipmentId: string | null;
  ref: string | null;
  status: string | null;
} {
  if (!body || typeof body !== "object") return { shipmentId: null, ref: null, status: null };
  const candidates = [body, body.data, body.shipment, body.order, body.payload].filter(Boolean);
  let shipmentId: any = null;
  let ref: any = null;
  let status: any = null;
  for (const c of candidates) {
    if (!shipmentId) shipmentId = pick(c, ["shipmentId", "shipment_id"]);
    if (!ref) ref = pick(c, [
      "code", "refNumber", "ref_number", "shipping_reference", "shipment_reference",
      "reference", "ref", "tracking_number", "trackingNumber", "barcode", "awb",
    ]);
    if (!status) status = pick(c, [
      "shipmentStatusCode", "shipment_status_code",
      "status", "shipment_status", "shipmentStatus", "state", "status_name", "statusName",
    ]);
    if (!status) {
      const st = c.status || c.shipmentStatus;
      if (st && typeof st === "object") status = st.name || st.label || st.value || st.code;
    }
  }
  return {
    shipmentId: shipmentId != null ? String(shipmentId).trim() : null,
    ref: ref ? String(ref).trim() : null,
    status: status != null ? String(status).trim() : null,
  };
}

// Map Accurate shipmentStatusCode → Arabic label.
// Common Accurate status codes (best-effort labeling; raw code is also stored).
const STATUS_LABELS: Record<string, string> = {
  PRP: "جارى التجهيز",
  PRPD: "تم التجهيز",
  STD: "قيد الارسال للمندوب",
  DEX: "متابعة",
  HTR: "انتظار لإعادة التوصيل",
  PKH: "انتظار لإعادة الالتقاط",
  DTR: "تم التسليم",
  DTRC: "تم التسليم",
  DTRCP: "تم التسليم مع التسوية",
  DTRUC: "تم التسليم تحت تسوية المندوب",
  RTS: "راجع",
  RTSD: "راجع لدى المندوب",
  RTSC: "راجع لدى الشركة",
  OTR: "قيد الإرجاع",
  RTRN: "تم الإرجاع للراسل",
  RCV: "ارتجاع للمخزن",
  UPKBL: "جاهز للتفريغ",
  UPKBD: "تم التفريغ",
  BMR: "مناولة بين الفروع - وارد",
  BMT: "مناولة بين الفروع - صادر",
};

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

    const { shipmentId, ref, status } = extractFromPayload(body);
    if (!shipmentId && !ref) {
      return new Response(JSON.stringify({ error: "Missing shipmentId/reference in payload" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!status) {
      return new Response(JSON.stringify({ error: "Missing shipmentStatusCode in payload" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Look up custom mapping for this owner first
    const { data: mapping } = await supabase
      .from("carrier_status_mappings")
      .select("custom_label")
      .eq("owner_id", profile.user_id)
      .eq("status_code", String(status))
      .maybeSingle();

    const label = mapping?.custom_label
      ? mapping.custom_label
      : STATUS_LABELS[status]
        ? `${STATUS_LABELS[status]} (${status})`
        : String(status);

    let q = supabase
      .from("orders")
      .update({
        carrier_status: label,
        carrier_status_updated_at: new Date().toISOString(),
        carrier_status_raw: body,
      })
      .eq("owner_id", profile.user_id);
    // Prefer matching by shipment internal id, fallback to reference/code.
    if (shipmentId) q = q.eq("shipping_id", shipmentId);
    else q = q.eq("shipping_reference", ref!);
    const { data: updated, error: uErr } = await q.select("id");

    if (uErr) {
      console.error("update failed", uErr);
      return new Response(JSON.stringify({ error: uErr.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!updated || updated.length === 0) {
      console.warn("no order matched", { shipmentId, ref });
      return new Response(JSON.stringify({ ok: true, matched: 0, shipmentId, ref }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true, matched: updated.length, shipmentId, ref, status: label }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("carrier-webhook error", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});