// Public edge function to create an order with server-side price recomputation.
// Prevents clients from spoofing the price written to the database.
import { checkoutFingerprint } from "../_shared/checkout-request.ts";
import { resolveLandingCurrency } from "../_shared/currencies.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { customerCityForMatching } from "../_shared/customerCityForMatching.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface OrderPayload {
  request_id?: string;
  checkout_token?: string;
  product_id?: string;
  quantity?: number;
  customer_name?: string;
  phone?: string;
  address?: string;
  city?: string;
  governorate?: string | null;
  selected_color?: string | null;
  selected_size?: string | null;
  selected_product_code?: string | null;
  shipping_included?: boolean;
  upsell_index?: number | null;
  landing_slug?: string | null;
  accepted_offer_id?: string | null;
  /** Append offer products to an existing order (post-purchase) */
  append_to_order_id?: string | null;
  items?: Array<{
    color?: string | null;
    size?: string | null;
    product_code?: string | null;
    quantity?: number;
  }> | null;
}

type OfferLine = {
  product_id: string;
  product_name: string;
  quantity: number;
  price: number;
  original_price?: number;
  image?: string | null;
};

async function resolveOfferExtraItems(
  supabase: ReturnType<typeof createClient>,
  acceptedOfferId: string,
  storeId: string,
  excludeProductId?: string | null,
): Promise<{ lines: OfferLine[]; mode: string; waivesShipping: boolean }> {
  const { data: offerRow } = await supabase
    .from("offers")
    .select("id, store_id, status, pricing")
    .eq("id", acceptedOfferId)
    .eq("store_id", storeId)
    .eq("status", "active")
    .maybeSingle();

  if (!offerRow) return { lines: [], mode: "", waivesShipping: false };

  const pricing = (offerRow as { pricing?: Record<string, unknown> }).pricing || {};
  const mode = String(pricing.mode || "");
  const waivesShipping = mode === "free_shipping";

  const { data: offerProducts } = await supabase
    .from("offer_products")
    .select("product_id, sort_order, is_default")
    .eq("offer_id", acceptedOfferId)
    .order("sort_order");

  const extraIds = (offerProducts || [])
    .map((p: { product_id?: string | null }) => p.product_id)
    .filter((id: string | null | undefined): id is string => !!id && id !== excludeProductId);

  if (extraIds.length === 0) return { lines: [], mode, waivesShipping };

  const { data: extraProducts } = await supabase
    .from("products")
    .select("id, name, price, images, store_id")
    .in("id", extraIds)
    .eq("store_id", storeId);

  const lines: OfferLine[] = [];
  for (const ep of extraProducts || []) {
    const original = Number((ep as { price?: number }).price) || 0;
    let linePrice = original;
    if (mode === "free_product") {
      linePrice = 0;
    } else if (mode === "custom_price" && Number(pricing.customPrice) >= 0) {
      linePrice = Number(pricing.customPrice) || 0;
    } else if (mode === "fixed_discount") {
      linePrice = Math.max(0, original - (Number(pricing.fixedDiscount) || 0));
    } else if (mode === "percent_discount") {
      const pct = Math.max(0, Math.min(100, Number(pricing.percentDiscount) || 0));
      linePrice = Math.max(0, Number((original * (1 - pct / 100)).toFixed(2)));
    }
    const imgs = (ep as { images?: unknown }).images;
    const image = Array.isArray(imgs) && imgs.length ? String(imgs[0]) : null;
    lines.push({
      product_id: (ep as { id: string }).id,
      product_name: (ep as { name: string }).name,
      quantity: 1,
      price: linePrice,
      original_price: original,
      image,
    });
  }
  return { lines, mode, waivesShipping };
}

function s(v: unknown, max = 200): string {
  if (typeof v !== "string") return "";
  return v.trim().slice(0, max);
}

