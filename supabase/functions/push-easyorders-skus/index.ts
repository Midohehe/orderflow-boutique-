// Push warehouse codes (from shipping company) as taager_code/SKU on EasyOrders variants.
// Uses PATCH /products/:id with full variations + variants payload.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function norm(v: unknown): string {
  return String(v ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\u064B-\u0652\u0670]/g, "")
    .replace(/[\u0623\u0625\u0622]/g, "ا")
    .replace(/\u0649/g, "ي")
    .replace(/\u0624/g, "و")
    .replace(/\u0626/g, "ي")
    .replace(/\u0629/g, "ه")
    .replace(/3xj/g, "3xl")
    .replace(/\s+/g, " ");
}

function eoVariantKey(variant: any): string {
  const props = Array.isArray(variant?.variation_props) ? variant.variation_props : [];
  const parts = props
    .map((p: any) => String(p?.variation_prop ?? p?.value ?? "").trim())
    .filter(Boolean);
  return parts.join(" - ");
}

function findLocalCodeForVariant(eoVariant: any, codesMap: Record<string, string>): string | null {
  const wantedKey = norm(eoVariantKey(eoVariant));
  if (!wantedKey) return null;
  for (const [k, v] of Object.entries(codesMap || {})) {
    if (norm(k) === wantedKey) return String(v ?? "") || null;
  }
  // Fuzzy: token order may differ
  const wantedTokens = wantedKey.split(" - ").map((t) => t.trim()).filter(Boolean).sort().join("|");
  for (const [k, v] of Object.entries(codesMap || {})) {
    const tokens = norm(k).split(" - ").map((t) => t.trim()).filter(Boolean).sort().join("|");
    if (tokens && tokens === wantedTokens) return String(v ?? "") || null;
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const bodyData = await req.json().catch(() => ({}));
    const allowedProductIds: string[] | undefined = Array.isArray(bodyData?.product_ids)
      ? bodyData.product_ids.map(String)
      : undefined;

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
      .from("profiles").select("easyorders_api_key")
      .eq("user_id", userData.user.id).maybeSingle();
    const apiKey = (profile as any)?.easyorders_api_key;
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "EasyOrders API key not configured" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: eoProds } = await admin
      .from("easyorders_products")
      .select("external_id, sku, variants, raw")
      .eq("owner_id", userData.user.id);
    const eoMap = new Map<string, any>();
    for (const r of (eoProds || []) as any[]) eoMap.set(String(r.external_id), r);

    let localQuery = admin
      .from("products")
      .select("id, name, easyorders_product_id, variant_warehouse_codes")
      .eq("owner_id", userData.user.id)
      .not("easyorders_product_id", "is", null);
    if (allowedProductIds && allowedProductIds.length > 0) {
      localQuery = localQuery.in("id", allowedProductIds);
    }
    const { data: localProds } = await localQuery;

    let updatedProducts = 0;
    let updatedVariants = 0;
    let skipped = 0;
    let failed = 0;
    const errors: any[] = [];

    for (const lp of (localProds || []) as any[]) {
      const eo = eoMap.get(String(lp.easyorders_product_id));
      if (!eo) { skipped++; continue; }
      const codesMap = (lp.variant_warehouse_codes || {}) as Record<string, string>;
      const eoVariants: any[] = Array.isArray(eo.variants) ? eo.variants : [];
      if (!eoVariants.length || !Object.keys(codesMap).length) {
        skipped++; continue;
      }
      const raw = eo.raw || {};

      // Build variations defs from union of variation_props
      const variationsMap = new Map<string, Set<string>>();
      for (const v of eoVariants) {
        const props = Array.isArray(v?.variation_props) ? v.variation_props : [];
        for (const p of props) {
          const name = String(p?.variation ?? p?.variation_name ?? "").trim();
          const val = String(p?.variation_prop ?? p?.value ?? "").trim();
          if (!name || !val) continue;
          if (!variationsMap.has(name)) variationsMap.set(name, new Set());
          variationsMap.get(name)!.add(val);
        }
      }
      const variationsArr = Array.from(variationsMap.entries()).map(([name, vals]) => ({
        name,
        type: "dropdown",
        props: Array.from(vals).map((val) => ({ name: val, value: val })),
      }));

      // Build new variants array, replacing taager_code with local warehouse code when matched
      let changed = 0;
      const newVariants = eoVariants.map((v) => {
        const localCode = findLocalCodeForVariant(v, codesMap);
        const newSku = localCode || (v?.sku ?? v?.taager_code ?? "");
        if (localCode && localCode !== (v?.sku ?? v?.taager_code ?? "")) changed++;
        return {
          price: Number(v?.price ?? raw.price ?? 0),
          sale_price: Number(v?.sale_price ?? v?.price ?? raw.price ?? 0),
          quantity: Number(v?.stock ?? v?.quantity ?? 0),
          taager_code: String(newSku || ""),
          variation_props: (Array.isArray(v?.variation_props) ? v.variation_props : []).map((p: any) => ({
            variation: String(p?.variation ?? p?.variation_name ?? ""),
            variation_prop: String(p?.variation_prop ?? p?.value ?? ""),
          })),
        };
      });

      if (changed === 0) { skipped++; continue; }

      // Required fields per EO update API
      const payload: Record<string, unknown> = {
        name: raw.name ?? eo.name ?? "Untitled",
        price: Number(raw.price ?? 0),
        slug: raw.slug ?? "",
        thumb: raw.thumb ?? "",
        description: raw.description ?? "",
        track_stock: raw.track_stock ?? false,
        variations: variationsArr,
        variants: newVariants,
      };

      const url = `https://api.easy-orders.net/api/v1/external-apps/products/${encodeURIComponent(String(eo.external_id))}`;
      const res = await fetch(url, {
        method: "PATCH",
        headers: { "Api-Key": apiKey, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await res.text();
      if (res.ok) {
        updatedProducts++;
        updatedVariants += changed;
      } else {
        failed++;
        errors.push({ product: lp.name, status: res.status, body: body.slice(0, 400) });
      }
    }

    return new Response(JSON.stringify({
      ok: true,
      updatedProducts,
      updatedVariants,
      skipped,
      failed,
      errors: errors.slice(0, 50),
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("push-easyorders-skus error", e);
    return new Response(JSON.stringify({ error: "Bad request", details: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});