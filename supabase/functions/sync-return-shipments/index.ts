// Loads shipment entries of a specific return (RTRN payment) and links them
// to local orders via refNumber / shipping_id.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const FINANCIAL_ENDPOINT = "https://turboex.ly:8443/graphql";

interface Body { return_id: string }

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

    const body = (await req.json()) as Body;
    if (!body.return_id) {
      return new Response(JSON.stringify({ error: "return_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: returnRow } = await admin
      .from("returns").select("id, owner_id, external_id, store_id")
      .eq("id", body.return_id).maybeSingle();
    if (!returnRow || returnRow.owner_id !== ownerId) {
      return new Response(JSON.stringify({ error: "Not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: settingsRows } = await admin
      .from("shipping_settings").select("*")
      .eq("owner_id", ownerId).eq("enabled", true)
      .order("updated_at", { ascending: false }).limit(1);
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
      const res = await gql(QUERY, { id: returnRow.external_id, first: 100, page });
      lastRes = res;
      const ents = res?.data?.payment?.entries;
      if (!ents) break;
      allEntries.push(...(ents.data || []));
      if (!ents.paginatorInfo?.hasMorePages) break;
      page += 1;
      if (page > 50) break;
    }

    const refs = Array.from(new Set(allEntries
      .map((e) => e.shipment?.refNumber).filter(Boolean).map(String)));
    const codes = Array.from(new Set(allEntries
      .map((e) => e.shipment?.code).filter(Boolean).map(String)));

    const orderIdByRef = new Map<string, string>();
    if (refs.length) {
      const { data: ordersByRef } = await admin
        .from("orders").select("id, shipping_reference, shipping_id")
        .eq("owner_id", ownerId)
        .or(`shipping_reference.in.(${refs.map((r) => `"${r}"`).join(",")}),shipping_id.in.(${refs.map((r) => `"${r}"`).join(",")})`);
      for (const o of ordersByRef || []) {
        if (o.shipping_reference) orderIdByRef.set(String(o.shipping_reference), o.id);
        if (o.shipping_id) orderIdByRef.set(String(o.shipping_id), o.id);
      }
    }
    if (codes.length) {
      const { data: ordersByCode } = await admin
        .from("orders").select("id, shipping_reference, shipping_id")
        .eq("owner_id", ownerId)
        .or(`shipping_id.in.(${codes.map((c) => `"${c}"`).join(",")}),shipping_reference.in.(${codes.map((c) => `"${c}"`).join(",")})`);
      for (const o of ordersByCode || []) {
        if (o.shipping_id) orderIdByRef.set(String(o.shipping_id), o.id);
        if (o.shipping_reference) orderIdByRef.set(String(o.shipping_reference), o.id);
      }
    }
    if (refs.length) {
      const { data: allOrders } = await admin
        .from("orders").select("id").eq("owner_id", ownerId);
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

    // Keep only returned shipments (status code containing RTRN/RETURN, or
    // status name in Arabic indicating a return). This is what makes a
    // "returns receipt" different from a regular settlement.
    const isReturned = (s: any) => {
      const code = String(s?.status?.code || "").toUpperCase();
      const name = String(s?.status?.name || "");
      return /RTRN|RETURN|RETN/.test(code) || /مرتجع|راجع|إرجاع|ارجاع/.test(name);
    };
    const returnedEntries = allEntries.filter((e) => isReturned(e.shipment));
    const shipmentRows = returnedEntries.map((e) => {
      const s = e.shipment || {};
      const orderId = (s.refNumber && orderIdByRef.get(String(s.refNumber)))
        || (s.code && orderIdByRef.get(String(s.code)))
        || null;
      return {
        owner_id: ownerId,
        store_id: returnRow.store_id ?? null,
        return_id: returnRow.id,
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

    await admin.from("return_shipments").delete().eq("return_id", returnRow.id);
    if (shipmentRows.length) {
      const { error: insErr } = await admin.from("return_shipments").insert(shipmentRows);
      if (insErr) {
        return new Response(JSON.stringify({ error: insErr.message }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    await admin.from("returns")
      .update({ shipments_synced_at: new Date().toISOString() })
      .eq("id", returnRow.id);

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