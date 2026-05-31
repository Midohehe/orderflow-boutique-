// Send a WhatsApp message via WhatChimp. Authenticated only.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function normalizePhone(p: string): string {
  const digits = (p || "").replace(/\D/g, "");
  if (!digits) return "";
  // Default to Libya country code if a local number (starts with 0 and length 10)
  if (digits.startsWith("00")) return digits.slice(2);
  if (digits.startsWith("0") && digits.length === 10) return "218" + digits.slice(1);
  return digits;
}

function previewOf(text: string | null | undefined, t: string): string {
  if (text && text.trim()) return text.trim().slice(0, 120);
  if (t === "image") return "📷 صورة";
  if (t === "file") return "📎 ملف";
  if (t === "audio") return "🎤 رسالة صوتية";
  return "";
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

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const userClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: userData } = await userClient.auth.getUser();
  const user = userData?.user;
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json();
    const phoneRaw = String(body.phone || "");
    const text = String(body.text || "").slice(0, 4000);
    const mediaUrl = body.media_url ? String(body.media_url) : null;
    const mediaType = body.message_type ? String(body.message_type) : (mediaUrl ? "file" : "text");
    const orderId = body.order_id || null;

    const phone = normalizePhone(phoneRaw);
    if (!phone) {
      return new Response(JSON.stringify({ error: "Invalid phone" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!text && !mediaUrl) {
      return new Response(JSON.stringify({ error: "Empty message" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Resolve owner_id (admin can pass owner_id, otherwise self)
    const ownerId = body.owner_id && user.id !== body.owner_id ? String(body.owner_id) : user.id;

    const { data: settings } = await supabase
      .from("whatsapp_settings")
      .select("*")
      .eq("owner_id", ownerId)
      .maybeSingle();

    if (!settings || !settings.enabled) {
      return new Response(JSON.stringify({ error: "WhatsApp not configured" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!settings.whatchimp_api_key || !settings.whatchimp_phone_number_id) {
      return new Response(JSON.stringify({ error: "WhatChimp not configured" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Upsert conversation
    const { data: convExisting } = await supabase
      .from("whatsapp_conversations")
      .select("id")
      .eq("owner_id", ownerId)
      .eq("phone", phone)
      .maybeSingle();

    let conversationId = convExisting?.id;
    if (!conversationId) {
      const { data: newConv, error: cErr } = await supabase
        .from("whatsapp_conversations")
        .insert({
          owner_id: ownerId,
          phone,
          customer_name: body.customer_name || null,
          order_id: orderId,
          last_message_preview: previewOf(text, mediaType),
        })
        .select("id")
        .single();
      if (cErr) throw cErr;
      conversationId = newConv.id;
    } else {
      await supabase
        .from("whatsapp_conversations")
        .update({
          last_message_at: new Date().toISOString(),
          last_message_preview: previewOf(text, mediaType),
          ...(orderId ? { order_id: orderId } : {}),
        })
        .eq("id", conversationId);
    }

    // Insert pending message
    const { data: msg, error: mErr } = await supabase
      .from("whatsapp_messages")
      .insert({
        owner_id: ownerId,
        conversation_id: conversationId,
        order_id: orderId,
        direction: "out",
        message_type: mediaType,
        content: text,
        media_url: mediaUrl,
        status: "pending",
      })
      .select("id")
      .single();
    if (mErr) throw mErr;

    let providerMessageId: string | null = null;
    let providerOk = false;
    let providerData: any = {};

    {
      const baseUrl = String(settings.whatchimp_api_url || "https://app.whatchimp.com").trim().replace(/\/$/, "");
      const endpoint = resolveEndpoint(settings.whatchimp_send_endpoint, `${baseUrl}/api/v1/whatsapp/send`);
      const body = new URLSearchParams();
      body.set("apiToken", settings.whatchimp_api_key);
      body.set("phone_number_id", settings.whatchimp_phone_number_id);
      body.set("phone_number", phone);

      if (mediaUrl) {
        body.set("media_url", mediaUrl);
        if (mediaType === "image") {
          body.set("message_type", "image");
        } else {
          body.set("message_type", "document");
        }
        if (text) body.set("caption", text);
      } else {
        body.set("message", text || "");
      }

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", "Accept": "application/json" },
        body: body.toString(),
      });
      providerData = await res.json().catch(() => ({}));
      providerOk = res.ok && isProviderSuccess(providerData);
      providerMessageId = getProviderMessageId(providerData);
    }

    if (!providerOk) {
      await supabase.from("whatsapp_messages").update({
        status: "failed",
        error: JSON.stringify(providerData).slice(0, 500),
      }).eq("id", msg.id);
      return new Response(JSON.stringify({ error: "whatchimp failed", details: providerData }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await supabase.from("whatsapp_messages").update({
      status: "sent",
      green_message_id: providerMessageId,
    }).eq("id", msg.id);

    return new Response(JSON.stringify({ ok: true, message_id: msg.id, provider_message_id: providerMessageId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("whatsapp-send error", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});