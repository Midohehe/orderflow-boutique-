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
  // Green API requires international format without '+' (e.g. 2189XXXXXXXX for Libya)
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

    const provider = settings.provider || "green_api";
    let providerOk = false;
    let providerMessageId: string | null = null;
    let providerData: any = {};

    if (provider === "green_api") {
      if (!settings.instance_id || !settings.api_token) {
        return new Response(JSON.stringify({ skipped: true, reason: "green_api_not_configured" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const base = `${(settings.api_url || "https://api.green-api.com").replace(/\/$/, "")}/waInstance${settings.instance_id}`;
      // Send interactive Quick Reply buttons so customer can confirm/cancel in one tap
      const buttonsBody = {
        chatId: `${phone}@c.us`,
        message: text,
        footer: "اختر أحد الخيارات أدناه",
        buttons: [
          { buttonId: "confirm_order", buttonText: "✅ تأكيد الطلب" },
          { buttonId: "cancel_order", buttonText: "❌ إلغاء الطلب" },
        ],
      };
      let res = await fetch(`${base}/sendButtons/${settings.api_token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buttonsBody),
      });
      providerData = await res.json().catch(() => ({}));
      providerOk = res.ok && !!providerData?.idMessage;
      providerMessageId = providerData?.idMessage || null;
      // Fallback to plain text (with manual instructions) if buttons endpoint fails
      if (!providerOk) {
        const fallbackText = `${text}\n\nللتأكيد أرسل: تأكيد\nللإلغاء أرسل: إلغاء`;
        res = await fetch(`${base}/sendMessage/${settings.api_token}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chatId: `${phone}@c.us`, message: fallbackText }),
        });
        providerData = await res.json().catch(() => ({}));
        providerOk = res.ok && !!providerData?.idMessage;
        providerMessageId = providerData?.idMessage || null;
      }
    } else if (provider === "whatchimp") {
      if (!settings.whatchimp_api_key || !settings.whatchimp_phone_number_id) {
        return new Response(JSON.stringify({ skipped: true, reason: "whatchimp_not_configured" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const apiUrl = (settings.whatchimp_api_url || "https://app.whatchimp.com").replace(/\/$/, "");
      // Confirmation messages are almost always sent outside the 24h window,
      // so WhatsApp Business API only allows approved templates. Force template
      // mode whenever a template name is configured.
      const normalizedTemplateName = String(settings.whatchimp_template_name || "")
        .replace(/\s*\(Custom\)\s*$/i, "")
        .trim();
      const useTemplate = !!settings.whatchimp_use_template && !!normalizedTemplateName;
      const body: any = {
        apiToken: settings.whatchimp_api_key,
        phone_number_id: settings.whatchimp_phone_number_id,
        phone_number: phone,
      };
      if (useTemplate) {
        body.template_name = normalizedTemplateName;
        body.language_code = settings.whatchimp_template_language || "ar";
        // WhatChimp template API expects flat variableN fields.
        body.variable1 = order.customer_name || "عميلنا";
        body.variable2 = String(order.order_code || order.id).slice(0, 8);
        body.variable3 = productsLine;
        body.variable4 = `${order.price} ${store?.currency_symbol || ""}`.trim();
      } else {
        body.message_type = "text";
        body.message_body = text;
      }
      const res = await fetch(`${apiUrl}/api/v1/whatsapp/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify(body),
      });
      providerData = await res.json().catch(() => ({}));
      providerOk = res.ok && (providerData?.status === "success" || providerData?.success === true || !!providerData?.message_id);
      providerMessageId = providerData?.message_id || providerData?.data?.message_id || null;
    }

    if (providerOk) {
      await supabase.from("whatsapp_messages").update({
        status: "sent", green_message_id: providerMessageId,
        raw: { kind: "confirmation_prompt", provider },
      }).eq("id", msg!.id);
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } else {
      await supabase.from("whatsapp_messages").update({
        status: "failed", error: JSON.stringify(providerData).slice(0, 500),
      }).eq("id", msg!.id);
      const providerMessage = String(providerData?.message || "");
      const templateWindowError =
        provider === "whatchimp" &&
        providerMessage.toLowerCase().includes("outside 24 hour window");
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
      return new Response(JSON.stringify({ error: `${provider} failed`, details: providerData }), {
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