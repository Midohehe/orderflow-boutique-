import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { owner_id, conversation_id, phone } = await req.json();
    if (!owner_id || !conversation_id || !phone) {
      return new Response(JSON.stringify({ error: "Missing params" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Load settings
    const { data: settings } = await supabase
      .from("whatsapp_settings")
      .select("*")
      .eq("owner_id", owner_id)
      .maybeSingle();

    if (!settings || !settings.ai_auto_reply_enabled) {
      return new Response(JSON.stringify({ skipped: true, reason: "ai disabled" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Load conversation history (last 15 messages)
    const { data: messages } = await supabase
      .from("whatsapp_messages")
      .select("direction, content, message_type, created_at")
      .eq("conversation_id", conversation_id)
      .order("created_at", { ascending: false })
      .limit(15);

    const history = (messages || [])
      .reverse()
      .map((m) => {
        const role = m.direction === "in" ? "user" : "assistant";
        let text = m.content || "";
        if (m.message_type === "image") text = text ? `📷 صورة: ${text}` : "📷 صورة";
        if (m.message_type === "audio") text = "🎤 رسالة صوتية";
        if (m.message_type === "file") text = "📎 ملف";
        return { role, content: text };
      });

    // Load linked order details
    const { data: conv } = await supabase
      .from("whatsapp_conversations")
      .select("order_id, customer_name")
      .eq("id", conversation_id)
      .single();

    let orderInfo = "";
    if (conv?.order_id) {
      const { data: order } = await supabase
        .from("orders")
        .select("id, customer_name, product_name, price, status, confirmation_status, city, address, created_at")
        .eq("id", conv.order_id)
        .single();
      if (order) {
        const { data: items } = await supabase
          .from("order_items")
          .select("product_name, quantity, price, selected_color, selected_size")
          .eq("order_id", order.id);
        const lines = (items || []).map(
          (it) => `${it.product_name} ×${it.quantity}${it.selected_color ? " - " + it.selected_color : ""}${it.selected_size ? " - " + it.selected_size : ""}`
        );
        orderInfo = `
طلب مرتبط بالمحادثة:
- رقم الطلب: ${order.id.slice(0, 8)}...
- العميل: ${order.customer_name || "—"}
- المنتجات: ${lines.join(" / ") || order.product_name}
- السعر: ${order.price}
- حالة الطلب: ${order.status}
- حالة التأكيد: ${order.confirmation_status}
- المدينة: ${order.city || "—"}
- العنوان: ${order.address || "—"}`;
      }
    }

    const systemPrompt = `أنت مساعد ذكي لمتجر إلكتروني اسمه "LIBYA STORE". أنت تتحدث مع عميل عبر واتساب.

قواعد الرد:
1. اكتب باللهجة العربية العامية (العربية الفصحى البسيطة) لتكون أكثر حميمية.
2. كن مؤدباً، ودوداً، ومحترفاً.
3. أجب بإيجاز (2-4 أسطر كحد أقصى) ما لم يطلب العميل تفصيلاً.
4. إذا سأل عن طلبه، استخدم معلومات الطلب المرفقة أدناه.
5. إذا سأل عن منتجات، أخبره أنه يمكنه تصفح المتجر أو تقديم طلب جديد.
6. إذا أراد تأكيد طلب: قل له "للتأكيد أرسل: 1 أو نعم".
7. إذا أراد إلغاء طلب: قل له "للإلغاء أرسل: 2 أو لا".
8. إذا لم تفهم سؤاله أو لا تستطيع مساعدته، قل: "سأقوم بتحويلك لموظف متخصص للمساعدة." ولا تحاول التخمين.
9. لا تطلب معلومات شخصية (رقم بطاقة، رقم هاتف) من العميل.
10. وقّع رسائلك بـ "فريق LIBYA STORE" أو لا توقع إذا كانت الرسالة قصيرة جداً.

${orderInfo}`;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY not configured");
      return new Response(JSON.stringify({ error: "AI not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          ...history,
        ],
        temperature: 0.6,
      }),
    });

    if (!aiRes.ok) {
      const text = await aiRes.text();
      console.error("AI gateway error:", aiRes.status, text);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiRes.json();
    const replyText = aiData.choices?.[0]?.message?.content?.trim() || "";
    if (!replyText) {
      return new Response(JSON.stringify({ error: "Empty AI response" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Send via Green API
    const chatId = `${phone}@c.us`;
    const base = `${settings.api_url.replace(/\/$/, "")}/waInstance${settings.instance_id}`;
    const greenRes = await fetch(`${base}/sendMessage/${settings.api_token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chatId, message: replyText }),
    });
    const greenData = await greenRes.json().catch(() => ({}));

    // Store outgoing message
    await supabase.from("whatsapp_messages").insert({
      owner_id: owner_id,
      conversation_id: conversation_id,
      order_id: conv?.order_id || null,
      direction: "out",
      message_type: "text",
      content: replyText,
      status: greenData?.idMessage ? "sent" : "failed",
      green_message_id: greenData?.idMessage || null,
    });

    await supabase.from("whatsapp_conversations").update({
      last_message_at: new Date().toISOString(),
      last_message_preview: replyText.slice(0, 120),
    }).eq("id", conversation_id);

    return new Response(JSON.stringify({ sent: true, text: replyText }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("whatsapp-ai-reply error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
