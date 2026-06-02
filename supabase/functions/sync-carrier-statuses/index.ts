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
  UKDB: "تم التفريغ",
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

    // Require a specific store — sync runs per store, not for all stores at once.
    let storeId: string | null = null;
    let rawBody = "";
    try {
      rawBody = await req.text();
      if (rawBody) {
        const body = JSON.parse(rawBody);
        storeId = body?.store_id ?? null;
      }
    } catch (e) {
      console.error("sync-carrier-statuses body parse error", e, "raw=", rawBody);
    }
    if (!storeId) {
      console.warn("sync-carrier-statuses missing store_id, raw body=", rawBody);
      return new Response(JSON.stringify({ error: "store_id مطلوب" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 30-second cooldown per store
    const COOLDOWN_MS = 30 * 1000;
    const { data: storeRow } = await admin
      .from("stores").select("id, owner_id, carrier_last_sync_at")
      .eq("id", storeId).maybeSingle();
    if (!storeRow || storeRow.owner_id !== ownerId) {
      return new Response(JSON.stringify({ error: "متجر غير صالح" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (storeRow.carrier_last_sync_at) {
      const elapsed = Date.now() - new Date(storeRow.carrier_last_sync_at).getTime();
      if (elapsed < COOLDOWN_MS) {
        const remainingSec = Math.ceil((COOLDOWN_MS - elapsed) / 1000);
        return new Response(JSON.stringify({
          error: "cooldown",
          message: `يجب الانتظار ${remainingSec} ثانية قبل إعادة المزامنة لهذا المتجر`,
          remaining_seconds: remainingSec,
        }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    const { data: settingsRows } = await admin
      .from("shipping_settings").select("*").eq("owner_id", ownerId).eq("enabled", true)
      .order("updated_at", { ascending: false }).limit(1);
    const settings = settingsRows?.[0];
    if (!settings || !settings.email || !settings.password) {
      return new Response(JSON.stringify({ error: "إعدادات شركة الشحن غير مكتملة" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: appS } = await admin.from("app_settings").select("shipping_endpoint").maybeSingle();
    const endpoint: string = (appS as any)?.shipping_endpoint || settings.endpoint || "https://turboex.ly:8001/graphql";

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

    // Fetch orders in pages of 1000 (Supabase's per-request cap) so we cover
    // every shipped order, not just the first 1000.
    const PAGE_SIZE = 1000;
    const orders: any[] = [];
    for (let from = 0; ; from += PAGE_SIZE) {
      const { data: page, error: oErr } = await admin
        .from("orders")
        .select("id, shipping_id, shipping_reference, status, carrier_status")
        .eq("owner_id", ownerId)
        .eq("store_id", storeId)
        .not("shipping_id", "is", null)
        // Skip orders already in a terminal carrier state to avoid re-polling them every run.
        .not("status", "in", "(delivered,returned,cancelled,refunded)")
        .order("id", { ascending: true })
        .range(from, from + PAGE_SIZE - 1);
      if (oErr) {
        return new Response(JSON.stringify({ error: oErr.message }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (!page || page.length === 0) break;
      orders.push(...page);
      if (page.length < PAGE_SIZE) break;
    }

    // Mark this store's last sync time (before processing so concurrent calls
    // also respect the cooldown even if processing is long).
    await admin.from("stores")
      .update({ carrier_last_sync_at: new Date().toISOString() })
      .eq("id", storeId);

    // Pre-load global custom mappings (managed by superadmin)
    const { data: mappings } = await admin
      .from("carrier_status_mappings").select("status_code, custom_label");
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

    const processOne = async (o: any) => {
      const shipId = Number(o.shipping_id);
      if (!Number.isFinite(shipId)) return;
      const res = await gql(SHIPMENT_QUERY, { id: shipId });
      const sh = res?.data?.shipment;
      if (!sh) {
        failed++;
        if (res?.errors?.[0]?.message && errors.length < 5) errors.push(res.errors[0].message);
        return;
      }
      const composite = buildComposite(sh.status?.code ?? null, sh.deliveryType?.code, sh.returnType?.code);
      if (!composite) { failed++; return; }

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
      const crName = sh.cancellationReason?.name ?? sh.cancellationReason?.id ?? null;
      if (crName != null && String(crName).trim() !== "") {
        updatePayload.carrier_cancellation_reason_id = String(crName);
      }
      if (sh.notes != null && String(sh.notes).trim() !== "") {
        updatePayload.carrier_notes = String(sh.notes);
      }
      const upper = String(composite).toUpperCase();
      // Auto-transition order.status based on carrier status code:
      //   DTR / DTRC / DTRCP / DTRUC / DTRFD ... (any DTR*) -> delivered
      //   RTRN / RCV -> returned_received
      //   UPKBD / UKDB / UPKBL -> unpacked
      if (upper.startsWith("DTR")) {
        updatePayload.status = "delivered";
      } else if (upper === "UPKBD" || upper === "UKDB" || upper === "UPKBL") {
        updatePayload.status = "unpacked";
      } else if (upper === "RTRN" || upper === "RCV") {
        updatePayload.status = "returned_received";
      }
      const { error: uErr } = await admin.from("orders").update(updatePayload).eq("id", o.id);
      if (uErr) { failed++; if (errors.length < 5) errors.push(uErr.message); return; }
      updated++;

      if (composite === "UPKBD" || composite === "UKDB" || composite === "UPKBL") {
        try {
          await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/apply-order-stock`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
            },
            body: JSON.stringify({ order_id: o.id, reason: "order_unpacked" }),
          });
        } catch (e) { console.error("apply-order-stock UPKBD failed", e); }
      }
    };

    // Process in parallel batches to stay well under the 150s idle timeout.
    const CONCURRENCY = 10;
    for (let i = 0; i < orders.length; i += CONCURRENCY) {
      const batch = orders.slice(i, i + CONCURRENCY);
      await Promise.all(batch.map((o) => processOne(o).catch(() => { failed++; })));
    }

    const codes = Array.from(codeStats.entries())
      .map(([code, v]) => ({ code, count: v.count, label: v.label, mapped: v.mapped }))
      .sort((a, b) => b.count - a.count);

    return new Response(JSON.stringify({
      ok: true,
      total: orders.length,
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