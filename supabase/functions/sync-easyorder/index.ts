// Manually sync a single order from EasyOrders by order_id
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function s(v: unknown, max = 500): string {
  if (v === null || v === undefined) return "";
  return String(v).trim().slice(0, max);
}

function norm(v: unknown): string {
  return String(v ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\u064B-\u0652\u0670]/g, "")
    .replace(/[\u0623\u0625\u0622]/g, "\u0627")
    .replace(/\u0649/g, "\u064A")
    .replace(/\u0624/g, "\u0648")
    .replace(/\u0626/g, "\u064A")
    .replace(/\u0629/g, "\u0647")
    .replace(/\s+/g, " ");
}

function findByName(list: string[] | null | undefined, value: string | null): string | null {
  if (!value || !list || list.length === 0) return null;
  const n = norm(value);
  for (const x of list) if (norm(x) === n) return x;
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Validate user via JWT
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData, error: uErr } = await userClient.auth.getUser();
    if (uErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Invalid auth" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = userData.user.id;

    const body = await req.json().catch(() => ({}));
    const orderId = s(body.order_id, 100);
    if (!orderId) {
      return new Response(JSON.stringify({ error: "order_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("user_id, easyorders_api_key")
      .eq("user_id", userId)
      .maybeSingle();

    const apiKey = (profile as any)?.easyorders_api_key;
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "EasyOrders API key not configured" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const r = await fetch(`https://api.easy-orders.net/api/v1/external-apps/orders/${orderId}`, {
      headers: { "Api-Key": apiKey },
    });
    const responseText = await r.text();
    if (!r.ok) {
      console.error("EasyOrders API error", r.status, responseText);
      return new Response(JSON.stringify({ error: "EasyOrders API error", status: r.status, details: responseText }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = JSON.parse(responseText);
    console.log("fetched order", orderId);

    const customer_name = s(data.full_name ?? data.name, 120) || "بدون اسم";
    const phone = s(data.phone, 40);
    const address = s(data.address, 500);
    let city = s(data.government ?? data.city ?? data.governorate ?? data.region ?? data.state, 120);
    if (!city && address) {
      city = address.split(/[,\-\s]+/).filter(Boolean)[0]?.slice(0, 120) || "غير محدد";
    }
    if (!city) city = "غير محدد";
    const total = Number(data.total_cost ?? data.cost ?? 0);

    let product_name = "";
    let quantity = 1;
    let selected_color: string | null = null;
    let selected_size: string | null = null;
    let selected_product_code: string | null = null;
    let matched_product_id: string | null = null;
    const eoProductIds: string[] = [];
    const eoVariantIds: string[] = [];

    type LineItem = {
      product_id: string | null;
      product_name: string;
      selected_color: string | null;
      selected_size: string | null;
      selected_product_code: string | null;
      warehouse_code: string | null;
      easyorders_product_id: string | null;
      easyorders_variant_id: string | null;
      quantity: number;
      price: number;
    };
    const lineItems: LineItem[] = [];

    if (Array.isArray(data.cart_items) && data.cart_items.length > 0) {
      product_name = data.cart_items
        .map((it: any) => it?.product?.name || "")
        .filter(Boolean).join(", ").slice(0, 500);
      quantity = data.cart_items.reduce((sum: number, it: any) => sum + (Number(it?.quantity) || 1), 0);
      for (const it of data.cart_items) {
        const pid = it?.product?.id ?? it?.product_id;
        const vid = it?.variant?.id ?? it?.variant_id;
        if (pid) eoProductIds.push(String(pid));
        if (vid) eoVariantIds.push(String(vid));
        const props = it?.variant?.variation_props;
        let lineColor: string | null = null;
        let lineSize: string | null = null;
        if (Array.isArray(props)) {
          for (const p of props) {
            if (p?.variation === "color" && !selected_color) selected_color = s(p.variation_prop, 100);
            if (p?.variation === "size" && !selected_size) selected_size = s(p.variation_prop, 100);
            if (p?.variation === "color") lineColor = s(p.variation_prop, 100);
            if (p?.variation === "size") lineSize = s(p.variation_prop, 100);
          }
        }
        const linePrice = Number(it?.price ?? it?.unit_price ?? it?.product?.price ?? 0) || 0;
        const lineQty = Math.max(1, Math.min(999, Math.floor(Number(it?.quantity ?? 1))));
        lineItems.push({
          product_id: null,
          product_name: s(it?.product?.name || "", 250),
          selected_color: lineColor,
          selected_size: lineSize,
          selected_product_code: null,
          warehouse_code: null,
          easyorders_product_id: pid ? String(pid) : null,
          easyorders_variant_id: vid ? String(vid) : null,
          quantity: lineQty,
          price: linePrice,
        });
      }
    }

    if (eoProductIds.length > 0) {
      const { data: localProds } = await supabase
        .from("products")
        .select("id, easyorders_product_id, variant_easyorders_ids, colors, sizes, product_codes, variant_warehouse_codes")
        .eq("owner_id", userId)
        .in("easyorders_product_id", eoProductIds);
      if (localProds && localProds.length > 0) {
        const lp = localProds[0] as any;
        matched_product_id = lp.id;
        const map = (lp.variant_easyorders_ids || {}) as Record<string, string>;
        for (const [variantKey, eoId] of Object.entries(map)) {
          if (eoVariantIds.includes(String(eoId))) {
            const parts = variantKey.split(" - ").map((x) => x.trim());
            const colors = (lp.colors || []) as string[];
            const sizes = (lp.sizes || []) as string[];
            const codes = (lp.product_codes || []) as string[];
            for (const part of parts) {
              if (colors.includes(part)) selected_color = part;
              else if (sizes.includes(part)) selected_size = part;
              else if (codes.includes(part)) selected_product_code = part;
            }
            break;
          }
        }

        const byEoId = new Map<string, any>();
        for (const lp2 of localProds as any[]) {
          if (lp2.easyorders_product_id) byEoId.set(String(lp2.easyorders_product_id), lp2);
        }
        for (const li of lineItems) {
          if (!li.easyorders_product_id) continue;
          const lp2 = byEoId.get(li.easyorders_product_id);
          if (!lp2) continue;
          li.product_id = lp2.id;
          const map2 = (lp2.variant_easyorders_ids || {}) as Record<string, string>;
          const whMap = (lp2.variant_warehouse_codes || {}) as Record<string, string>;
          if (li.easyorders_variant_id) {
            for (const [variantKey, eoId] of Object.entries(map2)) {
              if (String(eoId) === li.easyorders_variant_id) {
                const parts = variantKey.split(" - ").map((x) => x.trim());
                const colors = (lp2.colors || []) as string[];
                const sizes = (lp2.sizes || []) as string[];
                const codes = (lp2.product_codes || []) as string[];
                for (const part of parts) {
                  if (colors.includes(part)) li.selected_color = part;
                  else if (sizes.includes(part)) li.selected_size = part;
                  else if (codes.includes(part)) li.selected_product_code = part;
                }
                if (whMap[variantKey]) li.warehouse_code = String(whMap[variantKey]);
                break;
              }
            }
          }
        }
      }
    }

    if (!phone || !address || !city) {
      return new Response(JSON.stringify({
        error: "Order missing required fields",
        received: { phone: !!phone, address: !!address, city: !!city },
        raw: data,
      }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let matched_zone_name: string | null = null;
    let matched_area_name: string | null = null;
    let matched_zone_id: number | null = null;
    let matched_area_id: number | null = null;
    try {
      const mr = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/match-city`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}` },
        body: JSON.stringify({ city, address, owner_id: userId }),
      });
      if (mr.ok) {
        const m = await mr.json();
        matched_zone_id = m.zone_id ?? null;
        matched_area_id = m.area_id ?? null;
        matched_zone_name = m.zone_name ?? null;
        matched_area_name = m.area_name ?? null;
      }
    } catch (e) { console.error("match-city failed", e); }

    const { data: order, error: iErr } = await supabase.from("orders").insert({
      owner_id: userId,
      customer_name, phone, address, city,
      product_name: product_name || "طلب من EasyOrders",
      price: isNaN(total) ? 0 : total,
      quantity: Math.max(1, Math.min(999, quantity)),
      status: "pending",
      product_id: matched_product_id,
      selected_color, selected_size, selected_product_code,
      matched_zone_id, matched_area_id, matched_zone_name, matched_area_name,
    }).select("id").single();

    if (iErr) {
      return new Response(JSON.stringify({ error: "Insert failed", details: iErr.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (lineItems.length > 0) {
      const rows = lineItems.map((li) => ({
        order_id: order.id,
        owner_id: userId,
        product_id: li.product_id,
        product_name: li.product_name || product_name || "—",
        selected_color: li.selected_color,
        selected_size: li.selected_size,
        selected_product_code: li.selected_product_code,
        warehouse_code: li.warehouse_code,
        easyorders_product_id: li.easyorders_product_id,
        easyorders_variant_id: li.easyorders_variant_id,
        quantity: li.quantity,
        price: li.price,
      }));
      const { error: itErr } = await supabase.from("order_items").insert(rows);
      if (itErr) console.error("order_items insert failed", itErr);
    }

    return new Response(JSON.stringify({ ok: true, order_id: order.id, fetched: data }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("sync-easyorder error", e);
    return new Response(JSON.stringify({ error: "Bad request", details: String(e) }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
