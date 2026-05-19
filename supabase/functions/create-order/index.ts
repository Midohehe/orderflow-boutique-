// Public edge function to create an order with server-side price recomputation.
// Prevents clients from spoofing the price written to the database.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface OrderPayload {
  product_id: string;
  quantity: number;
  customer_name: string;
  phone: string;
  address: string;
  city: string;
  selected_color?: string | null;
  selected_size?: string | null;
  selected_product_code?: string | null;
  shipping_included?: boolean;
  upsell_index?: number | null;
  items?: Array<{
    color?: string | null;
    size?: string | null;
    product_code?: string | null;
    quantity?: number;
  }> | null;
}

function s(v: unknown, max = 200): string {
  if (typeof v !== "string") return "";
  return v.trim().slice(0, max);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = (await req.json()) as OrderPayload;

    const product_id = s(body.product_id, 64);
    let quantity = Math.max(1, Math.min(999, Math.floor(Number(body.quantity) || 1)));
    const upsellIndex =
      body.upsell_index === null || body.upsell_index === undefined
        ? null
        : Math.floor(Number(body.upsell_index));
    const customer_name = s(body.customer_name, 120);
    const phone = s(body.phone, 40);
    const address = s(body.address, 500);
    const city = s(body.city, 120);

    if (!product_id || !phone) {
      console.error("Missing required fields", { product_id, phone });
      return new Response(JSON.stringify({ error: "Missing required fields (product/phone)" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Authoritative price lookup
    const { data: product, error: pErr } = await supabase
      .from("products")
      .select("id, name, price, is_visible, owner_id, store_id, upsell_enabled, upsell_offers")
      .eq("id", product_id)
      .maybeSingle();

    if (pErr || !product || !product.is_visible) {
      return new Response(JSON.stringify({ error: "Product unavailable" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let totalPrice = Number(product.price) * quantity;
    if (
      upsellIndex !== null &&
      (product as any).upsell_enabled &&
      Array.isArray((product as any).upsell_offers)
    ) {
      const offer = (product as any).upsell_offers[upsellIndex];
      if (offer && Number(offer.quantity) > 0 && Number(offer.price) > 0) {
        quantity = Math.max(1, Math.min(999, Math.floor(Number(offer.quantity))));
        totalPrice = Number(offer.price);
      }
    }

    // Insert the order immediately with no city match. City matching (AI) and
    // stock/WhatsApp side-effects run in the background so the client can
    // navigate to the thank-you page without waiting on slow AI calls.
    const { data: insertedOrder, error: iErr } = await supabase.from("orders").insert({
      owner_id: (product as any).owner_id,
      store_id: (product as any).store_id ?? null,
      customer_name: customer_name || "بدون اسم",
      phone,
      address: address || "—",
      city: city || "—",
      product_id: product.id,
      product_name: product.name,
      price: totalPrice,
      quantity,
      status: "pending",
      selected_color: s(body.selected_color ?? "", 200) || null,
      selected_size: s(body.selected_size ?? "", 200) || null,
      selected_product_code: s(body.selected_product_code ?? "", 200) || null,
      shipping_included: body.shipping_included === true,
    }).select("id").single();

    if (iErr) {
      console.error("order insert failed", iErr);
      return new Response(JSON.stringify({ error: "Could not create order" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Persist per-piece order_items so each variant is preserved (avoids "missing" pieces)
    try {
      const incoming = Array.isArray(body.items) ? body.items! : [];
      const unitPrice = quantity > 0 ? Number((totalPrice / quantity).toFixed(2)) : Number(product.price) || 0;
      const rows: any[] = [];
      if (incoming.length > 0) {
        for (const it of incoming) {
          rows.push({
            order_id: insertedOrder!.id,
            owner_id: (product as any).owner_id,
            store_id: (product as any).store_id ?? null,
            product_id: product.id,
            product_name: product.name,
            quantity: Math.max(1, Math.floor(Number(it.quantity) || 1)),
            price: unitPrice,
            selected_color: s(it.color ?? "", 200) || null,
            selected_size: s(it.size ?? "", 200) || null,
            selected_product_code: s(it.product_code ?? "", 200) || null,
          });
        }
      } else if (quantity > 1) {
        // Fallback: expand into N single-quantity items so the order is not "incomplete"
        for (let i = 0; i < quantity; i++) {
          rows.push({
            order_id: insertedOrder!.id,
            owner_id: (product as any).owner_id,
            store_id: (product as any).store_id ?? null,
            product_id: product.id,
            product_name: product.name,
            quantity: 1,
            price: unitPrice,
            selected_color: s(body.selected_color ?? "", 200) || null,
            selected_size: s(body.selected_size ?? "", 200) || null,
            selected_product_code: s(body.selected_product_code ?? "", 200) || null,
          });
        }
      }
      if (rows.length > 0) {
        const { error: itErr } = await supabase.from("order_items").insert(rows);
        if (itErr) console.error("order_items insert failed", itErr);
      }
    } catch (e) {
      console.error("order_items persistence error", e);
    }

    // Background tasks — do not block the HTTP response.
    if (insertedOrder?.id) {
      const orderId = insertedOrder.id;
      const baseUrl = Deno.env.get("SUPABASE_URL")!;
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const authHeaders = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceKey}`,
      };

      const background = (async () => {
        // 1) Match city via AI and update the order row.
        try {
          const matchRes = await fetch(`${baseUrl}/functions/v1/match-city`, {
            method: "POST",
            headers: authHeaders,
            body: JSON.stringify({ city, address, owner_id: (product as any).owner_id }),
          });
          if (matchRes.ok) {
            const m = await matchRes.json();
            await supabase.from("orders").update({
              matched_zone_id: m.zone_id ?? null,
              matched_area_id: m.area_id ?? null,
              matched_zone_name: m.zone_name ?? null,
              matched_area_name: m.area_name ?? null,
            }).eq("id", orderId);
          }
        } catch (e) { console.error("match-city failed", e); }

        // 2) Apply stock decrement.
        try {
          await fetch(`${baseUrl}/functions/v1/apply-order-stock`, {
            method: "POST",
            headers: authHeaders,
            body: JSON.stringify({ order_id: orderId, reason: "order_created" }),
          });
        } catch (e) { console.error("apply-order-stock failed", e); }

        // 3) WhatsApp confirmation.
        try {
          await fetch(`${baseUrl}/functions/v1/whatsapp-send-confirmation`, {
          method: "POST",
            headers: authHeaders,
            body: JSON.stringify({ order_id: orderId }),
          });
        } catch (e) { console.error("wa-confirm failed", e); }
      })();

      // Keep the runtime alive until background work completes, but don't
      // make the client wait for it.
      try {
        // @ts-ignore - EdgeRuntime is available in Supabase Edge runtime
        EdgeRuntime.waitUntil(background);
      } catch {
        // Fallback: at least don't crash if waitUntil isn't available.
        background.catch((e) => console.error("bg tasks failed", e));
      }
    }

    return new Response(JSON.stringify({ ok: true, price: totalPrice }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: "Bad request" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
