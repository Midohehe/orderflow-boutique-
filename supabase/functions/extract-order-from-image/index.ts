// Reads order text (from browser OCR) or image (AI fallback), parses via templates,
// matches local products (including color/size variants), and creates the order.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { chatCompletions, getAiConfig, getAiModel } from "../_shared/ai-client.ts";
import {
  type CatalogProduct,
  findProduct,
  normAr,
  parseOrderText,
} from "../_shared/order-text-parser.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function decodeJwt(token: string): Record<string, unknown> | null {
  try {
    const part = token.split(".")[1];
    if (!part) return null;
    const b64 = part.replace(/-/g, "+").replace(/_/g, "/");
    const pad = b64.length % 4 ? "=".repeat(4 - (b64.length % 4)) : "";
    const jsonStr = new TextDecoder().decode(
      Uint8Array.from(atob(b64 + pad), (c) => c.charCodeAt(0)),
    );
    return JSON.parse(jsonStr);
  } catch {
    return null;
  }
}

function matchItems(rawItems: Record<string, unknown>[], catalog: CatalogProduct[]) {
  return rawItems.map((it) => {
    const nameRaw = String(it.product_name || "").trim();
    const prod = findProduct(nameRaw, catalog);
    const colorRaw = it.selected_color ? String(it.selected_color).trim() : null;
    const sizeRaw = it.selected_size ? String(it.selected_size).trim() : null;
    const color = prod && colorRaw
      ? (prod.colors || []).find((c) => normAr(c) === normAr(colorRaw)) || null
      : null;
    const size = prod && sizeRaw
      ? (prod.sizes || []).find((s) => normAr(s) === normAr(sizeRaw)) || null
      : null;
    const qty = Math.max(1, Math.min(999, Math.floor(Number(it.quantity) || 1)));
    const extractedUnit = Number(it.unit_price) || 0;
    const unit = extractedUnit > 0
      ? extractedUnit
      : prod
        ? Number(prod.price) || 0
        : 0;
    return {
      product_id: prod?.id || null,
      product_name: prod?.name || nameRaw || "غير محدد",
      selected_color: color,
      selected_size: size,
      quantity: qty,
      unit_price: unit,
      subtotal: unit * qty,
      matched: !!prod,
    };
  });
}

