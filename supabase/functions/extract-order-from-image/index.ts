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
      .select("id, name, price")
      .eq("owner_id", ownerId)
      .eq("is_visible", true);

    const productHints = (products || []).map((p) => `- ${p.name}`).join("\n");

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
            content: `أنت مساعد ذكي لاستخراج بيانات طلب من صورة بالعربية (سكرين شوت محادثة، ورقة، أو نموذج). النص قد يكون غير مرتب — حدد كل حقل بناءً على معناه لا على موقعه.

اقرأ كل النص ثم استخرج بالترتيب التالي مع التحقق:

1) product_name — اسم المنتج: ابحث أولاً عن أي اسم يطابق قائمة المنتجات أدناه (مطابقة جزئية مقبولة). إن لم يوجد فاستخدم أبرز اسم منتج مذكور.
2) city + address — المدينة والمنطقة: أي ذكر لمكان في ليبيا. المدينة الكبرى (طرابلس، بنغازي، مصراتة، الزاوية، سبها، البيضاء، طبرق، زليتن، الخمس، إلخ) تذهب في city، والحي/المنطقة التفصيلية (تاجوراء، الفرناج، قرجي، إلخ) تذهب في address. إذا ذُكر حي فقط استنتج المدينة منه (تاجوراء→طرابلس، قرجي→طرابلس).
3) phone — رقم الهاتف: أي تسلسل أرقام ليبي (يبدأ غالباً بـ 09 أو +218)، استخرج الأرقام فقط.
4) quantity — عدد القطع: ابحث عن "قطعة/قطع/حبة/عدد/×/x" أو رقم بجانب كلمة كمية. الافتراضي 1.
5) variant + selected_color + selected_size — أي تفاصيل الفايرنت: اللون (أحمر، أزرق...)، المقاس (S/M/L/40/42)، الموديل/النوع.
6) customer_name — اسم الزبون إن وُجد.
7) price — السعر الإجمالي رقم فقط بدون عملة، إن ذُكر.

قواعد صارمة:
- لا تخلط بين city و address. لو وجدت حياً فقط، ضعه في address واستنتج city.
- phone أرقام فقط بدون مسافات أو رموز.
- تجاهل الشعارات والإعلانات والتوقيعات والتواريخ.
- إن لم يوجد حقل اتركه null عدا product_name و quantity.

أخرج JSON فقط بهذه الحقول:
{ "product_name": string, "variant": string|null, "selected_color": string|null, "selected_size": string|null, "quantity": number, "price": number|null, "customer_name": string|null, "phone": string|null, "city": string|null, "address": string|null }
${productHints ? `\nقائمة المنتجات للمطابقة (طابق أقرب اسم منها إن أمكن):\n${productHints}` : ""}`,
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
                product_name: { type: "string" },
                variant: { type: "string" },
                selected_color: { type: "string" },
                selected_size: { type: "string" },
                quantity: { type: "number" },
                price: { type: "number" },
                customer_name: { type: "string" },
                phone: { type: "string" },
                city: { type: "string" },
                address: { type: "string" },
              },
              required: ["product_name", "quantity"],
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

    // Match product
    let matchedProduct = products?.find((p) => p.id === product_id);
    if (!matchedProduct && fields.product_name) {
      const n = String(fields.product_name).trim().toLowerCase();
      matchedProduct = products?.find((p) =>
        p.name.toLowerCase() === n || p.name.toLowerCase().includes(n) || n.includes(p.name.toLowerCase())
      );
    }

    const quantity = Math.max(1, Math.min(999, Math.floor(Number(fields.quantity) || 1)));
    const price = matchedProduct
      ? Number(matchedProduct.price) * quantity
      : Number(fields.price) || 0;

    const variantNotes = [
      fields.variant ? `الفايرنت: ${fields.variant}` : null,
      fields.selected_color ? `اللون: ${fields.selected_color}` : null,
      fields.selected_size ? `المقاس: ${fields.selected_size}` : null,
    ].filter(Boolean).join(" / ");

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
      customer_name: fields.customer_name || "بدون اسم",
      phone: String(fields.phone || ""),
      address: fields.address || "",
      city: fields.city || "",
      product_id: matchedProduct?.id || null,
      product_name: matchedProduct?.name || fields.product_name || "غير محدد",
      price,
      quantity,
      status: "pending",
      selected_color: fields.selected_color || null,
      selected_size: fields.selected_size || null,
      selected_product_code: variantNotes || null,
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

    return new Response(JSON.stringify({ ok: true, order: inserted, extracted: fields }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
