// Cron-triggered: finds orders with unconfirmed confirmation that haven't been
// answered within reminder_minutes, sends a follow-up WhatsApp prompt,
// and after reminder_max attempts flags them for manual review.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { sendText, isConfigured } from "../_shared/wa-providers.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
};

function normalizePhone(p: string): string {
  const digits = (p || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("00218")) return digits.slice(2);
  if (digits.startsWith("218")) return digits;
  if (digits.startsWith("0")) return "218" + digits.slice(1);
  return "218" + digits;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  try {
    // Cache settings per owner to avoid duplicate fetches
    const settingsByOwner = new Map<string, any>();
    const getSettings = async (ownerId: string) => {
      if (settingsByOwner.has(ownerId)) return settingsByOwner.get(ownerId);
      const { data } = await supabase.from("whatsapp_settings")
        .select("*").eq("owner_id", ownerId).maybeSingle();
      settingsByOwner.set(ownerId, data || null);
      return data;
    };

    // Look at the last 48h to bound the query
    const since = new Date(Date.now() - 48 * 3600 * 1000).toISOString();
    const { data: candidates, error } = await supabase
      .from("orders")
      .select("id, owner_id, phone, customer_name, product_name, price, last_confirm_prompt_at, confirmation_attempts, needs_manual_review, confirmation_status, status")
      .eq("confirmation_status", "unconfirmed")
      .eq("needs_manual_review", false)
      .not("last_confirm_prompt_at", "is", null)
      .gte("last_confirm_prompt_at", since)
      .limit(200);

    if (error) throw error;

    let processed = 0;
    let flagged = 0;
    let sent = 0;

    for (const o of (candidates || [])) {
      const settings = await getSettings(o.owner_id);
      if (!settings || !isConfigured(settings) || settings.auto_confirm_enabled === false) continue;

      const reminderMinutes = Math.max(5, Number(settings.reminder_minutes) || 30);
      const reminderMax = Math.max(0, Number(settings.reminder_max) || 2);
      const lastAt = o.last_confirm_prompt_at ? new Date(o.last_confirm_prompt_at).getTime() : 0;
      const ageMin = (Date.now() - lastAt) / 60000;
      if (ageMin < reminderMinutes) continue;

      const attempts = Number(o.confirmation_attempts) || 0;
      processed++;

      if (attempts >= reminderMax) {
        await supabase.from("orders").update({
          needs_manual_review: true,
        }).eq("id", o.id);
        flagged++;
        continue;
      }

      const phone = normalizePhone(o.phone || "");
      if (!phone) continue;
      const text = `مرحباً ${o.customer_name || "عميلنا"} 👋\nمازلنا بانتظار تأكيد طلبك (${o.product_name || ""})${o.price ? ` بقيمة ${o.price}` : ""}.\nللتأكيد أرسل: نعم\nللإلغاء أرسل: لا`;
      try {
        const r = await sendText(settings, phone, text);
        if (r.ok) {
          sent++;
          // Update last prompt time + attempt counter; log outgoing message
          await supabase.from("orders").update({
            last_confirm_prompt_at: new Date().toISOString(),
            confirmation_attempts: attempts + 1,
          }).eq("id", o.id);

          const { data: conv } = await supabase.from("whatsapp_conversations")
            .select("id").eq("owner_id", o.owner_id).eq("phone", phone).maybeSingle();
          if (conv?.id) {
            await supabase.from("whatsapp_messages").insert({
              owner_id: o.owner_id,
              conversation_id: conv.id,
              order_id: o.id,
              direction: "out",
              message_type: "text",
              content: text,
              status: "sent",
              green_message_id: r.messageId,
              raw: { kind: "confirmation_reminder" },
            });
            await supabase.from("whatsapp_conversations").update({
              last_message_at: new Date().toISOString(),
              last_message_preview: text.slice(0, 120),
            }).eq("id", conv.id);
          }
        }
      } catch (e) {
        console.error("reminder send failed", o.id, e);
      }
    }

    return new Response(JSON.stringify({ ok: true, processed, sent, flagged }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("reminders error", e);
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});