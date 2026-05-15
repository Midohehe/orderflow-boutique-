// Applies stock movements for an order. Idempotent per (order_id, reason, variant, warehouse_code).
// Reasons:
//   - order_created   (sign: -1) decrement on order creation
//   - order_unpacked  (sign: +1) carrier returned & unpacked back to our warehouse (UPKBD)
//   - return_received (sign: +1) we physically received returned items
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface Body {
  order_id: string;
  reason: "order_created" | "order_unpacked" | "return_received";
  return_id?: string | null;
}

function buildVariantKey(color?: string | null, size?: string | null, code?: string | null): string | null {
  const c = (color || "").trim();
  const s = (size || "").trim();
  const k = (code || "").trim();
  if (c && s) return `${c} - ${s}`;
  if (c) return c;
  if (s) return s;
  if (k) return k;
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const body = (await req.json()) as Body;
    if (!body?.order_id || !body?.reason) {
      return new Response(JSON.stringify({ error: "order_id and reason required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const sign = body.reason === "order_created" ? -1 : 1;

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Auth: service-role bearer OR a signed-in user owning the order.
    const authHeader = req.headers.get("Authorization") || "";
    const isServiceRole = authHeader.includes(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "__none__");
    let callerUserId: string | null = null;
    if (!isServiceRole) {
      const userClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || "",
        { global: { headers: { Authorization: authHeader } } },
      );
      const { data: u } = await userClient.auth.getUser();
      callerUserId = u?.user?.id ?? null;
      if (!callerUserId) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const { data: order, error: oErr } = await admin
      .from("orders")
      .select("id, owner_id, product_id, product_name, quantity, selected_color, selected_size, selected_product_code")
      .eq("id", body.order_id).maybeSingle();
    if (oErr || !order) {
      return new Response(JSON.stringify({ error: "Order not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!isServiceRole && callerUserId && (order as any).owner_id !== callerUserId) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Try order_items first (multi-line); fall back to single order row
    const { data: items } = await admin
      .from("order_items")
      .select("product_id, product_name, quantity, selected_color, selected_size, selected_product_code, warehouse_code")
      .eq("order_id", order.id);

    type Line = {
      product_id: string | null;
      product_name: string;
      quantity: number;
      variant_key: string | null;
      warehouse_code: string | null;
    };
    const lines: Line[] = [];
    if (items && items.length > 0) {
      for (const it of items as any[]) {
        lines.push({
          product_id: it.product_id ?? null,
          product_name: it.product_name || "",
          quantity: Math.max(1, Number(it.quantity) || 1),
          variant_key: buildVariantKey(it.selected_color, it.selected_size, it.selected_product_code),
          warehouse_code: (it.warehouse_code || "").trim() || null,
        });
      }
    } else {
      lines.push({
        product_id: (order as any).product_id ?? null,
        product_name: (order as any).product_name || "",
        quantity: Math.max(1, Number((order as any).quantity) || 1),
        variant_key: buildVariantKey(
          (order as any).selected_color,
          (order as any).selected_size,
          (order as any).selected_product_code,
        ),
        warehouse_code: null,
      });
    }

    let applied = 0;
    let skipped = 0;
    const errors: string[] = [];

    // Strict-stock pre-check: if owner enabled it and any line would go negative,
    // mark the order as cancelled and skip applying decrements.
    if (body.reason === "order_created") {
      const { data: ownerProfile } = await admin
        .from("profiles")
        .select("strict_stock_enabled")
        .eq("user_id", (order as any).owner_id)
        .maybeSingle();
      const strict = !!(ownerProfile as any)?.strict_stock_enabled;

      // Aggregate by product_id (+ variant) to detect insufficiency
      let insufficient = false;
      const prodCache = new Map<string, any>();
      for (const line of lines) {
        if (!line.product_id) continue;
        let prod = prodCache.get(line.product_id);
        if (!prod) {
          const { data } = await admin
            .from("products")
            .select("id, stock, variant_stock")
            .eq("id", line.product_id).maybeSingle();
          prod = data; prodCache.set(line.product_id, data);
        }
        if (!prod) continue;
        const vs = (prod.variant_stock || {}) as Record<string, number>;
        let avail: number;
        if (line.variant_key && Object.prototype.hasOwnProperty.call(vs, line.variant_key)) {
          avail = Number(vs[line.variant_key]) || 0;
        } else {
          avail = Number(prod.stock) || 0;
        }
        if (line.quantity > avail) { insufficient = true; break; }
      }

      if (insufficient) {
        // Always flag the order
        await admin.from("orders")
          .update({ insufficient_stock: true, ...(strict ? { status: "cancelled" } : {}) })
          .eq("id", order.id);
        if (strict) {
          return new Response(JSON.stringify({
            ok: false, blocked: true, reason: "insufficient_stock",
          }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
      }
    }

    for (const line of lines) {
      const qty = sign * line.quantity;
      // Insert ledger row (idempotent via unique index)
      const { error: insErr } = await admin.from("stock_movements").insert({
        owner_id: (order as any).owner_id,
        product_id: line.product_id,
        product_name: line.product_name,
        variant_key: line.variant_key,
        warehouse_code: line.warehouse_code,
        qty,
        reason: body.reason,
        order_id: order.id,
        return_id: body.return_id ?? null,
      });
      if (insErr) {
        if ((insErr as any).code === "23505") { skipped++; continue; }
        errors.push(insErr.message);
        continue;
      }

      // Adjust products.variant_stock / stock
      if (line.product_id) {
        const { data: prod } = await admin
          .from("products")
          .select("id, stock, variant_stock")
          .eq("id", line.product_id).maybeSingle();
        if (prod) {
          const vs = { ...(prod as any).variant_stock || {} } as Record<string, number>;
          let newStock = Number((prod as any).stock) || 0;
          if (line.variant_key && Object.prototype.hasOwnProperty.call(vs, line.variant_key)) {
            const cur = Number(vs[line.variant_key]) || 0;
            vs[line.variant_key] = cur + qty; // allow negative
          }
          newStock = newStock + qty; // allow negative
          await admin.from("products")
            .update({ stock: newStock, variant_stock: vs })
            .eq("id", line.product_id);
        }
      }
      applied++;
    }

    return new Response(JSON.stringify({ ok: true, applied, skipped, errors }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("apply-order-stock error", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});