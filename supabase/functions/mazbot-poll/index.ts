// Polls MazBot for incoming WhatsApp messages and syncs them into
// whatsapp_conversations + whatsapp_messages. Triggered by pg_cron.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function queueBackground(promise: Promise<unknown>) {
  const edgeRuntime = (globalThis as any)?.EdgeRuntime;
  if (typeof edgeRuntime?.waitUntil === "function") {
    edgeRuntime.waitUntil(promise);
  }
}

function normBase(v: string | null | undefined) {
  return String(v || "https://mazbot.net/api").trim().replace(/\/$/, "");
}

function parseConfirmIntent(text: string): "confirm" | "cancel" | null {
  // Strip diacritics, punctuation, and emojis so "✅ تأكيد!" → "تاكيد".
  const t = (text || "")
    .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, "")
    .replace(/[إأآا]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .trim()
    .toLowerCase();
  if (!t) return null;
  // Exact-word match only (split on whitespace) — never substring,
  // because "السلام" contains "لا" and would otherwise cancel orders.
  const words = t.split(/\s+/).filter(Boolean);
  const yes = new Set([
    "1","نعم","تاكيد","موافق","ايوه","ايوا","اوكي","اوك","ok","yes","y","اي","اكيد","confirm","confirm_order",
    "تمام","خلاص","ماشي","نبيها","نبي","ابعث","ابعتها","ارسل","صح","تم","تماام",
  ]);
  const no = new Set([
    "2","لا","الغاء","لاء","cancel","no","n","cancel_order","الغي","ماني","ماش","مش",
    "بدلت","ندمت","ترا","تراجعت",
  ]);
  // Single-token messages are the only ones we treat as intents.
  if (words.length === 1) {
    if (yes.has(words[0])) return "confirm";
    if (no.has(words[0])) return "cancel";
  }
  // Two/three-token button labels and common short phrases.
  if (words.length <= 4) {
    const joined = words.join(" ");
    const yesPhrases = [
      "تاكيد الطلب","confirm order","نعم اكيد","اكيد نبي","نبي الطلب","موافق على الطلب",
      "موافق عليه","اكيد نبيها","ابعث الطلب","تمام نبي",
    ];
    const noPhrases = [
      "الغاء الطلب","cancel order","ما نبيش","ما نبي","مش رايد","مش نبي","الغي الطلب",
      "بدلت رايي","ندمت عليه","ما عاد نبي","مش راضي",
    ];
    if (yesPhrases.includes(joined)) return "confirm";
    if (noPhrases.includes(joined)) return "cancel";
  }
  return null;
}

// Resolve message direction across MazBot response variants.
// Per docs, `type` is the direction key: 2 = inbound (from customer), 1 = outbound.
// Older/alternate builds expose `is_contact_msg` / `is_outgoing` / `direction` instead.
function resolveMazbotDirection(m: any): "in" | "out" {
  const t = m?.type;
  if (t === 2 || t === "2") return "in";
  if (t === 1 || t === "1") return "out";
  if (m?.is_contact_msg === true) return "in";
  if (m?.is_contact_msg === false) return "out";
  if (m?.is_outgoing === true || m?.outgoing === true) return "out";
  if (m?.is_outgoing === false || m?.outgoing === false) return "in";
  const d = String(m?.direction || "").toLowerCase();
  if (d === "in" || d === "inbound" || d === "incoming" || d === "received") return "in";
  if (d === "out" || d === "outbound" || d === "outgoing" || d === "sent") return "out";
  // Conservative default: treat unknown as outbound so we never auto-confirm
  // (or auto-cancel) an order off our own messages when the shape is unexpected.
  return "out";
}

function normalizeMazbotMessageType(rawType: string, mediaUrl: string | null): string {
  const t = String(rawType || "text").toLowerCase();
  if (["text", "image", "file", "audio", "video", "sticker", "location", "contact", "system"].includes(t)) {
    return t;
  }
  if (["button", "template", "interactive", "quick_reply", "reply_button"].includes(t)) {
    return "text";
  }
  return mediaUrl ? "file" : "text";
}

