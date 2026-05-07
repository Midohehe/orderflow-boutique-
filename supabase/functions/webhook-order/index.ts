// Public webhook endpoint to receive external orders.
// Supports: generic JSON, and EasyOrders payload (https://public-api-docs.easy-orders.net/docs/webhooks)
// Token can be passed via ?token=, header `x-webhook-token`, or header `secret` (EasyOrders).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-token, secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function s(v: unknown, max = 500): string {
  if (v === null || v === undefined) return "";
  return String(v).trim().slice(0, max);
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
      req.headers.get("secret") ||
      "";

    if (!token || token.length < 10) {
      return new Response(JSON.stringify({ error: "Missing webhook token" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: profile, error: pErr } = await supabase
      .from("profiles")
      .select("user_id, is_active, easyorders_api_key")
      .eq("webhook_token", token)
      .maybeSingle();

    if (pErr || !profile || !profile.is_active) {
      console.error("invalid token", pErr);
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let body: any = await req.json().catch(() => ({}));
    console.log("webhook payload received", JSON.stringify(body).slice(0, 1000));

    // Skip status-change events from EasyOrders (we only want new orders)
    if (body.event_type === "order-status-update") {
      return new Response(JSON.stringify({ ok: true, skipped: "status-update" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // If we have an EasyOrders API key + an order id, fetch full order details from EasyOrders
    const orderId = s(body.id ?? body.order_id, 100);
    const apiKey = (profile as any).easyorders_api_key;
    if (apiKey && orderId) {
      try {
        const r = await fetch(`https://api.easy-orders.net/api/v1/external-apps/orders/${orderId}`, {
          headers: { "Api-Key": apiKey },
        });
        if (r.ok) {
          const fetched = await r.json();
          console.log("fetched full order from EasyOrders", orderId);
          body = { ...body, ...fetched };
        } else {
          console.error("EasyOrders fetch failed", r.status, await r.text());
        }
      } catch (e) {
        console.error("EasyOrders fetch error", e);
      }
    }


    // Map fields from multiple sources (generic + EasyOrders)
    const customer_name = s(body.customer_name ?? body.full_name ?? body.name, 120) || "بدون اسم";
    const phone = s(body.phone ?? body.mobile, 40);
    const address = s(body.address, 500);
    let city = s(body.city ?? body.government ?? body.gov ?? body.governorate ?? body.region ?? body.state, 120);
    if (!city && address) {
      city = address.split(/[,\-\s]+/).filter(Boolean)[0]?.slice(0, 120) || "غير محدد";
    }
    if (!city) city = "غير محدد";
    const total = Number(body.total ?? body.total_cost ?? body.cost ?? body.price ?? 0);

    // Extract products: support cart_items (EasyOrders), products array, or string
    let product_name = "";
    let quantity = 1;
    let matched_product_id: string | null = null;
    let selected_color: string | null = null;
    let selected_size: string | null = null;
    let selected_product_code: string | null = null;

    // Collect EasyOrders product/variant ids from cart_items for mapping
    const eoProductIds: string[] = [];
    const eoVariantIds: string[] = [];

    if (Array.isArray(body.cart_items) && body.cart_items.length > 0) {
      product_name = body.cart_items
        .map((it: any) => it?.product?.name || it?.name || "")
        .filter(Boolean)
        .join(", ")
        .slice(0, 500);
      quantity = body.cart_items.reduce((sum: number, it: any) => sum + (Number(it?.quantity) || 1), 0);
      for (const it of body.cart_items) {
        const pid = it?.product?.id ?? it?.product_id;
        const vid = it?.variant?.id ?? it?.variant_id;
        if (pid) eoProductIds.push(String(pid));
        if (vid) eoVariantIds.push(String(vid));
        const props = it?.variant?.variation_props;
        if (Array.isArray(props)) {
          for (const p of props) {
            if (p?.variation === "color" && !selected_color) selected_color = s(p.variation_prop, 100);
            if (p?.variation === "size" && !selected_size) selected_size = s(p.variation_prop, 100);
          }
        }
      }
    } else if (Array.isArray(body.products)) {
      product_name = body.products
        .map((p: any) => (typeof p === "string" ? p : p?.name || ""))
        .filter(Boolean)
        .join(", ")
        .slice(0, 500);
      quantity = Math.max(1, Math.min(999, Math.floor(Number(body.quantity ?? 1))));
    } else {
      product_name = s(body.products ?? body.product_name ?? "", 500);
      quantity = Math.max(1, Math.min(999, Math.floor(Number(body.quantity ?? 1))));
    }

    // Map EasyOrders product → local product (and variant key) using owner's mappings
    if (eoProductIds.length > 0) {
      const { data: localProds } = await supabase
        .from("products")
        .select("id, easyorders_product_id, variant_easyorders_ids, colors, sizes, product_codes")
        .eq("owner_id", profile.user_id)
        .in("easyorders_product_id", eoProductIds);
      if (localProds && localProds.length > 0) {
        const lp = localProds[0] as any;
        matched_product_id = lp.id;
        // Find variant key whose mapped EO id matches one of the cart variant ids
        const map = (lp.variant_easyorders_ids || {}) as Record<string, string>;
        for (const [variantKey, eoId] of Object.entries(map)) {
          if (eoVariantIds.includes(String(eoId))) {
            // Parse variantKey like "أحمر - L" or "أحمر" or "L" or "SKU-001"
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
      }
    }

    if (!phone || !address || !city) {
      console.error("missing required fields", { phone, address, city });
      return new Response(JSON.stringify({
        error: "Missing required fields",
        required: ["phone", "address", "city/government"],
        received: { phone: !!phone, address: !!address, city: !!city },
      }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Auto-correct city using owner's corrections list / shipping zones
    let matched_zone_name: string | null = null;
    let matched_area_name: string | null = null;
    let matched_zone_id: number | null = null;
    let matched_area_id: number | null = null;
    try {
      const mr = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/match-city`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}` },
        body: JSON.stringify({ city, address, owner_id: profile.user_id }),
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
      owner_id: profile.user_id,
      customer_name,
      phone,
      address,
      city,
      product_name: product_name || "طلب عبر Webhook",
      price: isNaN(total) ? 0 : total,
      quantity: Math.max(1, Math.min(999, quantity)),
      status: "pending",
      product_id: matched_product_id,
      selected_color,
      selected_size,
      selected_product_code,
      matched_zone_id,
      matched_area_id,
      matched_zone_name,
      matched_area_name,
    }).select("id").single();

    if (iErr) {
      console.error("webhook order insert failed", iErr);
      return new Response(JSON.stringify({ error: "Could not create order", details: iErr.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("webhook order created", order.id);
    return new Response(JSON.stringify({ ok: true, order_id: order.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("webhook error", e);
    return new Response(JSON.stringify({ error: "Bad request", details: String(e) }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
