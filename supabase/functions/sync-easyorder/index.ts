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
  const tokens = n.split(/[\s\-_/،,]+/).filter(Boolean);
  for (const x of list) {
    const xn = norm(x);
    if (xn && tokens.includes(xn)) return x;
  }
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
      easyorders_sku: string | null;
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
        const vsku = it?.variant?.taager_code ?? it?.variant?.sku ?? it?.sku ?? null;
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
          easyorders_sku: vsku ? String(vsku) : null,
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
      // Also load synced EO products to resolve "stale" variant IDs returned by orders endpoint
      const { data: eoProds } = await supabase
        .from("easyorders_products")
        .select("external_id, variants")
        .eq("owner_id", userId)
        .in("external_id", eoProductIds);
      const eoByExt = new Map<string, any>();
      for (const ep of (eoProds || []) as any[]) eoByExt.set(String(ep.external_id), ep);
      // PRIMARY normalization: resolve canonical EO variant_id by SKU.
      // EasyOrders returns different variant IDs in /orders vs /products for the same SKU,
      // so SKU is the only reliable cross-endpoint identifier.
      for (const li of lineItems) {
        if (!li.easyorders_product_id) continue;
        const ep = eoByExt.get(li.easyorders_product_id);
        if (!ep || !Array.isArray(ep.variants)) continue;
        let canonical: any = null;
        // 1) Match by SKU first (most reliable)
        if (li.easyorders_sku) {
          canonical = ep.variants.find((v: any) => String(v.sku ?? "") === String(li.easyorders_sku));
        }
        // 2) Fallback to variation_props match
        if (!canonical && li.easyorders_variant_id) {
          let cartVariant: any = null;
          if (Array.isArray(data.cart_items)) {
            for (const ci of data.cart_items) {
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
      // Re-sync top-level variant ids list for first-product matching below
      eoVariantIds.length = 0;
      for (const li of lineItems) if (li.easyorders_variant_id) eoVariantIds.push(li.easyorders_variant_id);
      if (!localProds || localProds.length === 0) {
        // No local product is linked to any EasyOrders product id from this order
      }
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
          let matchedVariantKey: string | null = null;

          // PRIMARY: lookup EO variant_id in the user-managed mapping (ProductForm table)
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

          // FALLBACK: name-based only if mapping is missing this EO variant id
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
        // Self-heal: persist freshly resolved EO variant IDs by name
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

    // Resolve store_id: prefer body.store_id, else user's default store, else first store
    let storeId: string | null = s(body.store_id, 100) || null;
    if (!storeId) {
      const { data: defStore } = await supabase
        .from("stores")
        .select("id, is_default, created_at")
        .eq("owner_id", userId)
        .order("is_default", { ascending: false })
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      storeId = (defStore as any)?.id ?? null;
    }

    const { data: order, error: iErr } = await supabase.from("orders").insert({
      owner_id: userId,
      store_id: storeId,
      customer_name, phone, address, city,
      product_name: product_name || "طلب من EasyOrders",
      price: isNaN(total) ? 0 : total,
      quantity: Math.max(1, Math.min(999, quantity)),
      status: "pending",
      product_id: matched_product_id,
      selected_color, selected_size, selected_product_code,
      matched_zone_id, matched_area_id, matched_zone_name, matched_area_name,
      link_error,
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