async function mazbotLogin(s: any): Promise<string | null> {
  const r = await fetch(`${normBase(s.mazbot_base_url)}/login`, {
    method: "POST",
    headers: { apikey: s.mazbot_api_key, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ email: s.mazbot_email, password: s.mazbot_password }),
  });
  const d = await r.json().catch(() => ({}));
  return d?.data?.token || null;
}

// Determine which merchant a given customer phone belongs to. A single MazBot
// account can serve multiple merchants when the integration is shared, so each
// inbound conversation must be routed to the owner who actually has an order /
// confirmation prompt for that phone. Falls back to the integration owner.
async function resolveEffectiveOwner(
  supabase: any,
  ownerIds: string[],
  phone: string,
): Promise<string> {
  if (ownerIds.length <= 1) return ownerIds[0];
  // 1) Owner with the most recent outbound confirmation prompt for this phone.
  const { data: convs } = await supabase
    .from("whatsapp_conversations")
    .select("id, owner_id")
    .in("owner_id", ownerIds)
    .eq("phone", phone);
  if (convs && convs.length) {
    const convIds = convs.map((c: any) => c.id);
    const { data: prompt } = await supabase
      .from("whatsapp_messages")
      .select("conversation_id, created_at")
      .in("conversation_id", convIds)
      .eq("direction", "out")
      .or("raw->>kind.eq.confirmation_prompt,content.ilike.*للتأكيد أرسل*")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const owner = prompt?.conversation_id
      ? convs.find((c: any) => c.id === prompt.conversation_id)?.owner_id
      : null;
    if (owner) return owner;
  }
  // 2) Owner with the most recent order from this phone.
  const { data: ord } = await supabase
    .from("orders")
    .select("owner_id")
    .in("owner_id", ownerIds)
    .ilike("phone", `%${phone.slice(-9)}%`)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (ord?.owner_id) return ord.owner_id;
  // 3) Default to the integration owner.
  return ownerIds[0];
}

// Resolve auto-confirm / AI auto-reply flags for the effective owner. The MazBot
// credentials belong to the integration owner (`s`), but the behavior toggles
// should follow the merchant who owns the order/conversation.
async function getOwnerFlags(
  supabase: any,
  ownerId: string,
  s: any,
  cache: Map<string, any>,
): Promise<{ auto_confirm_enabled: boolean; ai_auto_reply_enabled: boolean }> {
  if (ownerId === s.owner_id) {
    return {
      auto_confirm_enabled: !!s.auto_confirm_enabled,
      ai_auto_reply_enabled: !!s.ai_auto_reply_enabled,
    };
  }
  if (cache.has(ownerId)) return cache.get(ownerId);
  const { data } = await supabase
    .from("whatsapp_settings")
    .select("auto_confirm_enabled, ai_auto_reply_enabled")
    .eq("owner_id", ownerId);
  const rows = data || [];
  const pick = rows.find((r: any) => r.auto_confirm_enabled) || rows[0] || {};
  const flags = {
    auto_confirm_enabled: !!pick.auto_confirm_enabled,
    ai_auto_reply_enabled: !!pick.ai_auto_reply_enabled,
  };
  cache.set(ownerId, flags);
  return flags;
}

