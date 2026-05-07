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
    const quantity = Math.max(1, Math.min(999, Math.floor(Number(body.quantity) || 1)));
    const customer_name = s(body.customer_name, 120);
    const phone = s(body.phone, 40);
    const address = s(body.address, 500);
    const city = s(body.city, 120);

    if (!product_id || !phone || !address || !city) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
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
      .select("id, name, price, is_visible, owner_id")
      .eq("id", product_id)
      .maybeSingle();

    if (pErr || !product || !product.is_visible) {
      return new Response(JSON.stringify({ error: "Product unavailable" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const totalPrice = Number(product.price) * quantity;

    // Auto-correct city/area against cached shipping zones (fuzzy + AI)
    let matched_zone_id: number | null = null;
    let matched_area_id: number | null = null;
    let matched_zone_name: string | null = null;
    let matched_area_name: string | null = null;
    try {
      const matchRes = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/match-city`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        },
        body: JSON.stringify({ city, address, owner_id: (product as any).owner_id }),
      });
      if (matchRes.ok) {
        const m = await matchRes.json();
        matched_zone_id = m.zone_id ?? null;
        matched_area_id = m.area_id ?? null;
        matched_zone_name = m.zone_name ?? null;
        matched_area_name = m.area_name ?? null;
      }
    } catch (e) {
      console.error("match-city failed", e);
    }

    const { error: iErr } = await supabase.from("orders").insert({
      owner_id: (product as any).owner_id,
      customer_name: customer_name || "بدون اسم",
      phone,
      address,
      city,
      product_id: product.id,
      product_name: product.name,
      price: totalPrice,
      quantity,
      status: "pending",
      selected_color: s(body.selected_color ?? "", 200) || null,
      selected_size: s(body.selected_size ?? "", 200) || null,
      selected_product_code: s(body.selected_product_code ?? "", 200) || null,
      shipping_included: body.shipping_included === true,
      matched_zone_id,
      matched_area_id,
      matched_zone_name,
      matched_area_name,
    });

    if (iErr) {
      console.error("order insert failed", iErr);
      return new Response(JSON.stringify({ error: "Could not create order" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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
