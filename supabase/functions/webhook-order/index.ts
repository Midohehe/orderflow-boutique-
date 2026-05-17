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

// Normalize Arabic text to make matching robust (diacritics, alef variants, ta marbuta, etc.)
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
  // 1) exact normalized match
  for (const x of list) if (norm(x) === n) return x;
  // 2) token match — local value appears as a standalone token within EO value
  //    e.g. local "L" matches EO "L تلبيس من 55 الي 75 كيلو"
  const tokens = n.split(/[\s\-_/،,]+/).filter(Boolean);
  for (const x of list) {
    const xn = norm(x);
    if (!xn) continue;
    if (tokens.includes(xn)) return x;
  }
  // 3) prefix match (EO starts with local + space)
  for (const x of list) {
    const xn = norm(x);
    if (xn && (n === xn || n.startsWith(xn + " "))) return x;
  }
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

    // Detailed line items for the new order_items table (one row per cart line)
    type LineItem = {
      product_id: string | null;
      product_name: string;
      selected_color: string | null;
      selected_size: string | null;
      selected_product_code: string | null;
      warehouse_code: string | null;
      easyorders_product_id: string | null;
      easyorders_variant_id: string | null;
      easyorders_sku: string | null;
      quantity: number;
      price: number;
    };
    const lineItems: LineItem[] = [];

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
        const vsku = it?.variant?.taager_code ?? it?.variant?.sku ?? it?.sku ?? null;
        if (pid) eoProductIds.push(String(pid));
        if (vid) eoVariantIds.push(String(vid));
        const props = it?.variant?.variation_props;
        if (Array.isArray(props)) {
          for (const p of props) {
            if (p?.variation === "color" && !selected_color) selected_color = s(p.variation_prop, 100);
            if (p?.variation === "size" && !selected_size) selected_size = s(p.variation_prop, 100);
          }
        }
        // Build the per-line snapshot (resolved later against local products)
        let lineColor: string | null = null;
        let lineSize: string | null = null;
        if (Array.isArray(props)) {
          for (const p of props) {
            if (p?.variation === "color") lineColor = s(p.variation_prop, 100);
            if (p?.variation === "size") lineSize = s(p.variation_prop, 100);
          }
        }
        const linePrice = Number(it?.price ?? it?.unit_price ?? it?.product?.price ?? 0) || 0;
        const lineQty = Math.max(1, Math.min(999, Math.floor(Number(it?.quantity ?? 1))));
        lineItems.push({
          product_id: null,
          product_name: s(it?.product?.name || it?.name || "", 250),
          selected_color: lineColor,
          selected_size: lineSize,
          selected_product_code: null,
          warehouse_code: null,
          easyorders_product_id: pid ? String(pid) : null,
          easyorders_variant_id: vid ? String(vid) : null,
          easyorders_sku: vsku ? String(vsku) : null,
          quantity: lineQty,
          price: linePrice,
        });
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
        .select("id, easyorders_product_id, variant_easyorders_ids, colors, sizes, product_codes, variant_warehouse_codes")
        .eq("owner_id", profile.user_id)
        .in("easyorders_product_id", eoProductIds);
      // Load synced EO products to normalize stale cart variant IDs
      const { data: eoProds } = await supabase
        .from("easyorders_products")
        .select("external_id, variants")
        .eq("owner_id", profile.user_id)
        .in("external_id", eoProductIds);
      const eoByExtSync = new Map<string, any>();
      for (const ep of (eoProds || []) as any[]) eoByExtSync.set(String(ep.external_id), ep);
      // PRIMARY normalization: resolve canonical EO variant_id by SKU when possible.
      // EasyOrders returns different variant IDs in /orders vs /products for the same SKU,
      // so SKU is the only reliable cross-endpoint identifier.
      for (const li of lineItems) {
        if (!li.easyorders_product_id) continue;
        const ep = eoByExtSync.get(li.easyorders_product_id);
        if (!ep || !Array.isArray(ep.variants)) continue;
        let canonical: any = null;
        // 1) Match by SKU (most reliable, cross-endpoint stable)
        if (li.easyorders_sku) {
          canonical = ep.variants.find((v: any) => String(v.sku ?? "") === String(li.easyorders_sku));
        }
        // 2) Match by variation_props if SKU missing
        if (!canonical && li.easyorders_variant_id) {
          let cartVariant: any = null;
          if (Array.isArray(body.cart_items)) {
            for (const ci of body.cart_items) {
              const v = ci?.variant;
              if (v && String(v.id) === li.easyorders_variant_id) { cartVariant = v; break; }
            }
          }
          const cartProps: any[] = Array.isArray(cartVariant?.variation_props) ? cartVariant.variation_props : [];
          const cartPropSet = new Set(cartProps.map((p: any) => norm(p?.variation_prop)));
          if (cartPropSet.size > 0) {
            canonical = ep.variants.find((v: any) => {
              const vp = Array.isArray(v.variation_props) ? v.variation_props : [];
              if (vp.length !== cartPropSet.size) return false;
              return vp.every((p: any) => cartPropSet.has(norm(p?.variation_prop)));
            });
          }
        }
        if (canonical?.id) {
          if (li.easyorders_variant_id !== String(canonical.id)) {
            console.log("normalized EO variant via SKU", li.easyorders_sku, li.easyorders_variant_id, "->", canonical.id);
          }
          li.easyorders_variant_id = String(canonical.id);
          if (!li.easyorders_sku && canonical.sku) li.easyorders_sku = String(canonical.sku);
        }
      }
      eoVariantIds.length = 0;
      for (const li of lineItems) if (li.easyorders_variant_id) eoVariantIds.push(li.easyorders_variant_id);
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

        // Resolve each line item against the matched local products
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
          let matchedVariantKey: string | null = null;

          // PRIMARY: lookup EO variant_id in user-managed mapping table (set in ProductForm)
          if (li.easyorders_variant_id) {
            for (const [variantKey, eoId] of Object.entries(map2)) {
              if (String(eoId) === li.easyorders_variant_id) {
                matchedVariantKey = variantKey;
                const parts = variantKey.split(" - ").map((x) => x.trim());
                const colors = (lp2.colors || []) as string[];
                const sizes = (lp2.sizes || []) as string[];
                const codes = (lp2.product_codes || []) as string[];
                li.selected_color = null;
                li.selected_size = null;
                for (const part of parts) {
                  if (colors.includes(part)) li.selected_color = part;
                  else if (sizes.includes(part)) li.selected_size = part;
                  else if (codes.includes(part)) li.selected_product_code = part;
                }
                break;
              }
            }
          }

          // FALLBACK: name-based match only if mapping doesn't contain this EO variant id
          if (!matchedVariantKey) {
            const colorMatch = findByName(lp2.colors, li.selected_color);
            const sizeMatch = findByName(lp2.sizes, li.selected_size);
            if (colorMatch) li.selected_color = colorMatch;
            if (sizeMatch) li.selected_size = sizeMatch;
            const keyCandidates = [
              [li.selected_color, li.selected_size].filter(Boolean).join(" - "),
              li.selected_color || "",
              li.selected_size || "",
              li.selected_product_code || "",
            ].filter(Boolean) as string[];
            for (const k of keyCandidates) {
              if (whMap[k] || map2[k]) { matchedVariantKey = k; break; }
            }
          }

          if (matchedVariantKey && whMap[matchedVariantKey]) {
            li.warehouse_code = String(whMap[matchedVariantKey]);
          }
        }
        // Self-heal: update variant_easyorders_ids for products whose name-matched key
        // resolved a fresh EO variant id different from the stored one.
        const updates = new Map<string, Record<string, string>>();
        for (const li of lineItems) {
          if (!li.product_id || !li.easyorders_variant_id) continue;
          const lp2 = byEoId.get(li.easyorders_product_id || "");
          if (!lp2) continue;
          const key = [li.selected_color, li.selected_size].filter(Boolean).join(" - ")
            || li.selected_color || li.selected_size || li.selected_product_code || "";
          if (!key) continue;
          const map2 = (lp2.variant_easyorders_ids || {}) as Record<string, string>;
          if (map2[key] === li.easyorders_variant_id) continue;
          const merged = updates.get(lp2.id) || { ...map2 };
          merged[key] = li.easyorders_variant_id;
          updates.set(lp2.id, merged);
        }
        for (const [pid, merged] of updates.entries()) {
          await supabase.from("products").update({ variant_easyorders_ids: merged }).eq("id", pid);
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

    // Build link error message describing what auto-linking failed (product/variant)
    const linkErrors: string[] = [];
    for (const li of lineItems) {
      const name = li.product_name || "منتج";
      if (!li.product_id) {
        linkErrors.push(`المنتج "${name}" (EO: ${li.easyorders_product_id || "—"}) غير مرتبط بأي منتج محلي`);
      } else if (li.easyorders_variant_id && !li.warehouse_code) {
        linkErrors.push(`متغير المنتج "${name}" (متغير EO: ${li.easyorders_variant_id}) غير مرتبط بمتغير محلي. أعد مزامنة المنتجات.`);
      }
    }
    const link_error = linkErrors.length > 0 ? linkErrors.join(" | ") : null;

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

    // Resolve store_id: prefer matched product's store, else owner's default store.
    let order_store_id: string | null = null;
    try {
      if (matched_product_id) {
        const { data: mp } = await supabase
          .from("products").select("store_id").eq("id", matched_product_id).maybeSingle();
        order_store_id = (mp as any)?.store_id ?? null;
      }
      if (!order_store_id) {
        const { data: ds } = await supabase
          .from("stores").select("id")
          .eq("owner_id", profile.user_id).eq("is_default", true).maybeSingle();
        order_store_id = (ds as any)?.id ?? null;
      }
    } catch (e) { console.error("store resolve failed", e); }

    const { data: order, error: iErr } = await supabase.from("orders").insert({
      owner_id: profile.user_id,
      store_id: order_store_id,
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
      link_error,
    }).select("id").single();

    if (iErr) {
      console.error("webhook order insert failed", iErr);
      return new Response(JSON.stringify({ error: "Could not create order", details: iErr.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Insert order_items rows (one per cart line). Keep going on error.
    if (lineItems.length > 0) {
      const rows = lineItems.map((li) => ({
        order_id: order.id,
        owner_id: profile.user_id,
        store_id: order_store_id,
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

    // Record stock movement (decrement)
    try {
      await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/apply-order-stock`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        },
        body: JSON.stringify({ order_id: order.id, reason: "order_created" }),
      });
    } catch (e) { console.error("apply-order-stock failed", e); }

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
