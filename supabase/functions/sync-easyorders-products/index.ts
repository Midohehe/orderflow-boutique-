// Sync products from EasyOrders into local easyorders_products table.
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
    .replace(/[\u0623\u0625\u0622]/g, "\u0627")
    .replace(/\u0649/g, "\u064A")
    .replace(/\u0624/g, "\u0648")
    .replace(/\u0626/g, "\u064A")
    .replace(/\u0629/g, "\u0647")
    .replace(/\s+/g, " ");
}

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
            stock: typeof v.quantity === "number" ? v.quantity : (v.quantity != null ? Number(v.quantity) : null),
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

    // Auto-relink variant IDs on local products linked to any synced EO product.
    // Matches by color/size name (normalized) so variants always have current EO IDs.
    let relinkedProducts = 0;
    let relinkedVariants = 0;
    try {
      const eoIds = allRows.map((r) => r.external_id);
      if (eoIds.length > 0) {
        const { data: localProds } = await admin
          .from("products")
          .select("id, easyorders_product_id, colors, sizes, product_codes, variant_easyorders_ids")
          .eq("owner_id", userData.user.id)
          .in("easyorders_product_id", eoIds);

        const eoByExt = new Map<string, any>();
        for (const r of allRows) eoByExt.set(r.external_id, r);

        for (const lp of (localProds || []) as any[]) {
          const eo = eoByExt.get(String(lp.easyorders_product_id));
          if (!eo || !Array.isArray(eo.variants)) continue;
          const colors: string[] = lp.colors || [];
          const sizes: string[] = lp.sizes || [];
          const codes: string[] = lp.product_codes || [];
          const newMap: Record<string, string> = {};
          let changed = false;
          for (const v of eo.variants) {
            if (!v?.id) continue;
            const props = Array.isArray(v.variation_props) ? v.variation_props : [];
            let color: string | null = null;
            let size: string | null = null;
            for (const p of props) {
              const val = p?.variation_prop ?? p?.value ?? "";
              if (!val) continue;
              const c = colors.find((x) => norm(x) === norm(val) || norm(val).includes(norm(x)));
              if (c && !color) { color = c; continue; }
              const s = sizes.find((x) => norm(x) === norm(val) || norm(val).includes(norm(x)));
              if (s && !size) { size = s; continue; }
            }
            // Build variant key consistent with ProductForm convention
            const keyParts = [color, size].filter(Boolean) as string[];
            let key = keyParts.join(" - ");
            if (!key) {
              // Fallback: try matching SKU/name against product_codes
              const sku = v.sku || v.name;
              const code = codes.find((c) => norm(c) === norm(sku));
              if (code) key = code;
            }
            if (!key) continue;
            newMap[key] = String(v.id);
          }
          // Merge: overwrite existing keys with fresh IDs, keep others as-is
          const existing = (lp.variant_easyorders_ids || {}) as Record<string, string>;
          const merged: Record<string, string> = { ...existing };
          let count = 0;
          for (const [k, id] of Object.entries(newMap)) {
            if (merged[k] !== id) { merged[k] = id; count++; changed = true; }
          }
          if (changed) {
            const { error: uErr } = await admin
              .from("products")
              .update({ variant_easyorders_ids: merged })
              .eq("id", lp.id);
            if (!uErr) {
              relinkedProducts++;
              relinkedVariants += count;
            } else {
              console.error("relink update failed", lp.id, uErr.message);
            }
          }
        }
      }
    } catch (e) {
      console.error("auto-relink error", e);
    }

    return new Response(JSON.stringify({ ok: true, count: total, relinkedProducts, relinkedVariants }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("sync-easyorders-products error", e);
    return new Response(JSON.stringify({ error: "Bad request", details: String(e) }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
