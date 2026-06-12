// Loads the shipment entries of a specific settlement (payment) from Turbo
// financial endpoint and links each shipment to a local order via refNumber.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const FINANCIAL_ENDPOINT = "https://turboex.ly:8443/graphql";

interface Body { settlement_id: string }

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
    const uid = userData.user.id;

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: ownerData } = await admin.rpc("get_effective_owner_id", { _uid: uid });
    const ownerId = (ownerData as string) || uid;

    const body = (await req.json()) as Body;
    if (!body.settlement_id) {
      return new Response(JSON.stringify({ error: "settlement_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: settlement } = await admin
      .from("settlements")
      .select("id, owner_id, external_id, store_id")
      .eq("id", body.settlement_id)
      .maybeSingle();
    if (!settlement) {
      return new Response(JSON.stringify({ error: "Not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: isMember } = await admin.rpc("is_member_of", { _owner_id: settlement.owner_id });
    const { data: isAdmin } = await admin.rpc("has_role", { _user_id: uid, _role: "admin" });
    if (!isMember && !isAdmin && settlement.owner_id !== ownerId) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let settingsQuery = admin
      .from("shipping_settings")
      .select("*")
      .eq("owner_id", settlement.owner_id)
      .eq("enabled", true)
      .order("updated_at", { ascending: false })
      .limit(1);
    if (settlement.store_id) {
      settingsQuery = settingsQuery.eq("store_id", settlement.store_id);
    }
    const { data: settingsRows } = await settingsQuery;
    const settings = settingsRows?.[0];
    if (!settings) {
      return new Response(JSON.stringify({ error: "إعدادات شركة الشحن غير مكتملة" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const loginRes = await fetch(FINANCIAL_ENDPOINT, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: `mutation Login($input: LoginInput!) { login(input: $input) { token } }`,
        variables: { input: { username: settings.email, password: settings.password, rememberMe: true } },
      }),
    });
    const loginJson = await loginRes.json().catch(() => ({}));
    const token: string | undefined = loginJson?.data?.login?.token;
    if (!token) {
      return new Response(JSON.stringify({ error: "فشل تسجيل الدخول" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const gql = async (query: string, variables: Record<string, unknown> = {}) => {
      const r = await fetch(FINANCIAL_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ query, variables }),
      });
      return await r.json().catch(() => ({}));
    };

    const QUERY = `query ($id: Int!, $first: Int!, $page: Int) {
      payment(id: $id) {
        entries(typeCode: SHIPMENT, first: $first, page: $page) {
          paginatorInfo { hasMorePages currentPage }
          data {
            paidAmount
            shipment {
              id code refNumber notes
              date deliveredOrReturnedDate
              recipientName recipientPhone recipientMobile
              recipientZone { name }
              recipientSubzone { name }
              status { code name }
              weight piecesCount deliveredAmount collectedFees
            }
          }
        }
      }
    }`;

    const allEntries: any[] = [];
    let page = 1;
    let lastRes: any = null;
    while (true) {
      const res = await gql(QUERY, { id: settlement.external_id, first: 100, page });
      lastRes = res;
      console.log("page", page, "resp", JSON.stringify(res).slice(0, 1500));
      const ents = res?.data?.payment?.entries;
      if (!ents) break;
      allEntries.push(...(ents.data || []));
      if (!ents.paginatorInfo?.hasMorePages) break;
      page += 1;
      if (page > 50) break;
    }

    // Try linking shipments to orders by ref_number / shipping_reference / shipping_id
    const refs = Array.from(new Set(allEntries
      .map((e) => e.shipment?.refNumber).filter(Boolean).map(String)));
    const codes = Array.from(new Set(allEntries
      .map((e) => e.shipment?.code).filter(Boolean).map(String)));

    const orderIdByRef = new Map<string, string>();
    if (refs.length) {
      const { data: ordersByRef } = await admin
        .from("orders").select("id, shipping_reference, shipping_id")
        .eq("owner_id", settlement.owner_id)
        .or(`shipping_reference.in.(${refs.map((r) => `"${r}"`).join(",")}),shipping_id.in.(${refs.map((r) => `"${r}"`).join(",")})`);
      for (const o of ordersByRef || []) {
        if (o.shipping_reference) orderIdByRef.set(String(o.shipping_reference), o.id);
        if (o.shipping_id) orderIdByRef.set(String(o.shipping_id), o.id);
      }
    }
    if (codes.length) {
      const { data: ordersByCode } = await admin
        .from("orders").select("id, shipping_reference, shipping_id")
        .eq("owner_id", settlement.owner_id)
        .or(`shipping_id.in.(${codes.map((c) => `"${c}"`).join(",")}),shipping_reference.in.(${codes.map((c) => `"${c}"`).join(",")})`);
      for (const o of ordersByCode || []) {
        if (o.shipping_id) orderIdByRef.set(String(o.shipping_id), o.id);
        if (o.shipping_reference) orderIdByRef.set(String(o.shipping_reference), o.id);
      }
    }
    // Also direct refNumber may equal order.id prefix (12 chars uppercase)
    if (refs.length) {
      const { data: allOrders } = await admin
        .from("orders").select("id").eq("owner_id", settlement.owner_id);
      const byPrefix = new Map<string, string>();
      for (const o of allOrders || []) {
        byPrefix.set(o.id.slice(0, 12).toUpperCase(), o.id);
      }
      for (const r of refs) {
        if (!orderIdByRef.has(r)) {
          const id = byPrefix.get(r.toUpperCase());
          if (id) orderIdByRef.set(r, id);
        }
      }
    }

    const shipmentRows = allEntries.map((e) => {
      const s = e.shipment || {};
      const orderId = (s.refNumber && orderIdByRef.get(String(s.refNumber)))
        || (s.code && orderIdByRef.get(String(s.code)))
        || null;
      return {
        owner_id: settlement.owner_id,
        settlement_id: settlement.id,
        external_shipment_id: s.id ?? null,
        shipment_code: String(s.code ?? ""),
        ref_number: s.refNumber ?? null,
        recipient_name: s.recipientName ?? null,
        recipient_phone: s.recipientPhone || s.recipientMobile || null,
        zone_name: s.recipientZone?.name ?? null,
        area_name: s.recipientSubzone?.name ?? null,
        status_code: s.status?.code ?? null,
        status_name: s.status?.name ?? null,
        delivered_amount: Number(s.deliveredAmount ?? 0),
        collected_fees: Number(s.collectedFees ?? 0),
        paid_amount: Number(e.paidAmount ?? 0),
        pieces_count: Number(s.piecesCount ?? 0),
        weight: Number(s.weight ?? 0),
        shipment_date: s.date ? new Date(s.date.replace(" ", "T") + "Z").toISOString() : null,
        delivered_or_returned_date: s.deliveredOrReturnedDate
          ? new Date(s.deliveredOrReturnedDate.replace(" ", "T") + "Z").toISOString() : null,
        order_id: orderId,
        raw: e,
      };
    }).filter((r) => r.shipment_code);

    // Replace existing rows for this settlement
    await admin.from("settlement_shipments").delete().eq("settlement_id", settlement.id);
    if (shipmentRows.length) {
      const { error: insErr } = await admin.from("settlement_shipments").insert(shipmentRows);
      if (insErr) {
        return new Response(JSON.stringify({ error: insErr.message }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    await admin.from("settlements")
      .update({ shipments_synced_at: new Date().toISOString() })
      .eq("id", settlement.id);

    return new Response(JSON.stringify({
      ok: true, count: shipmentRows.length,
      linked: shipmentRows.filter((r) => r.order_id).length,
      debug: lastRes?.errors ?? null,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});