async function pollOwner(supabase: any, s: any, ownerIds: string[]) {
  const jwt = await mazbotLogin(s);
  if (!jwt) return { owner: s.owner_id, error: "login_failed" };
  const base = normBase(s.mazbot_base_url);
  const headers = { apikey: s.mazbot_api_key, Authorization: `Bearer ${jwt}`, Accept: "application/json" };
  const since = s.mazbot_last_polled_at ? new Date(s.mazbot_last_polled_at).getTime() : 0;
  const flagsCache = new Map<string, any>();

  // 1) chat rooms
  const roomsRes = await fetch(`${base}/chat-rooms`, { headers });
  const roomsData = await roomsRes.json().catch(() => ({}));
  const rooms: any[] = roomsData?.data?.chat_rooms || roomsData?.data || [];
  let totalNew = 0;

  for (const room of rooms) {
    const lastConv = room?.last_conversation_at || room?.updated_at;
    const updatedAt = lastConv ? new Date(lastConv.replace(" ", "T") + "Z").getTime() : 0;
    // Skip rooms we already fully processed (with a 30s grace window for clock skew).
    if (since && updatedAt && updatedAt <= since - 30000) continue;
    const roomId = room?.id;
    const phone = String(room?.phone || room?.sender_id || room?.contact?.phone || "").replace(/\D+/g, "");
    const rawName = room?.name || room?.contact?.name || null;
    const name = rawName && !/^\+?\d+$/.test(String(rawName).trim()) ? rawName : null;
    if (!roomId || !phone) continue;

    // Route this conversation to the merchant who owns it (handles shared
    // integrations where one MazBot account serves multiple merchants).
    const effectiveOwner = await resolveEffectiveOwner(supabase, ownerIds, phone);
    const flags = await getOwnerFlags(supabase, effectiveOwner, s, flagsCache);

    // 2) messages for the room — endpoint per docs: GET /message/{chat_room_id}.
    // Response shape varies between deployments, so handle all known forms:
    //   a) docs: data = [ {id, type, message, ...}, ... ]              (flat array)
    //   b) some builds: data.messages = [ {id, ...}, ... ]            (flat under messages)
    //   c) older builds: data.messages = [ {date, messages:[...]} ]   (grouped by date)
    const msgRes = await fetch(`${base}/message/${roomId}`, { headers });
    const msgData = await msgRes.json().catch(() => ({}));
    const rawMsgContainer = Array.isArray(msgData?.data)
      ? msgData.data
      : (msgData?.data?.messages ?? msgData?.messages ?? []);
    const msgs: any[] = Array.isArray(rawMsgContainer)
      ? rawMsgContainer.flatMap((g: any) =>
          Array.isArray(g?.messages) ? g.messages : (g && (g.id != null || g.message != null) ? [g] : []),
        )
      : [];
    if (!msgs.length) continue;

    // upsert conversation
    const { data: conv } = await supabase
      .from("whatsapp_conversations")
      .upsert(
        {
          owner_id: effectiveOwner,
          phone,
          ...(name ? { customer_name: name } : {}),
          last_message_at: new Date(updatedAt || Date.now()).toISOString(),
        },
        { onConflict: "owner_id,phone" },
      )
      .select("id, order_id")
      .single();
    if (!conv?.id) continue;

    // Link conversation to most recent order from this phone if not linked.
    let convOrderId: string | null = (conv as any).order_id ?? null;
    if (!convOrderId) {
      const { data: linkedOrder } = await supabase
        .from("orders").select("id").eq("owner_id", effectiveOwner)
        .ilike("phone", `%${phone.slice(-9)}%`)
        .order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (linkedOrder?.id) {
        convOrderId = linkedOrder.id;
        await supabase.from("whatsapp_conversations")
          .update({ order_id: convOrderId }).eq("id", conv.id);
      }
    }

    let lastPreview: string | null = null;
    let unreadInc = 0;
    // Pull most recent outgoing confirmation prompt (if any) so we only
    // honor confirm/cancel replies that arrive AFTER it. The confirmation
    // message is tagged with raw.kind = 'confirmation_prompt' (set by
    // whatsapp-send-confirmation), which is reliable regardless of the
    // merchant's template text. We keep the legacy phrase match as a fallback.
    const { data: lastPrompt } = await supabase
      .from("whatsapp_messages")
      .select("created_at, order_id")
      .eq("conversation_id", conv.id)
      .eq("direction", "out")
      .or("raw->>kind.eq.confirmation_prompt,content.ilike.*للتأكيد أرسل*")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const promptAt = lastPrompt?.created_at ? new Date(lastPrompt.created_at).getTime() : 0;
    const promptOrderId: string | null = (lastPrompt as any)?.order_id ?? convOrderId;
    let aiTriggered = false;
    // Process oldest → newest so previews/unread reflect the latest message.
    const sortedMsgs = msgs.slice().sort((a: any, b: any) => {
      const ta = new Date(a?.created_at || a?.sent_at || 0).getTime();
      const tb = new Date(b?.created_at || b?.sent_at || 0).getTime();
      return ta - tb;
    });
    for (const m of sortedMsgs) {
      try {
        const providerIdRaw = String(m?.id ?? m?.message_id ?? "").trim();
        if (!providerIdRaw) continue;
        const providerIds = [providerIdRaw, `mazbot:${providerIdRaw}`];

        const { data: existing } = await supabase
          .from("whatsapp_messages")
          .select("id")
          .eq("owner_id", effectiveOwner)
          .in("green_message_id", providerIds)
          .maybeSingle();
        if (existing) continue;

        const direction = resolveMazbotDirection(m);
        const buttonText = Array.isArray(m?.buttons) && m.buttons.length > 0
          ? (m.buttons[0]?.text || m.buttons[0]?.title || null) : null;
        const rawContent = m?.value || buttonText || m?.message || m?.text || null;
        const content = typeof rawContent === "string"
          ? rawContent.replace(/<br\s*\/?>/gi, "\n").replace(/&nbsp;/gi, " ").trim()
          : rawContent;
        const mediaUrl =
          m?.header_image || m?.header_video || m?.header_audio || m?.header_document ||
          m?.media_url || m?.file_url || null;

        let rawType = String(m?.message_type || "text").toLowerCase();
        if (m?.header_image) rawType = "image";
        else if (m?.header_video) rawType = "video";
        else if (m?.header_audio) rawType = "audio";
        else if (m?.header_document) rawType = "file";
        const mtype = normalizeMazbotMessageType(rawType, mediaUrl);
        const status = direction === "out" ? "sent" : "delivered";

        const contextId = m?.context?.id ? String(m.context.id) : null;
        let messageOrderId: string | null = convOrderId;
        let matchedPromptAt = promptAt;
        if (contextId) {
          const { data: promptMsg } = await supabase
            .from("whatsapp_messages")
            .select("order_id, created_at")
            .eq("owner_id", effectiveOwner)
            .eq("conversation_id", conv.id)
            .in("green_message_id", [contextId, `mazbot:${contextId}`])
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          if (promptMsg?.order_id) messageOrderId = promptMsg.order_id;
          if (promptMsg?.created_at) matchedPromptAt = new Date(promptMsg.created_at).getTime();
        }

        await supabase.from("whatsapp_messages").insert({
          owner_id: effectiveOwner,
          conversation_id: conv.id,
          order_id: messageOrderId,
          direction,
          message_type: mtype,
          content,
          media_url: mediaUrl,
          status,
          green_message_id: `mazbot:${providerIdRaw}`,
          raw: m,
          created_at: m?.created_at
            ? new Date(m.created_at).toISOString()
            : (m?.sent_at ? new Date(m.sent_at).toISOString() : new Date().toISOString()),
        });
        totalNew++;
        lastPreview = content || (mediaUrl ? "📎 ملف" : null);
        if (direction === "in") unreadInc++;

        const msgAt = new Date(
          m?.created_at || m?.sent_at || Date.now(),
        ).getTime();
        if (
          direction === "in" && mtype === "text" && messageOrderId &&
          flags.auto_confirm_enabled && matchedPromptAt > 0 && msgAt >= matchedPromptAt
        ) {
          let intent = parseConfirmIntent(content || "");
          // Fallback to AI classifier when literal match fails.
          if (!intent && content && content.trim().length > 0 && content.trim().length < 200) {
            try {
              const ci = await fetch(`${SUPABASE_URL}/functions/v1/whatsapp-classify-intent`, {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_KEY}` },
                body: JSON.stringify({ text: content, prompt_context: "رسالة طلب تأكيد لطلب شراء" }),
              });
              const cj = await ci.json().catch(() => ({}));
              if (cj?.intent === "confirm" || cj?.intent === "cancel") intent = cj.intent;
              console.log(`[mazbot-poll] ai-intent=${cj?.intent} conf=${cj?.confidence ?? "-"} text="${(content||"").slice(0,60)}"`);
            } catch (e) { console.error("ai-intent failed", e); }
          }
          if (intent) {
            const result = intent === "confirm" ? "confirmed" : "cancelled";
            const { data: updatedOrder } = await supabase.from("orders").update({
              confirmation_status: result,
              ...(intent === "cancel" ? { status: "cancelled" } : {}),
              confirmed_at: new Date().toISOString(),
              last_attempt_at: new Date().toISOString(),
              needs_manual_review: false,
            }).eq("id", messageOrderId).eq("owner_id", effectiveOwner)
              .select("store_id").maybeSingle();

            // Audit trail (consistent with the manual Confirmation Center flow).
            try {
              await supabase.from("order_confirmation_attempts").insert({
                order_id: messageOrderId,
                owner_id: effectiveOwner,
                store_id: (updatedOrder as any)?.store_id ?? null,
                result,
                notes: `WhatsApp auto (MazBot): "${(content || "").slice(0, 80)}"`,
              });
            } catch (e) { console.error("mazbot attempt log failed", e); }

            const replyText = intent === "confirm"
              ? "✅ تم تأكيد طلبك بنجاح، سيتم تجهيزه للشحن قريباً. شكراً لك!"
              : "❌ تم إلغاء طلبك بناءً على طلبك.";
            try {
              await fetch(`${SUPABASE_URL}/functions/v1/whatsapp-send`, {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_KEY}` },
                body: JSON.stringify({ phone, text: replyText, order_id: messageOrderId, owner_id: effectiveOwner }),
              }).catch(() => {});
            } catch (e) { console.error("mazbot auto-reply failed", e); }
            continue;
          }
        }

        if (direction === "in" && mtype === "text" && flags.ai_auto_reply_enabled && !aiTriggered) {
          aiTriggered = true;
          try {
            console.log(`[mazbot-poll] triggering ai-reply owner=${effectiveOwner} conv=${conv.id} phone=${phone}`);
            const aiRes = await fetch(`${SUPABASE_URL}/functions/v1/whatsapp-ai-reply`, {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_KEY}` },
              body: JSON.stringify({ owner_id: effectiveOwner, conversation_id: conv.id, phone }),
            });
            const aiText = await aiRes.text();
            console.log(`[mazbot-poll] ai-reply status=${aiRes.status} body=${aiText.slice(0, 300)}`);
          } catch (e) {
            console.error("ai-reply trigger error", e);
          }
        }
      } catch (e) {
        console.error("mazbot message sync failed", {
          owner_id: effectiveOwner,
          message_id: m?.id ?? m?.message_id ?? null,
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }

    if (lastPreview || unreadInc) {
      await supabase
        .from("whatsapp_conversations")
        .update({
          ...(lastPreview ? { last_message_preview: lastPreview } : {}),
          last_message_at: new Date(updatedAt || Date.now()).toISOString(),
          ...(unreadInc ? { unread_count: (Number(room?.total_unread_messages) || 0) + unreadInc } : {}),
        })
        .eq("id", conv.id);
    }
  }

  await supabase
    .from("whatsapp_settings")
    .update({ mazbot_last_polled_at: new Date().toISOString() })
    .eq("owner_id", s.owner_id);

  return { owner: s.owner_id, rooms: rooms.length, new_messages: totalNew };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
    const { data: settingsList, error } = await supabase
      .from("whatsapp_settings")
      .select("*")
      .eq("enabled", true)
      .eq("provider", "mazbot");
    if (error) throw error;

    const results: any[] = [];
    for (const s of settingsList || []) {
      if (!s.mazbot_api_key || !s.mazbot_email || !s.mazbot_password) continue;
      try {
        // Shared integrations: this MazBot account may also serve merchants this
        // owner granted access to. Their customers' replies arrive here too, so
        // include them as candidate owners for routing inbound conversations.
        const { data: shares } = await supabase
          .from("whatsapp_shares")
          .select("shared_with_user_id")
          .eq("owner_id", s.owner_id)
          .eq("status", "active")
          .eq("recipient_active", true);
        const ownerIds = [s.owner_id, ...((shares || []).map((r: any) => r.shared_with_user_id))]
          .filter((v: string, i: number, a: string[]) => v && a.indexOf(v) === i);
        results.push(await pollOwner(supabase, s, ownerIds));
      } catch (e: any) {
        results.push({ owner: s.owner_id, error: e?.message || String(e) });
      }
    }
    return new Response(JSON.stringify({ ok: true, polled: results.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, error: e?.message || String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});