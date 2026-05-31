// Public webhook for Green API. URL: /functions/v1/whatsapp-webhook?token=<webhook_token>
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function previewOf(text: string | null | undefined, t: string): string {
  if (text && text.trim()) return text.trim().slice(0, 120);
  if (t === "image") return "📷 صورة";
  if (t === "file" || t === "document") return "📎 ملف";
  if (t === "audio") return "🎤 رسالة صوتية";
  if (t === "video") return "🎥 فيديو";
  return "";
}

function parseConfirmIntent(text: string): "confirm" | "cancel" | null {
  const t = (text || "").trim().toLowerCase();
  if (!t) return null;
  if (t === "1") return "confirm";
  if (t === "2") return "cancel";
  // Button IDs from interactive Quick Reply
  if (t === "confirm_order" || t === "✅ تأكيد الطلب".toLowerCase() || t === "تأكيد الطلب" || t === "تاكيد الطلب") return "confirm";
  if (t === "cancel_order" || t === "❌ إلغاء الطلب".toLowerCase() || t === "إلغاء الطلب" || t === "الغاء الطلب") return "cancel";
  const yes = ["نعم","تاكيد","تأكيد","موافق","ايوه","اوكي","ok","yes","y","اي","أكيد"];
  const no = ["لا","الغاء","إلغاء","لاء","cancel","no","n","مش","ماني"];
  if (yes.some((w) => t === w || t.includes(w))) return "confirm";
  if (no.some((w) => t === w || t.includes(w))) return "cancel";
  return null;
}

function isStructuredConfirmationPrompt(text: string | null | undefined): boolean {
  const t = (text || "").trim();
  return t.includes("للتأكيد أرسل") && t.includes("للإلغاء أرسل");
}

function isRecentEnough(ts: string | null | undefined, maxAgeMs: number): boolean {
  if (!ts) return false;
  const time = new Date(ts).getTime();
  if (Number.isNaN(time)) return false;
  return Date.now() - time <= maxAgeMs;
}

// ---- WhatChimp webhook handler --------------------------------------
// WhatChimp posts incoming messages and delivery status updates.
// We normalize a few common payload shapes since WhatChimp's exact JSON
// can vary between event types.
function pickFirst(obj: any, keys: string[]): any {
  for (const k of keys) {
    if (obj == null) return undefined;
    const v = k.split(".").reduce((acc: any, part) => (acc == null ? acc : acc[part]), obj);
    if (v != null && v !== "") return v;
  }
  return undefined;
}

