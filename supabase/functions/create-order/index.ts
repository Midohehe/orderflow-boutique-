// Public edge function to create an order with server-side price recomputation.
// Prevents clients from spoofing the price written to the database.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface OrderPayload {
  product_id: string;
  quantity: number;
  customer_name: string;
  phone: string;
  address: string;
  city: string;
  selected_color?: string | null;
  selected_size?: string | null;
  selected_product_code?: string | null;
  shipping_included?: boolean;
  upsell_index?: number | null;
  landing_slug?: string | null;
  hp?: string | null;
  elapsed_ms?: number | null;
  turnstile_token?: string | null;
  items?: Array<{
    color?: string | null;
    size?: string | null;
    product_code?: string | null;
    quantity?: number;
  }> | null;
}

function s(v: unknown, max = 200): string {
  if (typeof v !== "string") return "";
  return v.trim().slice(0, max);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = (await req.json()) as OrderPayload;

    // Capture client IP & user-agent (used for both real & rejected orders).
    const clientIp =
      req.headers.get("cf-connecting-ip") ||
      (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() ||
      req.headers.get("x-real-ip") ||
      null;
    const userAgent = req.headers.get("user-agent") || null;

    // Helper: persist a rejected attempt so the dashboard can review it.
    const logRejected = async (reason: string) => {
      try {
        const svc = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
        );
        let ownerId: string | null = null;
        let storeId: string | null = null;
        let productName: string | null = null;
        const pid = s(body?.product_id ?? "", 64);
        if (pid) {
          const { data: p } = await svc
            .from("products")
            .select("owner_id, store_id, name")
            .eq("id", pid)
            .maybeSingle();
          if (p) {
            ownerId = (p as any).owner_id ?? null;
            storeId = (p as any).store_id ?? null;
            productName = (p as any).name ?? null;
          }
        }
        await svc.from("rejected_orders").insert({
          owner_id: ownerId,
          store_id: storeId,
          product_id: pid || null,
          product_name: productName,
          landing_slug: s(body?.landing_slug ?? "", 200) || null,
          customer_name: s(body?.customer_name ?? "", 120) || null,
          phone: s(body?.phone ?? "", 40) || null,
          address: s(body?.address ?? "", 500) || null,
          city: s(body?.city ?? "", 120) || null,
          quantity: Math.max(1, Math.floor(Number(body?.quantity) || 1)),
          reason,
          elapsed_ms: Number.isFinite(Number(body?.elapsed_ms)) ? Math.floor(Number(body?.elapsed_ms)) : null,
          honeypot_value: typeof body?.hp === "string" ? body.hp.slice(0, 500) : null,
          client_ip: clientIp,
          user_agent: userAgent,
          payload: body as any,
        });
      } catch (e) {
        console.error("rejected_orders log failed", e);
      }
    };

    // ---- Bot protection (Level 1) ----
    // 1) Honeypot: if the hidden field is filled, silently accept and discard.
    if (typeof body.hp === "string" && body.hp.trim() !== "") {
      console.warn("bot blocked: honeypot filled");
      await logRejected("honeypot");
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    // 2) Time-to-submit: real users can't fill the form in < 3s.
    const elapsedMs = Number(body.elapsed_ms);
    if (Number.isFinite(elapsedMs) && elapsedMs > 0 && elapsedMs < 3000) {
      console.warn("bot blocked: submitted too fast", elapsedMs);
      await logRejected("too_fast");
      return new Response(JSON.stringify({ error: "too_fast" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3) Cloudflare Turnstile verification (invisible CAPTCHA).
    const turnstileSecret = Deno.env.get("TURNSTILE_SECRET_KEY");
    if (turnstileSecret) {
      const token = s(body.turnstile_token ?? "", 4096);
      // NOTE: Do NOT reject when the token is missing. Some browsers
      // (Facebook/Instagram in-app, older WebViews) cannot load Turnstile,
      // and real customers were being lost. We only verify when a token is
      // provided; honeypot + time-check + variant validation remain enforced.
      if (token) try {
        const form = new FormData();
        form.append("secret", turnstileSecret);
        form.append("response", token);
        if (clientIp) form.append("remoteip", clientIp);
        const vRes = await fetch(
          "https://challenges.cloudflare.com/turnstile/v0/siteverify",
          { method: "POST", body: form },
        );
        const vJson = await vRes.json().catch(() => ({}));
        if (!vJson?.success) {
          console.warn("turnstile verify failed", vJson);
          await logRejected("turnstile_failed");
          return new Response(JSON.stringify({ error: "captcha_failed" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      } catch (e) {
        // Fail-open on network errors so real customers aren't lost.
        console.error("turnstile verify error (ignored)", e);
      }
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

    if (!product_id || !phone) {
      console.error("Missing required fields", { product_id, phone });
      return new Response(JSON.stringify({ error: "Missing required fields (product/phone)" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Authoritative price lookup
    const { data: product, error: pErr } = await supabase
      .from("products")
      .select("id, name, price, is_visible, owner_id, store_id, upsell_enabled, upsell_offers, colors, sizes")
      .eq("id", product_id)
      .maybeSingle();

    if (pErr || !product || !product.is_visible) {
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
          return new Response(JSON.stringify({ error: "missing_variant_color" }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (requiresSize && !sz) {
          return new Response(JSON.stringify({ error: "missing_variant_size" }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (requiresColor && !productColors.includes(c)) {
          return new Response(JSON.stringify({ error: "invalid_variant_color" }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (requiresSize && !productSizes.includes(sz)) {
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
    const landingSlug = s(body.landing_slug ?? "", 200);
    if (landingSlug) {
      const { data: lp } = await supabase
        .from("landing_pages")
        .select("price, upsell_enabled, upsell_offers")
        .eq("slug", landingSlug)
        .eq("product_id", product.id)
        .maybeSingle();
      if (lp) {
        if (lp.price !== null && lp.price !== undefined && Number(lp.price) > 0) {
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

    // Insert the order immediately with no city match. City matching (AI) and
    // stock/WhatsApp side-effects run in the background so the client can
    // navigate to the thank-you page without waiting on slow AI calls.
    const { data: insertedOrder, error: iErr } = await supabase.from("orders").insert({
      owner_id: (product as any).owner_id,
      store_id: (product as any).store_id ?? null,
      customer_name: customer_name || "بدون اسم",
      phone,
      address: address || "—",
      city: city || "—",
      product_id: product.id,
      product_name: product.name,
      price: totalPrice,
      quantity,
      status: "pending",
      selected_color: s(body.selected_color ?? "", 200) || null,
      selected_size: s(body.selected_size ?? "", 200) || null,
      selected_product_code: s(body.selected_product_code ?? "", 200) || null,
      shipping_included: body.shipping_included === true,
      upsell_offers: upsellOffers && upsellOffers.length > 0 ? upsellOffers : [],
      client_ip: clientIp,
      user_agent: userAgent,
    }).select("id").single();

    if (iErr) {
      console.error("order insert failed", iErr);
      return new Response(JSON.stringify({ error: "Could not create order" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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
        // 0) Persist per-piece order_items in the background so the client
        // gets an immediate response. The main `orders` row is already saved.
        try {
          const incoming = Array.isArray(body.items) ? body.items! : [];
          const unitPrice = quantity > 0 ? Number((totalPrice / quantity).toFixed(2)) : Number(product.price) || 0;
          const rows: any[] = [];
          if (incoming.length > 0) {
            for (const it of incoming) {
              rows.push({
                order_id: orderId,
                owner_id: (product as any).owner_id,
                store_id: (product as any).store_id ?? null,
                product_id: product.id,
                product_name: product.name,
                quantity: Math.max(1, Math.floor(Number(it.quantity) || 1)),
                price: unitPrice,
                selected_color: s(it.color ?? "", 200) || null,
                selected_size: s(it.size ?? "", 200) || null,
                selected_product_code: s(it.product_code ?? "", 200) || null,
              });
            }
          } else if (quantity > 1) {
            for (let i = 0; i < quantity; i++) {
              rows.push({
                order_id: orderId,
                owner_id: (product as any).owner_id,
                store_id: (product as any).store_id ?? null,
                product_id: product.id,
                product_name: product.name,
                quantity: 1,
                price: unitPrice,
                selected_color: s(body.selected_color ?? "", 200) || null,
                selected_size: s(body.selected_size ?? "", 200) || null,
                selected_product_code: s(body.selected_product_code ?? "", 200) || null,
              });
            }
          }
          if (rows.length > 0) {
            const { error: itErr } = await supabase.from("order_items").insert(rows);
            if (itErr) console.error("order_items insert failed", itErr);
          }
        } catch (e) {
          console.error("order_items persistence error", e);
        }

        // 1) Match city via AI and update the order row.
        try {
          const matchRes = await fetch(`${baseUrl}/functions/v1/match-city`, {
            method: "POST",
            headers: authHeaders,
            body: JSON.stringify({ city, address, owner_id: (product as any).owner_id }),
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

        // 2) Apply stock decrement.
        try {
          await fetch(`${baseUrl}/functions/v1/apply-order-stock`, {
            method: "POST",
            headers: authHeaders,
            body: JSON.stringify({ order_id: orderId, reason: "order_created" }),
          });
        } catch (e) { console.error("apply-order-stock failed", e); }

        // 3) WhatsApp confirmation.
        try {
          await fetch(`${baseUrl}/functions/v1/whatsapp-send-confirmation`, {
          method: "POST",
            headers: authHeaders,
            body: JSON.stringify({ order_id: orderId }),
          });
        } catch (e) { console.error("wa-confirm failed", e); }

        // 4) Push notification to store owner.
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

    return new Response(JSON.stringify({ ok: true, price: totalPrice }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: "Bad request" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