function generateFallbackOrderCode(): string {
  const epochPart = Date.now().toString().slice(-7);
  const randomPart = Math.floor(Math.random() * 900 + 100).toString();
  return `${epochPart}${randomPart}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  if (req.method !== "POST") return new Response(null, {status:405,headers:corsHeaders});
  try {
    const body = (await req.json()) as OrderPayload;
    const requestId = body.request_id || crypto.randomUUID();
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(requestId)) {
      return new Response(JSON.stringify({error:'invalid_request_id'}),{status:400,headers:{...corsHeaders,'Content-Type':'application/json'}});
    }
    const fingerprint = await checkoutFingerprint(body as unknown as Record<string,unknown>);

    // Capture client IP & user-agent (used for both real & rejected orders).
    const clientIp =
      req.headers.get("cf-connecting-ip") ||
      (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() ||
      req.headers.get("x-real-ip") ||
      null;
    const userAgent = req.headers.get("user-agent") || null;

    // Detect customer country (Cloudflare provides cf-ipcountry on was-la.com;
    // fallback to ipapi.co lookup when missing). Never blocks the order — only
    // tags it so the dashboard can route non-Libya orders to a separate tab.
    let countryCode: string | null =
      (req.headers.get("cf-ipcountry") || "").toUpperCase().trim() || null;
    if (countryCode === "XX" || countryCode === "T1") countryCode = null;
    if (!countryCode && clientIp) {
      try {
        const ctrl = new AbortController();
        const tid = setTimeout(() => ctrl.abort(), 1500);
        const r = await fetch(`https://ipapi.co/${clientIp}/country/`, { signal: ctrl.signal });
        clearTimeout(tid);
        if (r.ok) {
          const t = (await r.text()).trim().toUpperCase();
          if (/^[A-Z]{2}$/.test(t)) countryCode = t;
        }
      } catch (_e) { /* ignore — country stays null */ }
    }

    // (rejected_orders logging removed — feature deleted)
    const logRejected = async (_reason: string) => { /* no-op */ };

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const {data: receipt, error: receiptError} = await supabase.from('checkout_requests').select('fingerprint,response').eq('request_id',requestId).maybeSingle();
    if (receiptError) throw receiptError;
    if (receipt) {
      if (receipt.fingerprint !== fingerprint) return new Response(JSON.stringify({error:'checkout_request_conflict'}),{status:409,headers:{...corsHeaders,'Content-Type':'application/json'}});
      return new Response(JSON.stringify({...receipt.response,replayed:true}),{headers:{...corsHeaders,'Content-Type':'application/json'}});
    }

    // ── Post-purchase: append offer lines to an existing order ──────────────
    const appendOrderId = s(body.append_to_order_id ?? "", 64) || null;
    const appendOfferId = s(body.accepted_offer_id ?? "", 64) || null;
    if (appendOrderId && appendOfferId) {
      const { data: existing, error: exErr } = await supabase
        .from("orders")
        .select("id, store_id, owner_id, product_id, product_name, price, shipping_fee, quantity")
        .eq("id", appendOrderId)
        .maybeSingle();

      if (exErr || !existing) {
        return new Response(JSON.stringify({ error: "Order not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const storeId = (existing as { store_id?: string | null }).store_id;
      if (!storeId) {
        return new Response(JSON.stringify({ error: "Order has no store" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { lines, waivesShipping } = await resolveOfferExtraItems(
        supabase,
        appendOfferId,
        storeId,
        (existing as { product_id?: string }).product_id,
      );

      if (lines.length === 0) {
        return new Response(JSON.stringify({ error: "Offer has no products" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const {data:committed,error:commitError}=await supabase.rpc('commit_checkout_offer',{
        _request_id:requestId,_fingerprint:fingerprint,_parent_request_id:body.checkout_token || null,
        _order_id:appendOrderId,_offer_id:appendOfferId,_items:lines,_waives_shipping:waivesShipping,
      });
      if(commitError || !committed?.ok) return new Response(JSON.stringify({error:'تعذر إضافة العرض؛ الطلب الأصلي محفوظ'}),{status:409,headers:{...corsHeaders,'Content-Type':'application/json'}});
      // Items, totals and stock have already committed together.
      return new Response(JSON.stringify(committed),{headers:{...corsHeaders,'Content-Type':'application/json'}});
    }

    const product_id = s(body.product_id, 64);
    let quantity = Math.max(1, Math.min(999, Math.floor(Number(body.quantity) || 1)));
    const upsellIndex =
      body.upsell_index === null || body.upsell_index === undefined
        ? null
        : Math.floor(Number(body.upsell_index));
    const customer_name = s(body.customer_name, 120);
    const phone = s(body.phone, 40);
    const address = s(body.address, 500);
    const city = s(body.city, 120);
    const governorate = s(body.governorate ?? "", 120);

    if (!product_id || !phone) {
      console.error("Missing required fields", { product_id, phone });
      await logRejected(!product_id ? "missing_product_id" : "missing_phone");
      return new Response(JSON.stringify({ error: "Missing required fields (product/phone)" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Authoritative price lookup
    const { data: product, error: pErr } = await supabase
      .from("products")
      .select("id, name, price, is_visible, owner_id, store_id, upsell_enabled, upsell_offers, colors, sizes")
      .eq("id", product_id)
      .is("deleted_at", null)
      .maybeSingle();

    if (pErr || !product || !product.is_visible) {
      await logRejected("product_unavailable");
      return new Response(JSON.stringify({ error: "Product unavailable" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Server-side variant validation: if the product defines colors/sizes,
    // each ordered piece MUST carry a matching selection. This blocks
    // bots and scripts that bypass the client form.
    const productColors = Array.isArray((product as any).colors) ? (product as any).colors.filter(Boolean) : [];
    const productSizes = Array.isArray((product as any).sizes) ? (product as any).sizes.filter(Boolean) : [];
    const requiresColor = productColors.length > 0;
    const requiresSize = productSizes.length > 0;
    if (requiresColor || requiresSize) {
      const items = Array.isArray(body.items) && body.items.length > 0
        ? body.items
        : [{
            color: body.selected_color,
            size: body.selected_size,
            product_code: body.selected_product_code,
            quantity,
          }];
      for (const it of items) {
        const c = s(it?.color ?? "", 200);
        const sz = s(it?.size ?? "", 200);
        if (requiresColor && !c) {
          await logRejected("missing_variant_color");
          return new Response(JSON.stringify({ error: "missing_variant_color" }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (requiresSize && !sz) {
          await logRejected("missing_variant_size");
          return new Response(JSON.stringify({ error: "missing_variant_size" }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (requiresColor && !productColors.includes(c)) {
          await logRejected("invalid_variant_color");
          return new Response(JSON.stringify({ error: "invalid_variant_color" }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (requiresSize && !productSizes.includes(sz)) {
          await logRejected("invalid_variant_size");
          return new Response(JSON.stringify({ error: "invalid_variant_size" }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
    }

    let totalPrice = Number(product.price) * quantity;

    // Upsell is controlled exclusively by the landing page. If no landing page,
    // no upsell — period.
    let upsellEnabled = false;
    let upsellOffers: any[] = [];
    let landingCurrencyCode: string | null = null;
    let orderFormPresetId: string | null = null;
    const landingSlug = s(body.landing_slug ?? "", 200);
    if (landingSlug) {
      const { data: lp, error: landingError } = await supabase
        .from("landing_pages")
        .select("price, currency_code, is_visible, upsell_enabled, upsell_offers, order_form_preset_id")
        .eq("slug", landingSlug)
        .eq("product_id", product.id)
        .maybeSingle();
      if (landingError) throw landingError;
      if (lp) {
        if (lp.is_visible === false) return new Response(JSON.stringify({error:'Product unavailable'}),{status:404,headers:{...corsHeaders,'Content-Type':'application/json'}});
        landingCurrencyCode = lp.currency_code ?? null;
        orderFormPresetId = (lp as { order_form_preset_id?: string | null }).order_form_preset_id ?? null;
        if (lp.price !== null && lp.price !== undefined && Number(lp.price) >= 0) {
          totalPrice = Number(lp.price) * quantity;
        }
        upsellEnabled = !!lp.upsell_enabled;
        upsellOffers = Array.isArray(lp.upsell_offers) ? lp.upsell_offers : [];
      }
    }

    if (upsellIndex !== null && upsellEnabled && upsellOffers.length > 0) {
      const offer = upsellOffers[upsellIndex];
      if (offer && Number(offer.quantity) > 0 && Number(offer.price) > 0) {
        quantity = Math.max(1, Math.min(999, Math.floor(Number(offer.quantity))));
        totalPrice = Number(offer.price);
      }
    }

    const storeId = (product as { store_id?: string | null }).store_id ?? null;
    // Resolve the authoritative currency from the matched page and its store,
    // never from a currency supplied by the browser. Preserve it on the order.
    let currencyQuery = supabase.from("store_settings")
      .select("currency_code, currency_symbol").eq("owner_id", product.owner_id);
    if (storeId) currencyQuery = currencyQuery.eq("store_id", storeId);
    const { data: currencySettings, error: currencyError } = await currencyQuery.limit(1).maybeSingle();
    if (currencyError) throw currencyError;
    const orderCurrency = resolveLandingCurrency(landingCurrencyCode, currencySettings);
    const acceptedOfferId = s(body.accepted_offer_id ?? "", 64) || null;
    let offerWaivesShipping = false;
    let offerExtraItems: OfferLine[] = [];

    if (acceptedOfferId && storeId) {
      const resolved = await resolveOfferExtraItems(supabase, acceptedOfferId, storeId, product.id);
      offerWaivesShipping = resolved.waivesShipping;
      offerExtraItems = resolved.lines;
      if (offerExtraItems.length > 0) {
        for (const line of offerExtraItems) {
          totalPrice = Number((totalPrice + line.price * line.quantity).toFixed(2));
        }
      } else if (resolved.mode === "percent_discount") {
        const { data: offerRow } = await supabase
          .from("offers")
          .select("pricing")
          .eq("id", acceptedOfferId)
          .maybeSingle();
        const pricing = (offerRow as { pricing?: Record<string, unknown> } | null)?.pricing || {};
        const pct = Math.max(0, Math.min(100, Number(pricing.percentDiscount) || 0));
        totalPrice = Math.max(0, Number((totalPrice * (1 - pct / 100)).toFixed(2)));
      } else if (resolved.mode === "fixed_discount") {
        const { data: offerRow } = await supabase
          .from("offers")
          .select("pricing")
          .eq("id", acceptedOfferId)
          .maybeSingle();
        const pricing = (offerRow as { pricing?: Record<string, unknown> } | null)?.pricing || {};
        const fixed = Math.max(0, Number(pricing.fixedDiscount) || 0);
        totalPrice = Math.max(0, Number((totalPrice - fixed).toFixed(2)));
      } else if (resolved.mode === "custom_price") {
        const { data: offerRow } = await supabase
          .from("offers")
          .select("pricing")
          .eq("id", acceptedOfferId)
          .maybeSingle();
        const pricing = (offerRow as { pricing?: Record<string, unknown> } | null)?.pricing || {};
        const custom = Number(pricing.customPrice);
        if (custom >= 0) totalPrice = Number(custom.toFixed(2));
      }
    }
    let shippingFee = 0;

    let deliveryPricingEnabled = false;
    if (orderFormPresetId) {
      const { data: preset } = await supabase
        .from("order_form_presets")
        .select("fields")
        .eq("id", orderFormPresetId)
        .maybeSingle();
      const presetFields = Array.isArray((preset as { fields?: unknown } | null)?.fields)
        ? (preset as { fields: Array<{ field_key?: string; field_type?: string; enabled?: boolean }> }).fields
        : [];
      deliveryPricingEnabled = presetFields.some(
        (f) =>
          f?.enabled !== false &&
          (f.field_key === "delivery_city" || f.field_type === "delivery_select"),
      );
    } else if (storeId) {
      const { data: deliveryField } = await supabase
        .from("order_form_fields")
        .select("id")
        .eq("store_id", storeId)
        .eq("field_key", "delivery_city")
        .eq("enabled", true)
        .maybeSingle();
      deliveryPricingEnabled = !!deliveryField;
    }

    if (storeId && deliveryPricingEnabled && city && city !== "—") {
      const { data: priceRows } = await supabase.rpc("get_public_delivery_prices", {
        _store_id: storeId,
      });
      const prices = Array.isArray(priceRows) ? priceRows : [];
      if (prices.length > 0) {
        const match = prices.find((p: { city_name?: string }) => p.city_name === city);
        if (!match) {
          await logRejected("invalid_delivery_city");
          return new Response(JSON.stringify({ error: "invalid_delivery_city" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        shippingFee = Number((match as { price?: number }).price) || 0;
      }
    }

    if (offerWaivesShipping) shippingFee = 0;

    // Commit the complete checkout before acknowledging success. City matching
    // and notifications can continue after the order, items and stock are safe.
    const orderCode = generateFallbackOrderCode();

    const offerNameSuffix = offerExtraItems.length
      ? ` + ${offerExtraItems.map((l) => l.product_name).join(" + ")}`
      : "";
    const orderProductName = `${product.name}${offerNameSuffix}`.slice(0, 500);

    const orderData = {
      owner_id: (product as any).owner_id,
      store_id: (product as any).store_id ?? null,
      customer_name: customer_name || "بدون اسم",
      phone,
      address: address || "—",
      city: city || "—",
      governorate: governorate || null,
      product_id: product.id,
      product_name: orderProductName,
      currency_code: orderCurrency.currency_code,
      price: totalPrice,
      shipping_fee: shippingFee,
      quantity: quantity + offerExtraItems.reduce((sum, line) => sum + line.quantity, 0),
      status: "pending",
      selected_color: s(body.selected_color ?? "", 200) || null,
      selected_size: s(body.selected_size ?? "", 200) || null,
      selected_product_code: s(body.selected_product_code ?? "", 200) || null,
      shipping_included: body.shipping_included === true,
      upsell_offers: upsellOffers && upsellOffers.length > 0 ? upsellOffers : [],
      client_ip: clientIp,
      user_agent: userAgent,
      country_code: countryCode,
      utm_source: s(body.utm_source ?? "", 120) || null,
      utm_medium: s(body.utm_medium ?? "", 120) || null,
      utm_campaign: s(body.utm_campaign ?? "", 200) || null,
      utm_content: s(body.utm_content ?? "", 200) || null,
      utm_term: s(body.utm_term ?? "", 200) || null,
      fb_campaign_id: s(body.fb_campaign_id ?? body.utm_campaign ?? "", 64) || null,
      fb_adset_id: s(body.fb_adset_id ?? "", 64) || null,
      fb_ad_id: s(body.fb_ad_id ?? body.utm_content ?? "", 64) || null,
      fbclid: s(body.fbclid ?? "", 500) || null,
      landing_slug: s(body.landing_slug ?? landingSlug ?? "", 200) || null,
      order_code: orderCode,
    };
    const mainSubtotal = Number((totalPrice-offerExtraItems.reduce((sum,line)=>sum+line.price*line.quantity,0)).toFixed(2));
    const unitPrice = Number((mainSubtotal/quantity).toFixed(2));
    const incoming = Array.isArray(body.items) && body.items.length ? body.items : [{color:body.selected_color,size:body.selected_size,product_code:body.selected_product_code,quantity}];
    if (incoming.some(it=>!Number.isInteger(Number(it.quantity ?? 1)) || Number(it.quantity ?? 1)<=0) || incoming.reduce((sum,it)=>sum+Number(it.quantity ?? 1),0)!==quantity) {
      return new Response(JSON.stringify({error:'invalid_item_quantity'}),{status:400,headers:{...corsHeaders,'Content-Type':'application/json'}});
    }
    const itemRows = incoming.map(it=>({product_id:product.id,product_name:product.name,quantity:Number(it.quantity ?? 1),price:unitPrice,
      selected_color:s(it.color ?? '',200)||null,selected_size:s(it.size ?? '',200)||null,selected_product_code:s(it.product_code ?? '',200)||null}));
    for (const extra of offerExtraItems) itemRows.push({product_id:extra.product_id,product_name:extra.product_name,quantity:extra.quantity,price:extra.price,selected_color:null,selected_size:null,selected_product_code:null});
    const responseItems = [{product_id:product.id,product_name:product.name,quantity,price:mainSubtotal},
      ...offerExtraItems.map(line => ({ ...line, price: Number((line.price * line.quantity).toFixed(2)) }))];
    const {data: committed,error: iErr} = await supabase.rpc('commit_public_checkout',{
      _request_id:requestId,_fingerprint:fingerprint,_order:orderData,_items:itemRows,
      _response:{...orderCurrency,price:totalPrice,shipping_fee:shippingFee,total:totalPrice+shippingFee,accepted_offer_id:acceptedOfferId,items:responseItems},
    });
    if (iErr || !committed?.ok || !committed.order_id) {
      console.error('Atomic checkout failed',iErr?.code);
      return new Response(JSON.stringify({error:iErr?.message?.includes('checkout_request_conflict')?'checkout_request_conflict':'Could not create order'}),{status:iErr?.message?.includes('checkout_request_conflict')?409:503,headers:{...corsHeaders,'Content-Type':'application/json'}});
    }
    if (committed.replayed) return new Response(JSON.stringify(committed),{headers:{...corsHeaders,'Content-Type':'application/json'}});
    const insertedOrder = {id:committed.order_id};

    // Background tasks — do not block the HTTP response.
    if (insertedOrder?.id) {
      const orderId = insertedOrder.id;
      const baseUrl = Deno.env.get("SUPABASE_URL")!;
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const authHeaders = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceKey}`,
      };

      const background = (async () => {
        // 1) Match city from what the customer wrote (governorate + address),
        // not the delivery zone (داخل/خارج طرابلس).
        try {
          const cityForMatch = customerCityForMatching(governorate, city);
          const matchRes = await fetch(`${baseUrl}/functions/v1/match-city`, {
            method: "POST",
            headers: authHeaders,
            body: JSON.stringify({ city: cityForMatch, address, owner_id: (product as any).owner_id }),
          });
          if (matchRes.ok) {
            const m = await matchRes.json();
            await supabase.from("orders").update({
              matched_zone_id: m.zone_id ?? null,
              matched_area_id: m.area_id ?? null,
              matched_zone_name: m.zone_name ?? null,
              matched_area_name: m.area_name ?? null,
            }).eq("id", orderId);
          }
        } catch (e) { console.error("match-city failed", e); }

        // 2) WhatsApp confirmation. Stock was committed with the checkout.
        try {
          await fetch(`${baseUrl}/functions/v1/whatsapp-send-confirmation`, {
          method: "POST",
            headers: authHeaders,
            body: JSON.stringify({ order_id: orderId }),
          });
        } catch (e) { console.error("wa-confirm failed", e); }

        // 3) Push notification to store owner.
        try {
          await fetch(`${baseUrl}/functions/v1/send-push`, {
            method: "POST",
            headers: authHeaders,
            body: JSON.stringify({
              store_id: (product as any).store_id ?? null,
              user_id: (product as any).store_id ? undefined : (product as any).owner_id,
              title: "🔔 طلب جديد",
              body: `${customer_name || "زبون"} — ${product.name}`,
              url: "/orders",
              tag: `order-${orderId}`,
            }),
          });
        } catch (e) { console.error("push notify failed", e); }
      })();

      // Keep the runtime alive until background work completes, but don't
      // make the client wait for it.
      try {
        // @ts-ignore - EdgeRuntime is available in Supabase Edge runtime
        EdgeRuntime.waitUntil(background);
      } catch {
        // Fallback: at least don't crash if waitUntil isn't available.
        background.catch((e) => console.error("bg tasks failed", e));
      }
    }

    return new Response(JSON.stringify(committed), {headers:{...corsHeaders,'Content-Type':'application/json'}});
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: "Bad request" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
