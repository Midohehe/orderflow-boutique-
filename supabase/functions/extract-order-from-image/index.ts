// Reads an order screenshot/image and extracts fields using Lovable AI (Gemini vision),
// then inserts a new order. Admin-only.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const image: string | undefined = body?.image; // data URL or base64
    const product_id: string | undefined = body?.product_id; // optional, to link & price
    const store_id: string | undefined = body?.store_id;

    if (!image) {
      return new Response(JSON.stringify({ error: "Missing image" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const ownerId = userData.user.id;

    // Load product list (optional, helps AI match product_name)
    const { data: products } = await admin
      .from("products")
      .select("id, name, price, colors, sizes, product_codes")
      .eq("owner_id", ownerId)
      .eq("is_visible", true);

    const productHints = (products || []).map((p) => {
      const colors = (p.colors || []).join("، ") || "—";
      const sizes = (p.sizes || []).join("، ") || "—";
      return `- "${p.name}" | السعر الافتراضي: ${p.price} | الألوان: [${colors}] | المقاسات: [${sizes}]`;
    }).join("\n");

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${Deno.env.get("LOVABLE_API_KEY")}`,
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: `أنت مساعد لاستخراج طلب من صورة بالعربية. الصورة قد تحتوي على عدة منتجات، لكل منتج عدة متغيرات (لون/مقاس) بكميات وأسعار مختلفة، ثم بيانات الزبون (اسم/هاتف/مدينة/منطقة).

الترتيب الشائع في النص:
- اسم منتج
- ثم تحته أسطر متغيرات بالشكل: "<لون> <مقاس>" ثم "الكمية N" ثم "السعر X" (السعر اختياري)
- يمكن أن يتكرر متغير ثاني تحت نفس المنتج
- ثم اسم منتج آخر بنفس الشكل
- في النهاية: المدينة والمنطقة وأحياناً الاسم والهاتف

قواعد صارمة جداً:
1) لكل سطر متغير أنشئ عنصراً مستقلاً في items[].
2) اسم المنتج (product_name) يجب أن يطابق اسماً من القائمة أدناه (مطابقة جزئية مقبولة). إن لم يطابق أي منتج، اترك product_name كما كُتب لكن ضع matched=false.
3) اللون (selected_color) يجب أن يكون من قائمة ألوان ذلك المنتج فقط. لا تخترع لوناً. إن لم يطابق، اتركه null.
4) المقاس (selected_size) يجب أن يكون من قائمة مقاسات ذلك المنتج فقط (حساس لحالة الأحرف غير مهم: xl=XL). لا تخترع مقاساً. إن لم يطابق، null.
5) الكمية (quantity) رقم صحيح، الافتراضي 1.
6) unit_price رقم اختياري إن ذُكر صراحة بجانب المتغير. لا تحسب أو تخمّن.
7) لا تنشئ سطر "إجمالي الكمية" — احسبها أنت لاحقاً من items.

بيانات الزبون (مرة واحدة لكل الطلب):
- city: المدينة الكبرى (طرابلس، بنغازي، مصراتة، الزاوية، سبها، البيضاء، طبرق، زليتن، الخمس...). إذا ذُكر حي فقط استنتج المدينة (تاجوراء→طرابلس، شبنه→بنغازي، قرجي→طرابلس).
- address: الحي/المنطقة التفصيلية.
- phone: أرقام فقط بدون مسافات.
- customer_name: إن وُجد.

أعد JSON عبر الأداة save_order بالشكل:
{ "items": [ { "product_name": str, "selected_color": str|null, "selected_size": str|null, "quantity": int, "unit_price": number|null } , ... ], "customer_name": str|null, "phone": str|null, "city": str|null, "address": str|null }

