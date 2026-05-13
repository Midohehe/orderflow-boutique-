// Sends the order confirmation WhatsApp message. Service-role; called from create-order or manually.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function normalizePhone(p: string): string {
  const digits = (p || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("00")) return digits.slice(2);
  if (digits.startsWith("0") && digits.length === 10) return "218" + digits.slice(1);
  return digits;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const { order_id } = await req.json();
    if (!order_id) return new Response(JSON.stringify({ error: "order_id required" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

    const { data: order } = await supabase.from("orders")
      .select("*").eq("id", order_id).maybeSingle();
    if (!order) return new Response(JSON.stringify({ error: "order not found" }), {
      status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

    const { data: settings } = await supabase.from("whatsapp_settings")
      .select("*").eq("owner_id", order.owner_id).maybeSingle();
    if (!settings || !settings.enabled || !settings.instance_id || !settings.api_token) {
      return new Response(JSON.stringify({ skipped: true, reason: "wa_disabled" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const phone = normalizePhone(order.phone);
    if (!phone) return new Response(JSON.stringify({ error: "invalid phone" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

    const { data: store } = await supabase.from("store_settings")
      .select("currency_symbol").eq("owner_id", order.owner_id).maybeSingle();

    const productsLine = `${order.product_name}${order.selected_color ? " - " + order.selected_color : ""}${order.selected_size ? " - " + order.selected_size : ""} × ${order.quantity}`;

    const text = (settings.confirm_template || "")
      .replaceAll("{customer_name}", order.customer_name || "عميلنا")
      .replaceAll("{order_id}", String(order.id).slice(0, 8))
      .replaceAll("{products}", productsLine)
      .replaceAll("{total}", String(order.price))
      .replaceAll("{currency}", store?.currency_symbol || "");

    // Upsert conversation
    const { data: convExisting } = await supabase.from("whatsapp_conversations")
      .select("id").eq("owner_id", order.owner_id).eq("phone", phone).maybeSingle();

    let conversationId = convExisting?.id;
    if (!conversationId) {
      const { data: nc } = await supabase.from("whatsapp_conversations").insert({
        owner_id: order.owner_id, phone,
        customer_name: order.customer_name,
        order_id: order.id,
        last_message_preview: text.slice(0, 120),
      }).select("id").single();
      conversationId = nc!.id;
    } else {
      await supabase.from("whatsapp_conversations").update({
        order_id: order.id,
        last_message_at: new Date().toISOString(),
        last_message_preview: text.slice(0, 120),
      }).eq("id", conversationId);
    }

    const { data: msg } = await supabase.from("whatsapp_messages").insert({
      owner_id: order.owner_id,
      conversation_id: conversationId,
      order_id: order.id,
      direction: "out",
      message_type: "text",
      content: text,
      status: "pending",
    }).select("id").single();

    const base = `${settings.api_url.replace(/\/$/, "")}/waInstance${settings.instance_id}`;
    const greenRes = await fetch(`${base}/sendMessage/${settings.api_token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chatId: `${phone}@c.us`, message: text }),
    });
    const greenData = await greenRes.json().catch(() => ({}));

    if (greenData?.idMessage) {
      await supabase.from("whatsapp_messages").update({
        status: "sent", green_message_id: greenData.idMessage,
      }).eq("id", msg!.id);
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } else {
      await supabase.from("whatsapp_messages").update({
        status: "failed", error: JSON.stringify(greenData).slice(0, 500),
      }).eq("id", msg!.id);
      return new Response(JSON.stringify({ error: "green api failed", details: greenData }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});