async function handleWhatChimp(supabase: any, ownerId: string, settings: any, payload: any): Promise<string> {
  // Detect event type
  const eventType = String(
    pickFirst(payload, ["event", "type", "event_type", "data.event", "data.type"]) || ""
  ).toLowerCase();

  // ---- Status updates (sent/delivered/read/failed) ----
  const statusVal = String(
    pickFirst(payload, ["status", "message_status", "data.status", "data.message_status"]) || ""
  ).toLowerCase();
  const statusMsgId = pickFirst(payload, [
    "message_id", "data.message_id", "wamid", "data.wamid", "id", "data.id",
  ]);
  const isStatusEvent =
    eventType.includes("status") ||
    (statusVal && ["sent", "delivered", "read", "failed", "pending"].includes(statusVal));

  if (isStatusEvent && statusMsgId) {
    const map: Record<string, string> = {
      sent: "sent", delivered: "delivered", read: "read",
      failed: "failed", pending: "pending",
    };
    const mapped = map[statusVal] || statusVal || "sent";
    await supabase.from("whatsapp_messages")
      .update({ status: mapped })
      .eq("green_message_id", String(statusMsgId))
      .eq("owner_id", ownerId);
    return "ok";
  }

  // ---- Incoming message ----
  const fromRaw = String(
    pickFirst(payload, [
      "from", "from_number", "sender", "wa_id", "phone",
      "chat_id", "chatId", "subscriber_phone", "user_phone",
      "data.from", "data.from_number", "data.sender", "data.wa_id", "data.phone",
      "data.chat_id", "data.chatId", "data.subscriber_phone", "data.user_phone",
    ]) || ""
  );
  const subscriberIdRaw = String(
    pickFirst(payload, ["subscriber_id", "data.subscriber_id"]) || ""
  );
  const phone = (fromRaw || subscriberIdRaw.split("-")[0] || "").replace(/\D/g, "");
  if (!phone) return "ignored (no phone)";

  const senderName = pickFirst(payload, [
    "name", "sender_name", "profile_name", "contact_name", "first_name", "full_name",
    "data.name", "data.sender_name", "data.profile_name", "data.first_name", "data.full_name",
  ]) || null;

  // Message type + content
  let msgType = "text";
  let content = "";
  let mediaUrl: string | null = null;
  let mediaMime: string | null = null;
  let mediaFilename: string | null = null;

  const rawType = String(
    pickFirst(payload, ["message_type", "data.message_type", "type", "data.type"]) || "text"
  ).toLowerCase();

  const textContent = pickFirst(payload, [
    "message", "text", "body", "message_body", "user_message", "caption",
    "data.message", "data.text", "data.body", "data.message_body", "data.user_message", "data.caption",
    "text.body", "data.text.body",
  ]);
  const mediaCandidate = pickFirst(payload, [
    "media_url", "url", "image.link", "audio.link", "video.link", "document.link",
    "data.media_url", "data.url", "data.image.link", "data.audio.link",
    "data.video.link", "data.document.link",
  ]);

  if (rawType.includes("image")) {
    msgType = "image"; mediaUrl = mediaCandidate || null; content = textContent || "";
    mediaMime = pickFirst(payload, ["mime_type", "image.mime_type", "data.image.mime_type"]) || null;
  } else if (rawType.includes("audio") || rawType.includes("voice")) {
    msgType = "audio"; mediaUrl = mediaCandidate || null;
    mediaMime = pickFirst(payload, ["mime_type", "audio.mime_type", "data.audio.mime_type"]) || null;
  } else if (rawType.includes("video")) {
    msgType = "video"; mediaUrl = mediaCandidate || null; content = textContent || "";
  } else if (rawType.includes("document") || rawType.includes("file")) {
    msgType = "file"; mediaUrl = mediaCandidate || null;
    mediaFilename = pickFirst(payload, ["filename", "document.filename", "data.document.filename"]) || null;
    mediaMime = pickFirst(payload, ["mime_type", "document.mime_type", "data.document.mime_type"]) || null;
  } else {
    msgType = "text";
    content = textContent || "";
  }

  const incomingMsgId = pickFirst(payload, [
    "message_id", "id", "wamid", "wa_message_id", "data.message_id", "data.id", "data.wamid", "data.wa_message_id",
  ]) || null;

  // Upsert conversation
  const { data: conv } = await supabase
    .from("whatsapp_conversations")
    .select("id, order_id, unread_count")
    .eq("owner_id", ownerId)
    .eq("phone", phone)
    .maybeSingle();

  let conversationId: string;
  let convOrderId: string | null = conv?.order_id ?? null;
  if (!conv) {
    const { data: linkedOrder } = await supabase
      .from("orders")
      .select("id")
      .eq("owner_id", ownerId)
      .ilike("phone", `%${phone.slice(-9)}%`)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    convOrderId = linkedOrder?.id ?? null;

    const { data: newConv, error: cErr } = await supabase
      .from("whatsapp_conversations")
      .insert({
        owner_id: ownerId,
        phone,
        customer_name: senderName,
        order_id: convOrderId,
        last_message_preview: previewOf(content, msgType),
        unread_count: 1,
      })
      .select("id")
      .single();
    if (cErr) throw cErr;
    conversationId = newConv.id;
  } else {
    conversationId = conv.id;
    await supabase.from("whatsapp_conversations").update({
      last_message_at: new Date().toISOString(),
      last_message_preview: previewOf(content, msgType),
      unread_count: (conv.unread_count || 0) + 1,
      ...(senderName ? { customer_name: senderName } : {}),
    }).eq("id", conversationId);
  }

  await supabase.from("whatsapp_messages").insert({
    owner_id: ownerId,
    conversation_id: conversationId,
    order_id: convOrderId,
    direction: "in",
    message_type: msgType,
    content,
    media_url: mediaUrl,
    media_mime: mediaMime,
    media_filename: mediaFilename,
    status: "delivered",
    green_message_id: incomingMsgId ? String(incomingMsgId) : null,
    raw: payload,
  });

  // Auto-confirm intent handling (keyword-based, no buttons in WhatChimp)
  if (msgType === "text" && convOrderId && settings?.auto_confirm_enabled) {
    const intent = parseConfirmIntent(content);
    const { data: lastOutgoing } = await supabase
      .from("whatsapp_messages")
      .select("content, created_at, order_id, raw")
      .eq("conversation_id", conversationId)
      .eq("direction", "out")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const canUseAutoConfirm = !!(
      intent &&
      lastOutgoing?.order_id === convOrderId &&
      (isStructuredConfirmationPrompt(lastOutgoing?.content) || (lastOutgoing as any)?.raw?.kind === "confirmation_prompt") &&
      isRecentEnough(lastOutgoing?.created_at, 1000 * 60 * 60 * 24)
    );

    if (intent && canUseAutoConfirm) {
      await supabase.from("orders").update({
        confirmation_status: intent === "confirm" ? "confirmed" : "cancelled",
        confirmed_at: new Date().toISOString(),
      }).eq("id", convOrderId).eq("owner_id", ownerId);

      const replyText = intent === "confirm"
        ? "✅ تم تأكيد طلبك بنجاح، سيتم تجهيزه للشحن قريباً. شكراً لك!"
        : "❌ تم إلغاء طلبك بناءً على طلبك.";

      try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        // Use whatsapp-send via service role for provider-agnostic dispatch
        await fetch(`${supabaseUrl}/functions/v1/whatsapp-send`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
          body: JSON.stringify({
            phone, text: replyText, order_id: convOrderId, owner_id: ownerId,
          }),
        }).catch(() => {});
      } catch (e) {
        console.error("auto-reply (whatchimp) failed", e);
      }
      return "ok";
    }
  }

  // AI auto-reply
  if (settings?.ai_auto_reply_enabled) {
    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
      fetch(`${supabaseUrl}/functions/v1/whatsapp-ai-reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${anonKey}` },
        body: JSON.stringify({ owner_id: ownerId, conversation_id: conversationId, phone }),
      }).catch((e) => console.error("ai-reply trigger failed", e));
    } catch (e) {
      console.error("ai-reply trigger error", e);
    }
  }

  return "ok";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  const providerParam = (url.searchParams.get("provider") || "").toLowerCase();
  if (!token) return new Response("missing token", { status: 401 });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Resolve token: first check dedicated tokens table (per-user WhatChimp tokens),
  // then fall back to legacy whatsapp_settings.webhook_token (Green API).
  let ownerId: string | null = null;
  let provider: string = providerParam || "green_api";
  let settings: any = null;

  const { data: tokenRow } = await supabase
    .from("whatsapp_webhook_tokens")
    .select("id, owner_id, provider")
    .eq("token", token)
    .maybeSingle();

  if (tokenRow) {
    ownerId = tokenRow.owner_id;
    provider = providerParam || tokenRow.provider || "whatchimp";
    await supabase
      .from("whatsapp_webhook_tokens")
      .update({ last_used_at: new Date().toISOString() })
      .eq("id", tokenRow.id);
    const { data: s } = await supabase
      .from("whatsapp_settings")
      .select("*")
      .eq("owner_id", ownerId)
      .maybeSingle();
    settings = s;
  } else {
    const { data: s } = await supabase
      .from("whatsapp_settings")
      .select("*")
      .eq("webhook_token", token)
      .maybeSingle();
    if (!s) return new Response("invalid token", { status: 401 });
    settings = s;
    ownerId = s.owner_id;
    provider = providerParam || s.provider || "green_api";
  }

  if (!ownerId) return new Response("invalid token", { status: 401 });

  let payload: any;
  try { payload = await req.json(); } catch { return new Response("bad json", { status: 400 }); }

  console.log("WA webhook", provider, JSON.stringify(payload).slice(0, 500));

  // === WhatChimp branch ============================================
  if (provider === "whatchimp") {
    try {
      const result = await handleWhatChimp(supabase, ownerId!, settings, payload);
      return new Response(result || "ok");
    } catch (e) {
      console.error("whatchimp webhook error", e);
      return new Response("error", { status: 500 });
    }
  }

  // === Green API branch (existing logic) ===========================
  const type = payload?.typeWebhook;

  try {
    // Status updates
    if (type === "outgoingMessageStatus") {
      const status = String(payload.status || "").toLowerCase();
      const map: Record<string,string> = { sent:"sent", delivered:"delivered", read:"read", failed:"failed", noaccount:"failed", notinwhitelist:"failed" };
      const mapped = map[status] || status;
      const idMessage = payload.idMessage;
      if (idMessage) {
        await supabase.from("whatsapp_messages")
          .update({ status: mapped })
          .eq("green_message_id", idMessage)
          .eq("owner_id", ownerId);
      }
      return new Response("ok");
    }

    // Incoming messages
    if (type === "incomingMessageReceived") {
      const senderData = payload.senderData || {};
      const messageData = payload.messageData || {};
      const chatId: string = senderData.chatId || "";
      if (!chatId.endsWith("@c.us")) return new Response("ok"); // ignore groups
      const phone = chatId.replace("@c.us", "").replace(/\D/g, "");
      const senderName = senderData.senderName || senderData.chatName || null;

      let msgType = "text";
      let content = "";
      let mediaUrl: string | null = null;
      let mediaMime: string | null = null;
      let mediaFilename: string | null = null;

      if (messageData.typeMessage === "textMessage" || messageData.typeMessage === "extendedTextMessage") {
        content = messageData.textMessageData?.textMessage || messageData.extendedTextMessageData?.text || "";
      } else if (messageData.typeMessage === "quotedMessage") {
        // Reply that quotes another message - extract the user's actual text
        content = messageData.extendedTextMessageData?.text
          || messageData.extendedTextMessageData?.stanzaId
          || messageData.textMessageData?.textMessage
          || "";
      } else if (
        messageData.typeMessage === "buttonsResponseMessage" ||
        messageData.typeMessage === "templateButtonReplyMessage" ||
        messageData.typeMessage === "listResponseMessage" ||
        messageData.typeMessage === "interactiveButtons"
      ) {
        // Interactive Quick Reply tap → use buttonId (stable) when available, else displayed text
        const br = messageData.buttonsResponseMessage
          || messageData.templateButtonReplyMessage
          || messageData.listResponseMessage
          || messageData.interactiveButtons
          || {};
        content = br.selectedButtonId || br.selectedId || br.stanzaId || br.selectedDisplayText || br.selectedRowId || "";
        msgType = "text";
      } else if (messageData.typeMessage === "imageMessage") {
        msgType = "image";
        const fm = messageData.fileMessageData || {};
        mediaUrl = fm.downloadUrl || null;
        mediaMime = fm.mimeType || null;
        mediaFilename = fm.fileName || null;
        content = fm.caption || "";
      } else if (messageData.typeMessage === "audioMessage") {
        msgType = "audio";
        const fm = messageData.fileMessageData || {};
        mediaUrl = fm.downloadUrl || null;
        mediaMime = fm.mimeType || null;
      } else if (messageData.typeMessage === "videoMessage") {
        msgType = "video";
        const fm = messageData.fileMessageData || {};
        mediaUrl = fm.downloadUrl || null;
        mediaMime = fm.mimeType || null;
        content = fm.caption || "";
      } else if (messageData.typeMessage === "documentMessage") {
        msgType = "file";
        const fm = messageData.fileMessageData || {};
        mediaUrl = fm.downloadUrl || null;
        mediaMime = fm.mimeType || null;
        mediaFilename = fm.fileName || null;
      } else {
        msgType = "system";
        content = `[${messageData.typeMessage}]`;
      }

      // Upsert conversation
      const { data: conv } = await supabase
        .from("whatsapp_conversations")
        .select("id, order_id, unread_count")
        .eq("owner_id", ownerId)
        .eq("phone", phone)
        .maybeSingle();

      let conversationId: string;
      let convOrderId: string | null = conv?.order_id ?? null;
      if (!conv) {
        // Try linking to most recent pending order from this phone
        const { data: linkedOrder } = await supabase
          .from("orders")
          .select("id")
          .eq("owner_id", ownerId)
          .ilike("phone", `%${phone.slice(-9)}%`)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        convOrderId = linkedOrder?.id ?? null;

        const { data: newConv, error: cErr } = await supabase
          .from("whatsapp_conversations")
          .insert({
            owner_id: ownerId,
            phone,
            customer_name: senderName,
            order_id: convOrderId,
            last_message_preview: previewOf(content, msgType),
            unread_count: 1,
          })
          .select("id")
          .single();
        if (cErr) throw cErr;
        conversationId = newConv.id;
      } else {
        conversationId = conv.id;
        await supabase.from("whatsapp_conversations").update({
          last_message_at: new Date().toISOString(),
          last_message_preview: previewOf(content, msgType),
          unread_count: (conv.unread_count || 0) + 1,
          ...(senderName ? { customer_name: senderName } : {}),
        }).eq("id", conversationId);
      }

      await supabase.from("whatsapp_messages").insert({
        owner_id: ownerId,
        conversation_id: conversationId,
        order_id: convOrderId,
        direction: "in",
        message_type: msgType,
        content,
        media_url: mediaUrl,
        media_mime: mediaMime,
        media_filename: mediaFilename,
        status: "delivered",
        green_message_id: payload.idMessage || null,
        raw: payload,
      });

      // Auto-confirm intent handling
      if (msgType === "text" && convOrderId && settings.auto_confirm_enabled) {
        const intent = parseConfirmIntent(content);
        const { data: lastOutgoing } = await supabase
          .from("whatsapp_messages")
          .select("content, created_at, order_id, raw")
          .eq("conversation_id", conversationId)
          .eq("direction", "out")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        const canUseAutoConfirm = !!(
          intent &&
          lastOutgoing?.order_id === convOrderId &&
          (isStructuredConfirmationPrompt(lastOutgoing?.content) || (lastOutgoing as any)?.raw?.kind === "confirmation_prompt") &&
          isRecentEnough(lastOutgoing?.created_at, 1000 * 60 * 60 * 24)
        );

        if (intent && canUseAutoConfirm) {
          // Mirror the manual confirm flow in Orders page:
          // only update confirmation_status (keep order.status as-is so workflow tabs stay correct).
          await supabase.from("orders").update({
            confirmation_status: intent === "confirm" ? "confirmed" : "cancelled",
            confirmed_at: new Date().toISOString(),
          }).eq("id", convOrderId).eq("owner_id", ownerId);

          // Reply to customer
          const replyText = intent === "confirm"
            ? "✅ تم تأكيد طلبك بنجاح، سيتم تجهيزه للشحن قريباً. شكراً لك!"
            : "❌ تم إلغاء طلبك بناءً على طلبك.";

          try {
            const base = `${settings.api_url.replace(/\/$/, "")}/waInstance${settings.instance_id}`;
            const greenRes = await fetch(`${base}/sendMessage/${settings.api_token}`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ chatId, message: replyText }),
            });
            const greenData = await greenRes.json().catch(() => ({}));
            await supabase.from("whatsapp_messages").insert({
              owner_id: ownerId,
              conversation_id: conversationId,
              order_id: convOrderId,
              direction: "out",
              message_type: "text",
              content: replyText,
              status: greenData?.idMessage ? "sent" : "failed",
              green_message_id: greenData?.idMessage || null,
            });
            await supabase.from("whatsapp_conversations").update({
              last_message_at: new Date().toISOString(),
              last_message_preview: replyText.slice(0, 120),
            }).eq("id", conversationId);
          } catch (e) {
            console.error("auto-reply failed", e);
          }

          return new Response("ok");
        }

        if (intent && !canUseAutoConfirm) {
          console.log("Skipping auto-confirm; latest outgoing message is not an active confirmation prompt", {
            conversationId,
            convOrderId,
            lastOutgoingOrderId: lastOutgoing?.order_id ?? null,
            lastOutgoingPreview: (lastOutgoing?.content || "").slice(0, 80),
          });
        }
      }

      // AI auto-reply for non-confirmation messages
      if (settings.ai_auto_reply_enabled) {
        try {
          const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
          const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
          // Fire-and-forget AI reply (do not block webhook response)
          fetch(`${supabaseUrl}/functions/v1/whatsapp-ai-reply`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${anonKey}`,
            },
            body: JSON.stringify({ owner_id: ownerId, conversation_id: conversationId, phone }),
          }).catch((e) => console.error("ai-reply trigger failed", e));
        } catch (e) {
          console.error("ai-reply trigger error", e);
        }
      }

      return new Response("ok");
    }

    return new Response("ignored");
  } catch (e) {
    console.error("webhook error", e);
    return new Response("error", { status: 500 });
  }
});