import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ---- TurboEx helpers (shipping price + city matching) ----
async function turboLogin(endpoint: string, email: string, password: string): Promise<string | null> {
  try {
    const r = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: `mutation Login($input: LoginInput!){login(input:$input){token}}`,
        variables: { input: { username: email, password, rememberMe: true } },
      }),
    });
    const j = await r.json();
    return j?.data?.login?.token || null;
  } catch { return null; }
}

async function calcShippingFee(opts: {
  endpoint: string; token: string;
  recipientZoneId: number; recipientSubzoneId: number;
  price: number; serviceId?: number;
}): Promise<{ delivery: number; total: number } | null> {
  try {
    const r = await fetch(opts.endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${opts.token}` },
      body: JSON.stringify({
        query: `query($input: CalculateShipmentFeesInput!){calculateShipmentFees(input:$input){delivery total amount tax}}`,
        variables: {
          input: {
            customerTypeCode: "MERCHANT",
            serviceId: opts.serviceId ?? 2,
            weight: 1,
            recipientZoneId: opts.recipientZoneId,
            recipientSubzoneId: opts.recipientSubzoneId,
            price: opts.price || 100,
            priceTypeCode: "EXCLD",
            paymentTypeCode: "COLC",
          },
        },
      }),
    });
    const j = await r.json();
    const f = j?.data?.calculateShipmentFees;
    if (!f) return null;
    return { delivery: Number(f.delivery) || 0, total: Number(f.total) || 0 };
  } catch { return null; }
}

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

    // Load owner's products (catalog for AI context)
    const { data: catalog } = await supabase
      .from("products")
      .select("id, name, slug, price, colors, sizes, stock, is_visible, description")
      .eq("owner_id", owner_id)
      .eq("is_visible", true)
      .is("deleted_at", null)
      .limit(80);
    const products = catalog || [];
    const catalogBrief = products.map((p: any) =>
      `• ${p.name} — ${p.price} (id:${p.id.slice(0, 8)}${p.colors?.length ? " | ألوان:" + p.colors.join("،") : ""}${p.sizes?.length ? " | مقاسات:" + p.sizes.join("،") : ""})`
    ).join("\n");

    // Currency
    const { data: storeSettings } = await supabase
      .from("store_settings").select("currency_symbol").eq("owner_id", owner_id).maybeSingle();
    const currency = storeSettings?.currency_symbol || "د.ل";

    // Detect product slug from any URL the customer sent (e.g. landing page /p/<slug>)
    let focusedProductInfo = "";
    try {
      const slugRegex = /\/p\/([a-zA-Z0-9_-]+)/g;
      const slugs: string[] = [];
      for (const m of (messages || [])) {
        if (m.direction !== "in" || !m.content) continue;
        let match: RegExpExecArray | null;
        const re = new RegExp(slugRegex.source, "g");
        while ((match = re.exec(m.content)) !== null) {
          if (match[1]) slugs.push(match[1]);
        }
      }
      const lastSlug = slugs[slugs.length - 1];
      if (lastSlug) {
        const focused = products.find((p: any) => p.slug === lastSlug)
          || (await supabase.from("products")
            .select("id, name, slug, price, colors, sizes, stock, description")
            .eq("owner_id", owner_id).eq("slug", lastSlug).maybeSingle()).data;
        if (focused) {
          focusedProductInfo = `
⭐ المنتج الذي دخل منه الزبون (من رابط صفحة الهبوط):
- الاسم: ${focused.name}
- المعرف: ${focused.id.slice(0, 8)}
- السعر: ${focused.price} ${currency}
${focused.colors?.length ? `- الألوان: ${focused.colors.join("، ")}\n` : ""}${focused.sizes?.length ? `- المقاسات: ${focused.sizes.join("، ")}\n` : ""}${focused.description ? `- الوصف: ${String(focused.description).replace(/<[^>]+>/g, "").slice(0, 300)}\n` : ""}
اعتبر هذا المنتج هو محور الحديث ما لم يطلب الزبون منتجاً آخر صراحةً.`;
        }
      }
    } catch (e) {
      console.error("focused product detect failed", e);
    }

    // Shipping creds (for tools)
    const { data: shipList } = await supabase
      .from("shipping_settings").select("email, password, endpoint, enabled").eq("owner_id", owner_id).limit(1);
    const shipCfg = shipList?.[0];

    // Local shipping price list (manual table)
    const { data: priceList } = await supabase
      .from("shipping_price_lists")
      .select("region, cities, price, duration")
      .order("sort_order", { ascending: true });
    const priceListText = (priceList || []).map((r: any) =>
      `- ${r.cities} (${r.region}): ${r.price} ${currency}${r.duration ? ` — مدة ${r.duration} يوم` : ""}`
    ).join("\n");

    const systemPrompt = `أنت مساعد ذكي لمتجر إلكتروني اسمه "LIBYA STORE". أنت تتحدث مع عميل عبر واتساب.

قواعد الرد:
1. اكتب باللهجة العربية العامية (العربية الفصحى البسيطة) لتكون أكثر حميمية.
2. كن مؤدباً، ودوداً، ومحترفاً.
3. أجب بإيجاز (2-4 أسطر كحد أقصى) ما لم يطلب العميل تفصيلاً.
4. إذا سأل عن طلبه السابق، استخدم معلومات الطلب المرفقة أدناه.
5. إذا سأل عن منتجاتنا أو أسعارها، استخدم قائمة المنتجات المرفقة بالأسفل.
6. إذا سأل عن سعر التوصيل لمدينة، استدعِ الأداة get_shipping_price.
7. إذا أراد الزبون تقديم طلب جديد عبر المحادثة:
   - اجمع: المنتج (من القائمة)، الكمية، اللون/المقاس إذا المنتج عنده خيارات، الاسم، العنوان، المدينة.
   - اعرض ملخص الطلب وسعر التوصيل قبل التأكيد.
   - بعد موافقة الزبون، **يجب** أن تستدعي الأداة create_order فوراً. ممنوع قول "تم حجز الطلب" أو "تم إنشاء الطلب" قبل أن تستدعي الأداة وتستلم نتيجة ok=true.
   - إذا استدعيت الأداة وأرجعت خطأ، أبلغ الزبون بالخطأ. لا تتظاهر بنجاح الطلب أبداً.
   - بعد نجاح create_order فقط، أخبر الزبون برقم الطلب الذي رجع من الأداة.
8. إذا أراد تأكيد طلب سابق: قل له "للتأكيد أرسل: 1 أو نعم".
9. إذا أراد إلغاء طلب: قل له "للإلغاء أرسل: 2 أو لا".
10. إذا لم تفهم سؤاله، قل: "سأقوم بتحويلك لموظف متخصص للمساعدة."
11. العملة: ${currency}.

${orderInfo}
${focusedProductInfo}

قائمة المنتجات المتاحة:
${catalogBrief || "(لا يوجد منتجات)"}

قائمة أسعار التوصيل (استخدمها مباشرة عند سؤال الزبون عن سعر التوصيل لمدينة):
${priceListText || "(لم تُعدّ بعد)"}
`;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY not configured");
      return new Response(JSON.stringify({ error: "AI not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ---- Tool definitions ----
    const tools = [
      {
        type: "function",
        function: {
          name: "get_shipping_price",
          description: "احسب سعر التوصيل لمدينة معينة عبر شركة الشحن. يعيد المبلغ بالعملة المحلية.",
          parameters: {
            type: "object",
            properties: {
              city: { type: "string", description: "اسم المدينة كما كتبه الزبون" },
              area: { type: "string", description: "اسم المنطقة الفرعية (اختياري)" },
              product_price: { type: "number", description: "سعر المنتج التقريبي (يؤثر على رسوم التحصيل)" },
            },
            required: ["city"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "create_order",
          description: "أنشئ طلباً جديداً في النظام بعد جمع كل بيانات الزبون والمنتج وموافقته.",
          parameters: {
            type: "object",
            properties: {
              product_id: { type: "string", description: "معرف المنتج من قائمة المنتجات" },
              quantity: { type: "number", description: "الكمية", minimum: 1 },
              customer_name: { type: "string" },
              address: { type: "string" },
              city: { type: "string" },
              selected_color: { type: "string" },
              selected_size: { type: "string" },
            },
            required: ["product_id", "quantity", "customer_name", "address", "city"],
          },
        },
      },
    ];

    const chatMessages: any[] = [
      { role: "system", content: systemPrompt },
      ...history,
    ];

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Tool runner
    const runTool = async (name: string, args: any): Promise<string> => {
      try {
        if (name === "get_shipping_price") {
          const city = String(args?.city || "").trim();
          if (!city) return JSON.stringify({ error: "city required" });
          // 1) match-city
          const mc = await fetch(`${SUPABASE_URL}/functions/v1/match-city`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_KEY}` },
            body: JSON.stringify({ city, address: args?.area || "", owner_id }),
          });
          const mj = await mc.json().catch(() => ({}));
          if (!mj?.zone_id || !mj?.area_id) {
            return JSON.stringify({ error: "لم نجد المدينة في قائمة الشحن", city });
          }
          // 2) calculate fee
          if (!shipCfg?.enabled) return JSON.stringify({ error: "shipping not configured", zone: mj.zone_name });
          const token = await turboLogin(shipCfg.endpoint || "https://turboex.ly:8001/graphql", shipCfg.email, shipCfg.password);
          if (!token) return JSON.stringify({ error: "shipping login failed" });
          const fee = await calcShippingFee({
            endpoint: shipCfg.endpoint || "https://turboex.ly:8001/graphql",
            token,
            recipientZoneId: Number(mj.zone_id),
            recipientSubzoneId: Number(mj.area_id),
            price: Number(args?.product_price) || 100,
          });
          if (!fee) return JSON.stringify({ error: "calc failed", zone: mj.zone_name, area: mj.area_name });
          return JSON.stringify({
            city: mj.zone_name,
            area: mj.area_name,
            shipping_fee: fee.delivery,
            currency,
          });
        }
        if (name === "create_order") {
          const pid = String(args?.product_id || "");
          const prod = products.find((p: any) => p.id === pid || p.id.startsWith(pid));
          if (!prod) return JSON.stringify({ error: "invalid product_id" });
          const r = await fetch(`${SUPABASE_URL}/functions/v1/create-order`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_KEY}` },
            body: JSON.stringify({
              product_id: prod.id,
              quantity: Math.max(1, Math.floor(Number(args?.quantity) || 1)),
              customer_name: String(args?.customer_name || "").slice(0, 120),
              phone,
              address: String(args?.address || "").slice(0, 500),
              city: String(args?.city || "").slice(0, 120),
              selected_color: args?.selected_color || null,
              selected_size: args?.selected_size || null,
              elapsed_ms: 999999,
            }),
          });
          const j = await r.json().catch(() => ({}));
          if (!r.ok) return JSON.stringify({ error: j?.error || "create_order failed" });
          // Find newly created order to return its short id
          const { data: latest } = await supabase
            .from("orders").select("id, order_code")
            .eq("owner_id", owner_id).eq("phone", phone)
            .order("created_at", { ascending: false }).limit(1);
          const ord = latest?.[0];
          if (ord) {
            // Link conversation to new order
            await supabase.from("whatsapp_conversations")
              .update({ order_id: ord.id }).eq("id", conversation_id);
          }
          return JSON.stringify({
            ok: true,
            order_code: ord?.order_code,
            order_id: ord?.id?.slice(0, 8),
            total: j?.price,
            currency,
          });
        }
        return JSON.stringify({ error: "unknown tool" });
      } catch (e) {
        return JSON.stringify({ error: e instanceof Error ? e.message : "tool failed" });
      }
    };

    // Agent loop (max 4 tool rounds)
    let replyText = "";
    for (let i = 0; i < 4; i++) {
      const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: chatMessages,
          tools,
          temperature: 0.5,
        }),
      });
      if (!aiRes.ok) {
        const text = await aiRes.text();
        console.error("AI gateway error:", aiRes.status, text);
        return new Response(JSON.stringify({ error: "AI gateway error" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const aiData = await aiRes.json();
      const msg = aiData.choices?.[0]?.message;
      if (!msg) break;
      const toolCalls = msg.tool_calls || [];
      console.log(`[ai-loop ${i}] tool_calls=${toolCalls.length} content_preview=${(msg.content||'').slice(0,80)}`);
      if (toolCalls.length === 0) {
        replyText = (msg.content || "").trim();
        break;
      }
      chatMessages.push({ role: "assistant", content: msg.content || "", tool_calls: toolCalls });
      for (const tc of toolCalls) {
        let args: any = {};
        try { args = JSON.parse(tc.function?.arguments || "{}"); } catch {}
        console.log(`[ai-loop ${i}] calling tool ${tc.function?.name} args=${JSON.stringify(args).slice(0,200)}`);
        const result = await runTool(tc.function?.name, args);
        console.log(`[ai-loop ${i}] tool ${tc.function?.name} result=${result.slice(0,200)}`);
        chatMessages.push({ role: "tool", tool_call_id: tc.id, content: result });
      }
    }

    if (!replyText) {
      replyText = "شكراً لتواصلك، سيرد عليك أحد ممثلينا قريباً.";
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