قائمة المنتجات المتاحة (التزم بها حرفياً للمطابقة):
${productHints || "(لا يوجد)"}`,
          },
          {
            role: "user",
            content: [
              { type: "text", text: "استخرج بيانات الطلب من الصورة:" },
              { type: "image_url", image_url: { url: image } },
            ],
          },
        ],
        tools: [{
          type: "function",
          function: {
            name: "save_order",
            description: "Save extracted order fields",
            parameters: {
              type: "object",
              properties: {
                items: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      product_name: { type: "string" },
                      selected_color: { type: "string" },
                      selected_size: { type: "string" },
                      quantity: { type: "number" },
                      unit_price: { type: "number" },
                    },
                    required: ["product_name", "quantity"],
                  },
                },
                customer_name: { type: "string" },
                phone: { type: "string" },
                city: { type: "string" },
                address: { type: "string" },
              },
              required: ["items"],
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "save_order" } },
      }),
    });

    if (!aiRes.ok) {
      const t = await aiRes.text();
      console.error("AI error", aiRes.status, t);
      return new Response(JSON.stringify({ error: "AI extraction failed", details: t }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ai = await aiRes.json();
    const argsStr = ai?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    if (!argsStr) {
      return new Response(JSON.stringify({ error: "Could not parse AI response", raw: ai }), {
        status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const fields = JSON.parse(argsStr);

    // Validate & match items strictly against the product list
    const norm = (s: any) => String(s || "").trim().toLowerCase();
    const rawItems: any[] = Array.isArray(fields.items) ? fields.items : [];
    if (rawItems.length === 0) {
      return new Response(JSON.stringify({ error: "لم يتم العثور على أي منتج في الصورة" }), {
        status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const matchedItems = rawItems.map((it) => {
      const nameRaw = String(it.product_name || "").trim();
      const n = norm(nameRaw);
      const prod = (products || []).find((p) =>
        norm(p.name) === n || norm(p.name).includes(n) || n.includes(norm(p.name))
      );
      const colorRaw = it.selected_color ? String(it.selected_color).trim() : null;
      const sizeRaw = it.selected_size ? String(it.selected_size).trim() : null;
      const color = prod && colorRaw
        ? (prod.colors || []).find((c: string) => norm(c) === norm(colorRaw)) || null
        : null;
      const size = prod && sizeRaw
        ? (prod.sizes || []).find((s: string) => norm(s) === norm(sizeRaw)) || null
        : null;
      const qty = Math.max(1, Math.min(999, Math.floor(Number(it.quantity) || 1)));
      const unit = prod ? Number(prod.price) : Number(it.unit_price) || 0;
      return {
        product_id: prod?.id || null,
        product_name: prod?.name || nameRaw || "غير محدد",
        selected_color: color,
        selected_size: size,
        quantity: qty,
        unit_price: unit,
        subtotal: unit * qty,
      };
    });

    const totalPrice = matchedItems.reduce((s, x) => s + x.subtotal, 0);
    const totalQuantity = matchedItems.reduce((s, x) => s + x.quantity, 0);
    const head = matchedItems[0];

    // Auto-match city via existing function (only if city/address provided)
    let matched_zone_id: number | null = null;
    let matched_area_id: number | null = null;
    let matched_zone_name: string | null = null;
    let matched_area_name: string | null = null;
    if (fields.city || fields.address) {
      try {
        const matchRes = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/match-city`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
          },
          body: JSON.stringify({ city: fields.city || "", address: fields.address || "", owner_id: ownerId }),
        });
        if (matchRes.ok) {
          const m = await matchRes.json();
          matched_zone_id = m.zone_id ?? null;
          matched_area_id = m.area_id ?? null;
          matched_zone_name = m.zone_name ?? null;
          matched_area_name = m.area_name ?? null;
        }
      } catch (e) { console.error("match-city failed", e); }
    }

    const { data: inserted, error: iErr } = await admin.from("orders").insert({
      owner_id: ownerId,
      store_id: store_id ?? null,
      customer_name: fields.customer_name || "بدون اسم",
      phone: String(fields.phone || ""),
      address: fields.address || "",
      city: fields.city || "",
      product_id: head.product_id,
      product_name: matchedItems.length > 1
        ? `${head.product_name} +${matchedItems.length - 1}`
        : head.product_name,
      price: totalPrice,
      quantity: totalQuantity,
      status: "pending",
      selected_color: head.selected_color,
      selected_size: head.selected_size,
      selected_product_code: null,
      matched_zone_id,
      matched_area_id,
      matched_zone_name,
      matched_area_name,
    }).select().maybeSingle();

    if (iErr) {
      console.error(iErr);
      return new Response(JSON.stringify({ error: iErr.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Insert order_items rows
    if (inserted?.id) {
      const rows = matchedItems.map((it) => ({
        order_id: inserted.id,
        owner_id: ownerId,
        store_id: store_id ?? null,
        product_id: it.product_id,
        product_name: it.product_name,
        quantity: it.quantity,
        price: it.unit_price,
        selected_color: it.selected_color,
        selected_size: it.selected_size,
      }));
      const { error: itemsErr } = await admin.from("order_items").insert(rows);
      if (itemsErr) console.error("order_items insert error", itemsErr);
    }

    return new Response(JSON.stringify({ ok: true, order: inserted, items: matchedItems, extracted: fields }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
