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
  const yes = ["نعم","تاكيد","تأكيد","موافق","ايوه","اوكي","ok","yes","y","اي","أكيد"];
  const no = ["لا","الغاء","إلغاء","لاء","cancel","no","n","مش","ماني"];
  if (yes.some((w) => t === w || t.includes(w))) return "confirm";
  if (no.some((w) => t === w || t.includes(w))) return "cancel";
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  if (!token) return new Response("missing token", { status: 401 });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: settings } = await supabase
    .from("whatsapp_settings")
    .select("*")
    .eq("webhook_token", token)
    .maybeSingle();

  if (!settings) return new Response("invalid token", { status: 401 });
  const ownerId = settings.owner_id;

  let payload: any;
  try { payload = await req.json(); } catch { return new Response("bad json", { status: 400 }); }

  const type = payload?.typeWebhook;
  console.log("WA webhook", type, JSON.stringify(payload).slice(0, 500));

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
        if (intent) {
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