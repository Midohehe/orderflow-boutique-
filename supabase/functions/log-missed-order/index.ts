import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function s(v: unknown, max = 500): string {
  if (typeof v !== "string") return "";
  return v.trim().slice(0, max);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const product_id = s(body.product_id, 64);
    const owner_id = s(body.owner_id, 64);
    const store_id = s(body.store_id, 64);
    const reason = s(body.reason, 80) || "confirmation_cancelled";

    if (!product_id || !owner_id || !store_id) {
      return new Response(JSON.stringify({ error: "missing_fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: product } = await supabase
      .from("products")
      .select("id, name, owner_id, store_id, is_visible")
      .eq("id", product_id)
      .maybeSingle();

    if (!product || !product.is_visible) {
      return new Response(JSON.stringify({ error: "product_unavailable" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (product.owner_id !== owner_id || (product.store_id && product.store_id !== store_id)) {
      return new Response(JSON.stringify({ error: "invalid_store" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const quantity = Math.max(1, Math.min(999, Math.floor(Number(body.quantity) || 1)));
    const estimated = Number(body.estimated_price);
    const estimated_price = Number.isFinite(estimated) && estimated >= 0 ? estimated : null;

    const { data: row, error } = await supabase
      .from("missed_orders")
      .insert({
        owner_id,
        store_id,
        product_id,
        product_name: s(body.product_name, 200) || product.name,
        landing_slug: s(body.landing_slug, 200) || null,
        customer_name: s(body.customer_name, 120) || null,
        phone: s(body.phone, 40) || null,
        address: s(body.address, 500) || null,
        city: s(body.city, 120) || null,
        governorate: s(body.governorate, 120) || null,
        quantity,
        estimated_price,
        reason,
        form_data: body.form_data && typeof body.form_data === "object" ? body.form_data : null,
      })
      .select("id")
      .single();

    if (error) throw error;

    return new Response(JSON.stringify({ ok: true, id: row?.id }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("log-missed-order:", e);
    return new Response(JSON.stringify({ error: "server_error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
