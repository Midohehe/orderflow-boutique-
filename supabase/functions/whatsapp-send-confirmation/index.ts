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
  // WhatsApp requires international format without '+' (e.g. 2189XXXXXXXX for Libya)
  if (digits.startsWith("00218")) return digits.slice(2); // drop 00
  if (digits.startsWith("218")) return digits;
  if (digits.startsWith("0")) return "218" + digits.slice(1);
  return "218" + digits;
}

function resolveEndpoint(raw: string | null | undefined, fallback: string): string {
  const value = String(raw || "").trim();
  if (!value) return fallback;
  if (/^https?:\/\//i.test(value)) return value.replace(/\/$/, "");
  return `${fallback.replace(/\/$/, "")}/${value.replace(/^\/+/, "")}`;
}

function isProviderSuccess(data: any): boolean {
  return data?.status === "1" || data?.status === 1 || data?.status === "success" || data?.success === true || !!data?.wa_message_id || !!data?.message_id;
}

function getProviderMessageId(data: any): string | null {
  return data?.wa_message_id || data?.message_id || data?.data?.wa_message_id || data?.data?.message_id || null;
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
    if (!settings || !settings.enabled || !settings.whatchimp_api_key || !settings.whatchimp_phone_number_id) {
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

    let providerOk = false;
    let providerMessageId: string | null = null;
    let providerData: any = {};

    {
      const baseUrl = String(settings.whatchimp_api_url || "https://app.whatchimp.com").trim().replace(/\/$/, "");
      const sendEndpoint = resolveEndpoint(settings.whatchimp_send_endpoint, `${baseUrl}/api/v1/whatsapp/send`);
      const templateEndpoint = resolveEndpoint(settings.whatchimp_template_endpoint, `${baseUrl}/api/v1/whatsapp/send/template`);
      const templateId = String(settings.whatchimp_template_id || "").trim();
      const templateName = String(settings.whatchimp_template_name || "").trim();
      const useTemplate = !!settings.whatchimp_use_template && (!!templateId || !!templateName);

      if (useTemplate && templateId) {
        const body = new URLSearchParams();
        body.set("apiToken", settings.whatchimp_api_key);
        body.set("phone_number_id", settings.whatchimp_phone_number_id);
        body.set("phone_number", phone);
        body.set("template_id", templateId);
        body.set("templateVariable-CustomerName-1", order.customer_name || "عميلنا");
        body.set("templateVariable-OrderID-2", String(order.order_code || order.id).slice(0, 8));
        body.set("templateVariable-Products-3", productsLine);
        body.set("templateVariable-Total-4", `${order.price} ${store?.currency_symbol || ""}`.trim());

        const rawButtons = String(settings.whatchimp_template_buttons || "").trim();
        if (rawButtons) {
          const arr = rawButtons.split(/[,\n]/).map((s: string) => s.trim()).filter(Boolean);
          if (arr.length) body.set("template_quick_reply_button_values", JSON.stringify(arr));
        }

        const res = await fetch(templateEndpoint, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded", "Accept": "application/json" },
          body: body.toString(),
        });
        providerData = await res.json().catch(() => ({}));
        providerOk = res.ok && isProviderSuccess(providerData);
        providerMessageId = getProviderMessageId(providerData);
      } else if (useTemplate) {
        const body = new URLSearchParams();
        body.set("apiToken", settings.whatchimp_api_key);
        body.set("phone_number_id", settings.whatchimp_phone_number_id);
        body.set("phone_number", phone);
        body.set("template_name", templateName);
        body.set("language_code", String(settings.whatchimp_template_language || "ar"));
        body.set("variable1", order.customer_name || "عميلنا");
        body.set("variable2", String(order.order_code || order.id).slice(0, 8));
        body.set("variable3", productsLine);
        body.set("variable4", `${order.price} ${store?.currency_symbol || ""}`.trim());

        const res = await fetch(sendEndpoint, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded", "Accept": "application/json" },
          body: body.toString(),
        });
        providerData = await res.json().catch(() => ({}));
        providerOk = res.ok && isProviderSuccess(providerData);
        providerMessageId = getProviderMessageId(providerData);
      } else {
        const body = new URLSearchParams();
        body.set("apiToken", settings.whatchimp_api_key);
        body.set("phone_number_id", settings.whatchimp_phone_number_id);
        body.set("phone_number", phone);
        body.set("message", text);

        const res = await fetch(sendEndpoint, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded", "Accept": "application/json" },
          body: body.toString(),
        });
        providerData = await res.json().catch(() => ({}));
        providerOk = res.ok && isProviderSuccess(providerData);
        providerMessageId = getProviderMessageId(providerData);
      }
    }

    if (providerOk) {
      await supabase.from("whatsapp_messages").update({
        status: "sent", green_message_id: providerMessageId,
        raw: { kind: "confirmation_prompt", provider: "whatchimp" },
      }).eq("id", msg!.id);
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } else {
      await supabase.from("whatsapp_messages").update({
        status: "failed", error: JSON.stringify(providerData).slice(0, 500),
      }).eq("id", msg!.id);
      const providerMessage = String(providerData?.message || "");
      const templateWindowError = providerMessage.toLowerCase().includes("outside 24 hour window");
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
      return new Response(JSON.stringify({ error: "whatchimp failed", details: providerData }), {
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