async function extractWithAi(image: string, catalog: CatalogProduct[]) {
  const productHints = catalog.map((p) => {
    const colors = (p.colors || []).join("، ") || "—";
    const sizes = (p.sizes || []).join("، ") || "—";
    return `- "${p.name}" | السعر: ${p.price} | الألوان: [${colors}] | المقاسات: [${sizes}]`;
  }).join("\n");

  const aiRes = await chatCompletions({
    model: getAiModel("google/gemini-2.5-flash"),
    messages: [
      {
        role: "system",
        content: `استخرج الطلب من الصورة بالعربية. أعد JSON عبر save_order.
قائمة المنتجات: ${productHints || "(لا يوجد)"}`,
      },
      {
        role: "user",
        content: [
          { type: "text", text: "استخرج بيانات الطلب:" },
          { type: "image_url", image_url: { url: image } },
        ],
      },
    ],
    tools: [{
      type: "function",
      function: {
        name: "save_order",
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
            shipping_fee: { type: "number" },
            total_price: { type: "number" },
          },
          required: ["items"],
        },
      },
    }],
    tool_choice: { type: "function", function: { name: "save_order" } },
  });

  if (!aiRes.ok) throw new Error("فشل استخراج البيانات بالذكاء الاصطناعي");
  const ai = await aiRes.json();
  const argsStr = ai?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
  if (!argsStr) throw new Error("لم يتمكن الذكاء الاصطناعي من قراءة الصورة");
  return JSON.parse(argsStr) as Record<string, unknown>;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "يجب تسجيل الدخول" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const token = authHeader.replace(/^Bearer\s+/i, "");
    const claims = decodeJwt(token);
    let userId = (claims?.sub as string) || null;
    if (!userId) {
      const { data: userData } = await admin.auth.getUser(token);
      userId = userData?.user?.id || null;
    }
    if (!userId || claims?.role === "anon") {
      return new Response(JSON.stringify({ error: "يجب تسجيل الدخول" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: effOwner } = await admin.rpc("get_effective_owner_id", { _uid: userId });
    const ownerId = (effOwner as string) || userId;

    const body = await req.json();
    const text: string | undefined = body?.text;
    const image: string | undefined = body?.image;
    const store_id: string | undefined = body?.store_id;

    if (!text?.trim() && !image) {
      return new Response(JSON.stringify({ error: "Missing text or image" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let productQuery = admin
      .from("products")
      .select("id, name, price, colors, sizes, product_codes")
      .eq("owner_id", ownerId)
      .eq("is_visible", true)
      .is("deleted_at", null);
    if (store_id) productQuery = productQuery.eq("store_id", store_id);

    const { data: products, error: prodErr } = await productQuery;
    if (prodErr) {
      return new Response(JSON.stringify({ error: "تعذر تحميل المنتجات" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const catalog = (products || []) as CatalogProduct[];
    let fields: Record<string, unknown>;
    let parseMethod = "template";

    if (text?.trim()) {
      const parsed = parseOrderText(text, catalog);
      if (!parsed || parsed.items.length === 0) {
        return new Response(JSON.stringify({
          error: "لم يتم التعرف على الطلب من النص",
          hint: "تأكد أن الصورة واضحة أو أن النص يطابق نموذج واتساب (منتج → سعر+توصيل → هاتف → إجمالي)",
          ocr_preview: text.slice(0, 400),
        }), {
          status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      fields = {
        items: parsed.items,
        customer_name: parsed.customer_name,
        phone: parsed.phone,
        city: parsed.city,
        address: parsed.address,
        shipping_fee: parsed.shipping_fee,
        total_price: parsed.total_price,
        template: parsed.template,
      };
    } else if (image && getAiConfig().apiKey) {
      parseMethod = "ai";
      fields = await extractWithAi(image, catalog);
    } else {
      return new Response(JSON.stringify({
        error: "تعذر قراءة الصورة",
        hint: "جرّب صورة أوضح، أو فعّل OCR من المتصفح",
      }), {
        status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const rawItems: Record<string, unknown>[] = Array.isArray(fields.items) ? fields.items : [];
    if (rawItems.length === 0) {
      return new Response(JSON.stringify({ error: "لم يتم العثور على أي منتج" }), {
        status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const shippingFee = Math.max(0, Number(fields.shipping_fee) || 0);
    const extractedTotal = Number(fields.total_price) || 0;
    const matchedItems = matchItems(rawItems, catalog);
    const productSubtotal = matchedItems.reduce((s, x) => s + x.subtotal, 0);
    const totalQuantity = matchedItems.reduce((s, x) => s + x.quantity, 0);
    const head = matchedItems[0];

    let orderPrice = productSubtotal;
    let shippingIncluded = false;
    if (extractedTotal > 0 && shippingFee > 0 && Math.abs(extractedTotal - (productSubtotal + shippingFee)) <= 2) {
      orderPrice = productSubtotal;
    } else if (extractedTotal > 0 && shippingFee === 0 && extractedTotal > productSubtotal) {
      orderPrice = extractedTotal;
      shippingIncluded = true;
    } else if (extractedTotal > 0 && productSubtotal === 0) {
      orderPrice = extractedTotal;
    }

    let matched_zone_id: number | null = null;
    let matched_area_id: number | null = null;
    let matched_zone_name: string | null = null;
    let matched_area_name: string | null = null;
    const cityStr = String(fields.city || "").trim();
    const addressStr = String(fields.address || "").trim();

    if (cityStr || addressStr) {
      try {
        const matchRes = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/match-city`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
          },
          body: JSON.stringify({ city: cityStr, address: addressStr, owner_id: ownerId }),
        });
        if (matchRes.ok) {
          const m = await matchRes.json();
          matched_zone_id = m.zone_id ?? null;
          matched_area_id = m.area_id ?? null;
          matched_zone_name = m.zone_name ?? null;
          matched_area_name = m.area_name ?? null;
        }
      } catch (e) {
        console.error("match-city failed", e);
      }
    }

    const { data: inserted, error: iErr } = await admin.from("orders").insert({
      owner_id: ownerId,
      store_id: store_id ?? null,
      customer_name: String(fields.customer_name || "").trim() || "بدون اسم",
      phone: String(fields.phone || "").replace(/\D/g, ""),
      address: addressStr || matched_area_name || "",
      city: cityStr || matched_zone_name || "",
      product_id: head.product_id,
      product_name: matchedItems.length > 1
        ? `${head.product_name} +${matchedItems.length - 1}`
        : head.product_name,
      price: orderPrice,
      quantity: totalQuantity,
      status: "pending",
      selected_color: head.selected_color,
      selected_size: head.selected_size,
      selected_product_code: null,
      shipping_included: shippingIncluded,
      matched_zone_id,
      matched_area_id,
      matched_zone_name,
      matched_area_name,
    }).select().maybeSingle();

    if (iErr) {
      return new Response(JSON.stringify({ error: iErr.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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

    const unmatched = matchedItems.filter((it) => !it.matched).map((it) => it.product_name);

    return new Response(JSON.stringify({
      ok: true,
      order: inserted,
      items: matchedItems,
      extracted: fields,
      parse_method: parseMethod,
      shipping_fee: shippingFee || null,
      unmatched_products: unmatched.length ? unmatched : undefined,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
