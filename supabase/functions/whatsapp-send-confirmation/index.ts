// Sends the order confirmation WhatsApp message. Service-role; called from create-order or manually.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { sendText, sendConfirmationTemplate, isConfigured, getProvider, resolveSendSettings } from "../_shared/wa-providers.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function normalizePhone(p: string): string {
  const digits = (p || "").replace(/\D/g, "");
  if (!digits) return "";
  // WhatsApp requires international format without '+' (e.g. 2189XXXXXXXX for Libya)
  if (digits.startsWith("00218")) return digits.slice(2); // drop 00
  if (digits.startsWith("218")) return digits;
  if (digits.startsWith("0")) return "218" + digits.slice(1);
  return "218" + digits;
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

    // Resolve which WhatsApp integration to use. The order owner's own
    // (store-aware) settings take priority; otherwise we fall back to an
    // integration another merchant has shared with this owner. Messages are
    // still logged under order.owner_id regardless of the sending source.
    const resolved = await resolveSendSettings(supabase, order.owner_id, order.store_id ?? null);
    const settings = resolved.settings;
    if (!isConfigured(settings)) {
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

    const provider = getProvider(settings);
    // Business-initiated confirmations are usually outside the 24h customer
    // service window, so a template is required to reach a new customer.
    //  - Wati:     wati_use_template + wati_template_name
    //  - MazBot:   mazbot_use_template + mazbot_template_id (session messages
    //              fail with 422 outside the 24h window, so default to template
    //              whenever a template id is configured)
    //  - WhatChimp: whatchimp_use_template + template id/name
    const useTemplate = provider === "wati"
      ? !!settings.wati_use_template && !!settings.wati_template_name
      : provider === "mazbot"
        ? (settings.mazbot_use_template !== false) && !!settings.mazbot_template_id
        : !!settings.whatchimp_use_template && (!!settings.whatchimp_template_id || !!settings.whatchimp_template_name);

    const result = useTemplate
      ? await sendConfirmationTemplate(settings, phone, {
          customer_name: order.customer_name || "عميلنا",
          order_id: String(order.order_code || order.id).slice(0, 8),
          products: productsLine,
          // Bare number: WhatsApp templates usually hardcode the currency unit
          // after the {{total}} placeholder, so adding it here would duplicate it.
          total: String(order.price),
        })
      : await sendText(settings, phone, text);
    const providerOk = result.ok;
    const providerMessageId = result.messageId;
    const providerData = result.raw;

    if (providerOk) {
      await supabase.from("whatsapp_messages").update({
        status: "sent", green_message_id: providerMessageId,
        raw: { kind: "confirmation_prompt", provider },
      }).eq("id", msg!.id);
      // Stamp the order so the reminder cron knows when we last prompted
      try {
        await supabase.from("orders").update({
          last_confirm_prompt_at: new Date().toISOString(),
          confirmation_attempts: (Number(order.confirmation_attempts) || 0) + 1,
        }).eq("id", order.id);
      } catch (e) { console.error("stamp confirm prompt failed", e); }
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } else {
      await supabase.from("whatsapp_messages").update({
        status: "failed", error: JSON.stringify(providerData).slice(0, 500),
      }).eq("id", msg!.id);
      // Detect "must use a template" situations across providers. MazBot returns
      // HTTP 422 for session messages sent outside the 24h customer-service window
      // (nested under raw.body / raw.status), while Wati/WhatChimp use a message string.
      const providerMessage = `${providerData?.message || ""} ${providerData?.body?.message || ""}`.toLowerCase();
      const mazbotWindow = provider === "mazbot" && (
        providerData?.status === 422 || providerData?.body?.success === false
      ) && !useTemplate;
      const templateWindowError = providerMessage.includes("outside 24 hour window")
        || providerMessage.includes("24-hour")
        || providerMessage.includes("session")
        || mazbotWindow;
      if (templateWindowError) {
        return new Response(JSON.stringify({
          skipped: true,
          reason: "template_required",
          error: "whatsapp_template_required",
          details: providerData,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "provider failed", details: providerData }), {
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