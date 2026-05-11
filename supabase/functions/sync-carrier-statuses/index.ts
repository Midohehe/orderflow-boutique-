// Syncs carrier (shipping company) status for all shipped orders by querying
// Turbo / Accurate GraphQL `shipment(id)` for each order's shipping_id.
// Returns the distinct status codes encountered so the user can label them.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const STATUS_LABELS: Record<string, string> = {
  PRP: "جارى التجهيز",
  PRPD: "تم التجهيز",
  STD: "قيد الارسال للمندوب",
  DEX: "متابعة",
  HTR: "انتظار لإعادة التوصيل",
  PKH: "انتظار لإعادة الالتقاط",
  DTR: "تم التسليم",
  DTRC: "تم التسليم والتحصيل",
  DTRCP: "تم التسليم والسداد للعميل",
  DTRUC: "تم التسليم دون تحصيل",
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

function buildComposite(statusCode: string | null, deliveryTypeCode: any, returnTypeCode: any): string | null {
  if (!statusCode) return null;
  const base = String(statusCode).trim();
  if (!base) return null;
  if (base.toUpperCase() === "DTR") return "DTR";
  if (base.toUpperCase() === "RTS") {
    const suffix = deliveryTypeCode ?? returnTypeCode;
    if (suffix != null && String(suffix).trim() !== "") return base + String(suffix).trim();
  }
  return base;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const ownerId = userData.user.id;
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: settingsRows } = await admin
      .from("shipping_settings").select("*").eq("owner_id", ownerId).eq("enabled", true)
      .order("updated_at", { ascending: false }).limit(1);
    const settings = settingsRows?.[0];
    if (!settings || !settings.email || !settings.password) {
      return new Response(JSON.stringify({ error: "إعدادات شركة الشحن غير مكتملة" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const endpoint: string = settings.endpoint || "https://turboex.ly:8001/graphql";

    const loginRes = await fetch(endpoint, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: `mutation Login($input: LoginInput!) { login(input: $input) { token } }`,
        variables: { input: { username: settings.email, password: settings.password, rememberMe: true } },
      }),
    });
    const loginJson = await loginRes.json().catch(() => ({}));
    const token: string | undefined = loginJson?.data?.login?.token;
    if (!token) {
      return new Response(JSON.stringify({ error: "فشل تسجيل الدخول لشركة الشحن" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const gql = async (query: string, variables: Record<string, unknown> = {}) => {
      const r = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ query, variables }),
      });
      return await r.json().catch(() => ({}));
    };

    // Fetch orders that have a shipping_id and are in shipped/delivered/etc lifecycle.
    const { data: orders, error: oErr } = await admin
      .from("orders")
      .select("id, shipping_id, shipping_reference, status, carrier_status")
      .eq("owner_id", ownerId)
      .not("shipping_id", "is", null);
    if (oErr) {
      return new Response(JSON.stringify({ error: oErr.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Pre-load custom mappings
    const { data: mappings } = await admin
      .from("carrier_status_mappings").select("status_code, custom_label").eq("owner_id", ownerId);
    const mappingMap = new Map<string, string>();
    (mappings || []).forEach((m: any) => mappingMap.set(String(m.status_code), m.custom_label));

    const codeStats = new Map<string, { count: number; label: string; mapped: boolean }>();
    let updated = 0;
    let failed = 0;
    const errors: string[] = [];

    const SHIPMENT_QUERY = `query ($id: Int!) {
      shipment(id: $id) {
        id code refNumber notes
        status { code name }
        deliveryType { code name }
        returnType { code name }
        cancellationReason { id name }
        collectedFees
        deliveredAmount
      }
    }`;

    for (const o of orders || []) {
      const shipId = Number(o.shipping_id);
      if (!Number.isFinite(shipId)) continue;
      const res = await gql(SHIPMENT_QUERY, { id: shipId });
      const sh = res?.data?.shipment;
      if (!sh) {
        failed++;
        if (res?.errors?.[0]?.message && errors.length < 5) errors.push(res.errors[0].message);
        continue;
      }
      const statusCode = sh.status?.code ?? null;
      const composite = buildComposite(
        statusCode,
        sh.deliveryType?.code,
        sh.returnType?.code,
      );
      if (!composite) { failed++; continue; }

      const customLabel = mappingMap.get(composite);
      const label = customLabel
        ? customLabel
        : STATUS_LABELS[composite]
          ? `${STATUS_LABELS[composite]} (${composite})`
          : String(composite);

      const stat = codeStats.get(composite) || {
        count: 0,
        label: STATUS_LABELS[composite] || sh.status?.name || composite,
        mapped: !!customLabel,
      };
      stat.count += 1;
      codeStats.set(composite, stat);

      const updatePayload: Record<string, unknown> = {
        carrier_status: label,
        carrier_status_updated_at: new Date().toISOString(),
        carrier_status_raw: sh,
      };
      // Prefer the human-readable name over the numeric ID so the UI shows
      // an actual reason instead of just a code.
      const crName = sh.cancellationReason?.name ?? sh.cancellationReason?.id ?? null;
      if (crName != null && String(crName).trim() !== "") {
        updatePayload.carrier_cancellation_reason_id = String(crName);
      }
      if (sh.notes != null && String(sh.notes).trim() !== "") {
        updatePayload.carrier_notes = String(sh.notes);
      }
      const { error: uErr } = await admin
        .from("orders").update(updatePayload).eq("id", o.id);
      if (uErr) { failed++; if (errors.length < 5) errors.push(uErr.message); }
      else updated++;
    }

    const codes = Array.from(codeStats.entries())
      .map(([code, v]) => ({ code, count: v.count, label: v.label, mapped: v.mapped }))
      .sort((a, b) => b.count - a.count);

    return new Response(JSON.stringify({
      ok: true,
      total: orders?.length ?? 0,
      updated,
      failed,
      codes,
      errors,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("sync-carrier-statuses error", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});