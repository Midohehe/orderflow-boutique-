// Polls MazBot for incoming WhatsApp messages and syncs them into
// whatsapp_conversations + whatsapp_messages. Triggered by pg_cron.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function normBase(v: string | null | undefined) {
  return String(v || "https://mazbot.net/api").trim().replace(/\/$/, "");
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

async function pollOwner(supabase: any, s: any) {
  const jwt = await mazbotLogin(s);
  if (!jwt) return { owner: s.owner_id, error: "login_failed" };
  const base = normBase(s.mazbot_base_url);
  const headers = { apikey: s.mazbot_api_key, Authorization: `Bearer ${jwt}`, Accept: "application/json" };
  const since = s.mazbot_last_polled_at ? new Date(s.mazbot_last_polled_at).getTime() : 0;

  // 1) chat rooms
  const roomsRes = await fetch(`${base}/chat-rooms`, { headers });
  const roomsData = await roomsRes.json().catch(() => ({}));
  const rooms: any[] = roomsData?.data?.chat_rooms || roomsData?.data || [];
  let totalNew = 0;

  for (const room of rooms) {
    const updatedAt = room?.updated_at ? new Date(room.updated_at).getTime() : 0;
    if (since && updatedAt && updatedAt <= since) continue;
    const roomId = room?.id;
    const phone = String(room?.contact?.phone || room?.phone || "").replace(/\D+/g, "");
    const name = room?.contact?.name || room?.name || null;
    if (!roomId || !phone) continue;

    // 2) messages for the room
    const msgRes = await fetch(`${base}/message/${roomId}`, { headers });
    const msgData = await msgRes.json().catch(() => ({}));
    const msgs: any[] = msgData?.data?.messages || msgData?.data || [];
    if (!msgs.length) continue;

    // upsert conversation
    const { data: conv } = await supabase
      .from("whatsapp_conversations")
      .upsert(
        { owner_id: s.owner_id, phone, customer_name: name, last_message_at: new Date(room.updated_at || Date.now()).toISOString() },
        { onConflict: "owner_id,phone" },
      )
      .select("id")
      .single();
    if (!conv?.id) continue;

    let lastPreview: string | null = null;
    let unreadInc = 0;
    for (const m of msgs) {
      const providerId = String(m?.id || m?.message_id || "");
      if (!providerId) continue;
      // dedupe via green_message_id reuse
      const { data: existing } = await supabase
        .from("whatsapp_messages")
        .select("id")
        .eq("green_message_id", providerId)
        .maybeSingle();
      if (existing) continue;

      const direction = m?.sender_type === "client" || m?.from_me || m?.is_outgoing ? "out" : "in";
      const content = m?.message || m?.text || m?.content || null;
      const mediaUrl = m?.media_url || m?.file_url || null;
      const mtype = mediaUrl ? (m?.media_type || "file") : "text";
      const status = direction === "out" ? "sent" : "delivered";

      await supabase.from("whatsapp_messages").insert({
        owner_id: s.owner_id,
        conversation_id: conv.id,
        direction,
        message_type: mtype,
        content,
        media_url: mediaUrl,
        status,
        green_message_id: providerId,
        raw: m,
        created_at: m?.created_at ? new Date(m.created_at).toISOString() : new Date().toISOString(),
      });
      totalNew++;
      lastPreview = content || (mediaUrl ? "📎 ملف" : null);
      if (direction === "in") unreadInc++;
    }

    if (lastPreview || unreadInc) {
      await supabase
        .from("whatsapp_conversations")
        .update({
          last_message_preview: lastPreview,
          last_message_at: new Date(room.updated_at || Date.now()).toISOString(),
          ...(unreadInc ? { unread_count: (Number(room?.unread_count) || 0) + unreadInc } : {}),
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
        results.push(await pollOwner(supabase, s));
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