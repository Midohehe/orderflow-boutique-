// Sync products from EasyOrders into local easyorders_products table.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData } = await userClient.auth.getUser();
    if (!userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: profile } = await admin
      .from("profiles")
      .select("easyorders_api_key")
      .eq("user_id", userData.user.id)
      .maybeSingle();

    const apiKey = (profile as any)?.easyorders_api_key;
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "EasyOrders API key not configured" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Paginate through /products?join=variants
    let page = 1;
    const limit = 100;
    let total = 0;
    const allRows: any[] = [];
    while (page <= 50) {
      const url = `https://api.easy-orders.net/api/v1/external-apps/products?join=variants&limit=${limit}&page=${page}`;
      const r = await fetch(url, { headers: { "Api-Key": apiKey } });
      const txt = await r.text();
      if (!r.ok) {
        return new Response(JSON.stringify({
          error: "EasyOrders API error",
          status: r.status,
          details: txt,
          hint: r.status === 403 ? "تأكد من إضافة صلاحية products:read للمفتاح" : undefined,
        }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      let json: any;
      try { json = JSON.parse(txt); } catch { json = []; }
      const items: any[] = Array.isArray(json) ? json : (json.data || json.items || []);
      if (items.length === 0) break;
      for (const p of items) {
        const externalId = String(p.id ?? p._id ?? "");
        if (!externalId) continue;

        // Fetch full product details to get variation_props (list endpoint omits them)
        let full: any = p;
        try {
          const dr = await fetch(
            `https://api.easy-orders.net/api/v1/external-apps/products/${externalId}`,
            { headers: { "Api-Key": apiKey } },
          );
          if (dr.ok) full = await dr.json();
        } catch (e) { console.error("fetch product detail failed", externalId, e); }

        const variants = Array.isArray(full.variants) ? full.variants.map((v: any) => {
          const props = v.variation_props ?? v.variationProps ?? null;
          const propsLabel = Array.isArray(props) && props.length
            ? props.map((pp: any) => pp?.variation_prop ?? pp?.value ?? "").filter(Boolean).join(" / ")
            : null;
          const sku = v.taager_code ?? v.sku ?? v.SKU ?? null;
          return {
            id: String(v.id ?? v._id ?? ""),
            sku,
            name: sku ?? propsLabel ?? v.name ?? null,
            variation_props: props,
          };
        }).filter((v: any) => v.id) : [];

        allRows.push({
          owner_id: userData.user.id,
          external_id: externalId,
          name: full.name ?? p.name ?? null,
          sku: full.taager_code ?? full.sku ?? p.sku ?? null,
          variants,
          raw: full,
          synced_at: new Date().toISOString(),
        });
      }
      total += items.length;
      if (items.length < limit) break;
      page++;
    }

    if (allRows.length > 0) {
      const { error: upErr } = await admin
        .from("easyorders_products")
        .upsert(allRows, { onConflict: "owner_id,external_id" });
      if (upErr) {
        return new Response(JSON.stringify({ error: "DB upsert failed", details: upErr.message }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    return new Response(JSON.stringify({ ok: true, count: total }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("sync-easyorders-products error", e);
    return new Response(JSON.stringify({ error: "Bad request", details: String(e) }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
