// Push local product quantities to EasyOrders using the dedicated stock endpoints.
// Safe: uses PATCH /products/sku/:sku/quantity and
//       PATCH /products/variants/:product_taager_code/:variant_taager_code/quantity
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

    // Load EO products map
    const { data: eoProds, error: eoErr } = await admin
      .from("easyorders_products")
      .select("external_id, sku, variants")
      .eq("owner_id", userData.user.id);
    if (eoErr) {
      return new Response(JSON.stringify({ error: "DB read failed", details: eoErr.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const eoMap = new Map<string, any>();
    for (const r of (eoProds || []) as any[]) eoMap.set(String(r.external_id), r);

    // Load local linked products
    const { data: localProds, error: lpErr } = await admin
      .from("products")
      .select("id, name, stock, variant_stock, easyorders_product_id, variant_easyorders_ids")
      .eq("owner_id", userData.user.id)
      .not("easyorders_product_id", "is", null);
    if (lpErr) {
      return new Response(JSON.stringify({ error: "DB read failed", details: lpErr.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let updatedVariants = 0;
    let updatedProducts = 0;
    let failed = 0;
    const errors: any[] = [];

    const patchQty = async (url: string, qty: number) => {
      const r = await fetch(url, {
        method: "PATCH",
        headers: { "Api-Key": apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({ quantity: Math.max(0, Math.floor(qty)) }),
      });
      const t = await r.text();
      return { ok: r.ok, status: r.status, body: t };
    };

    for (const lp of (localProds || []) as any[]) {
      const eo = eoMap.get(String(lp.easyorders_product_id));
      if (!eo) {
        failed++;
        errors.push({ product: lp.name, error: "EO product not found locally — sync first" });
        continue;
      }
      const variantIdsMap = (lp.variant_easyorders_ids || {}) as Record<string, string>;
      const variantStock = (lp.variant_stock || {}) as Record<string, number>;
      const eoVariants: any[] = Array.isArray(eo.variants) ? eo.variants : [];
      const eoVarById = new Map(eoVariants.map((v) => [String(v.id), v]));

      const linkedKeys = Object.keys(variantIdsMap);
      if (linkedKeys.length > 0) {
        // Variant-based product: push each variant by its own SKU using the SKU endpoint.
        // EasyOrders' variant endpoint requires a product-level taager_code, which most
        // variant products don't have. The per-SKU endpoint works with variant SKUs directly.
        const productTaager = eo.sku ?? null;
        for (const key of linkedKeys) {
          const eoVarId = variantIdsMap[key];
          const v = eoVarById.get(String(eoVarId));
          const variantTaager = v?.sku ?? v?.taager_code ?? null;
          if (!variantTaager) {
            failed++;
            errors.push({ product: lp.name, variant: key, error: "Variant SKU missing in EasyOrders" });
            continue;
          }
          const qty = Number(variantStock[key] ?? 0);
          // Try per-SKU endpoint first (works even when product has no top-level taager_code)
          const url = `https://api.easy-orders.net/api/v1/external-apps/products/sku/${encodeURIComponent(variantTaager)}/quantity`;
          const res = await patchQty(url, qty);
          if (res.ok) { updatedVariants++; continue; }
          // Fallback to the variant endpoint if product has a taager_code
          if (productTaager) {
            const url2 = `https://api.easy-orders.net/api/v1/external-apps/products/variants/${encodeURIComponent(productTaager)}/${encodeURIComponent(variantTaager)}/quantity`;
            const res2 = await patchQty(url2, qty);
            if (res2.ok) { updatedVariants++; continue; }
            failed++;
            errors.push({ product: lp.name, variant: key, status: res2.status, body: res2.body });
          } else {
            failed++;
            errors.push({ product: lp.name, variant: key, status: res.status, body: res.body });
          }
        }
      } else {
        // Single product (no variants)
        const productTaager = eo.sku ?? null;
        if (!productTaager) {
          failed++;
          errors.push({ product: lp.name, error: "EO product has no taager_code (SKU)" });
          continue;
        }
        const qty = Number(lp.stock ?? 0);
        const url = `https://api.easy-orders.net/api/v1/external-apps/products/sku/${encodeURIComponent(productTaager)}/quantity`;
        const res = await patchQty(url, qty);
        if (res.ok) updatedProducts++;
        else { failed++; errors.push({ product: lp.name, status: res.status, body: res.body }); }
      }
    }

    return new Response(JSON.stringify({
      ok: true,
      updatedVariants,
      updatedProducts,
      failed,
      errors: errors.slice(0, 50),
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("push-easyorders-quantities error", e);
    return new Response(JSON.stringify({ error: "Bad request", details: String(e) }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
