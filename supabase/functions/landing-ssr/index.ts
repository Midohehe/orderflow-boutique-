// Edge SSR for landing pages — returns pre-rendered HTML so LCP paints
// before React hydrates. Designed to be invoked by a Cloudflare Worker
// on the custom domain (e.g. was-la.com) that routes /p/* here and
// proxies everything else to the deployed SPA origin.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import {
  extractPuckHero,
  puckHasRenderableContent,
  renderPuckToHtml,
} from "../_shared/puck-ssr-html.ts";
import { landingHeroPreloadHref, optimizeLandingImageUrl, wrapLandingCdnUrl } from "../_shared/landing-image-url.ts";
import { parseThemeTokens, themeTokensToSsrCssFromTokens } from "../_shared/theme-ssr.ts";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const APP_ORIGIN = (Deno.env.get("APP_ORIGIN") || Deno.env.get("SITE_URL") || "").replace(/\/$/, "");

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

let shellCache: { html: string; ts: number } | null = null;
const SHELL_TTL = 60_000;

function minimalShell(): string {
  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /><link rel="icon" href="/favicon.ico" /></head><body><div id="root"></div><script type="module" src="/src/main.tsx"></script></body></html>`;
}

async function getShell(): Promise<string> {
  if (shellCache && Date.now() - shellCache.ts < SHELL_TTL) return shellCache.html;
  if (!APP_ORIGIN) {
    shellCache = { html: minimalShell(), ts: Date.now() };
    return shellCache.html;
  }
  const r = await fetch(APP_ORIGIN + "/index.html", {
    headers: { "user-agent": "landing-ssr" },
  });
  const html = r.ok ? await r.text() : minimalShell();
  shellCache = { html, ts: Date.now() };
  return html;
}

function escapeHtml(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function stripTags(s: string): string {
  return String(s ?? "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

// Keep asset URLs relative so the browser fetches them from the
// custom domain. The Cloudflare Worker proxies non-/p/* routes to SPA_ORIGIN.
function absolutizeAssets(html: string): string {
  return html;
}

function buildHead(product: any, currency: string, pageUrl: string, platformName: string, publicHost: string): string {
  const title = escapeHtml(`${product.name} | ${platformName}`);
  const desc = escapeHtml(stripTags(product.description || product.name).slice(0, 160));
  const img = product.images?.[0] || "";
  const price = product.price;
  const lcpImg = img ? landingHeroPreloadHref(img, publicHost) : "";
  const ogImg = img ? wrapLandingCdnUrl(img, publicHost) : "";

  const preloadImg = lcpImg
    ? `<link rel="preload" as="image" href="${escapeHtml(lcpImg)}" fetchpriority="high" />`
    : "";

  const productJsonLd = JSON.stringify({
    "@context": "https://schema.org/",
    "@type": "Product",
    name: product.name,
    image: product.images || [],
    description: stripTags(product.description || ""),
    offers: {
      "@type": "Offer",
      price: price,
      priceCurrency: currency || "LYD",
      availability: "https://schema.org/InStock",
    },
  });

  return `
<title>${title}</title>
<meta name="description" content="${desc}" />
<link rel="canonical" href="${escapeHtml(pageUrl)}" />
<link rel="preconnect" href="${SUPABASE_URL}" crossorigin />
<link rel="dns-prefetch" href="${SUPABASE_URL}" />
<link rel="dns-prefetch" href="https://connect.facebook.net" />
<link rel="dns-prefetch" href="https://analytics.tiktok.com" />
<link rel="dns-prefetch" href="https://www.googletagmanager.com" />
<meta property="og:type" content="product" />
<meta property="og:title" content="${title}" />
<meta property="og:description" content="${desc}" />
<meta property="og:url" content="${escapeHtml(pageUrl)}" />
${ogImg ? `<meta property="og:image" content="${escapeHtml(ogImg)}" />` : ""}
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${title}" />
<meta name="twitter:description" content="${desc}" />
${ogImg ? `<meta name="twitter:image" content="${escapeHtml(ogImg)}" />` : ""}
${preloadImg}
<script type="application/ld+json">${productJsonLd.replace(/</g, "\\u003c")}</script>
`;
}

function buildAboveFold(product: any, currency: string, puckHero?: { title?: string; subtitle?: string; image?: string } | null, publicHost?: string): string {
  const name = puckHero?.title || product.name;
  const subtitle = puckHero?.subtitle || "الدفع عند الاستلام";
  const img = puckHero?.image || product.images?.[0] || "";
  const heroSrc = img
    ? optimizeLandingImageUrl(img, { width: 800, height: 800, format: "webp" }, publicHost)
    : "";
  return `
<div id="ssr-shell" style="font-family:Cairo,system-ui,-apple-system,Segoe UI,Roboto,sans-serif;direction:rtl;background:hsl(220 20% 97%);min-height:100vh">
  <div style="background:linear-gradient(135deg,hsl(217 91% 50%),hsl(217 91% 40%));color:#fff;padding:24px 16px;text-align:center">
    <h1 style="margin:0 0 6px;font-size:22px;font-weight:700;line-height:1.3">${escapeHtml(name)}</h1>
    <div style="opacity:.9;font-size:14px">${escapeHtml(subtitle)}</div>
  </div>
  <div style="max-width:960px;margin:0 auto;padding:16px">
    ${heroSrc ? `<figure style="aspect-ratio:1/1;border-radius:14px;overflow:hidden;background:#f1f5f9;box-shadow:0 4px 16px rgba(0,0,0,.08);max-width:480px;margin:0 auto"><img src="${escapeHtml(heroSrc)}" alt="${escapeHtml(name)}" width="800" height="800" fetchpriority="high" decoding="async" style="width:100%;height:100%;object-fit:contain" /></figure>` : ""}
    <div style="text-align:center;margin-top:16px">
      <span style="font-size:28px;font-weight:800;color:hsl(217 91% 50%)">${product.price} ${escapeHtml(currency)}</span>
      ${product.original_price ? `<span style="margin-right:10px;color:#94a3b8;text-decoration:line-through">${product.original_price} ${escapeHtml(currency)}</span>` : ""}
    </div>
    <div style="text-align:center;margin-top:18px;color:#64748b;font-size:13px">جارِ تحميل نموذج الطلب…</div>
  </div>
</div>
`;
}

const DEFAULT_PLATFORM_NAME = "منصة وصلة";

async function getPlatformName(): Promise<string> {
  const { data } = await supabase.from("app_settings").select("system_name").limit(1).maybeSingle();
  const name = String(data?.system_name ?? "").trim();
  return name || DEFAULT_PLATFORM_NAME;
}

async function getStoreCurrency(ownerId: string | null): Promise<string> {
  if (!ownerId) return "د.ل";
  const { data } = await supabase
    .from("store_settings")
    .select("currency_symbol")
    .eq("owner_id", ownerId)
    .limit(1)
    .maybeSingle();
  return data?.currency_symbol || "د.ل";
}

async function getStoreTheme(
  ownerId: string | null,
  storeId: string | null
): Promise<{ tokens: ReturnType<typeof parseThemeTokens>; customCss: string | null }> {
  if (!ownerId) return { tokens: parseThemeTokens(null), customCss: null };
  let q = supabase
    .from("store_settings")
    .select("theme_tokens, theme_custom_css")
    .eq("owner_id", ownerId);
  if (storeId) q = q.eq("store_id", storeId);
  const { data } = await q.limit(1).maybeSingle();
  return {
    tokens: parseThemeTokens(data?.theme_tokens),
    customCss: (data as { theme_custom_css?: string })?.theme_custom_css ?? null,
  };
}

function notFoundHtml(): string {
  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>المنتج غير متوفر</title></head><body style="font-family:Cairo,sans-serif;text-align:center;padding:48px"><h1>المنتج غير موجود</h1><p>عذراً، لم نتمكن من العثور على هذا المنتج.</p></body></html>`;
}

function parsePath(pathname: string): { slug: string | null; username: string | null } {
  // Supports:
  //   /p/:slug
  //   /p/:username/:slug
  //   /landing-ssr/p/:slug  (when invoked directly through the function URL)
  const m = pathname.replace(/^\/landing-ssr/, "").match(/^\/p\/([^\/?#]+)(?:\/([^\/?#]+))?\/?$/);
  if (!m) return { slug: null, username: null };
  const a = decodeURIComponent(m[1]);
  const b = m[2] ? decodeURIComponent(m[2]) : null;
  return b ? { username: a, slug: b } : { username: null, slug: a };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    // Allow CF Worker to override the path it wants us to render.
    const targetPath = url.searchParams.get("path") || url.pathname;
    const publicHost = url.searchParams.get("host") || url.host;
    const { slug, username } = parsePath(targetPath);

    if (!slug) {
      return new Response(notFoundHtml(), {
        status: 404,
        headers: { ...corsHeaders, "content-type": "text/html; charset=utf-8" },
      });
    }

    // Resolve owner if username scoped.
    let ownerId: string | null = null;
    if (username) {
      const { data: prof } = await supabase
        .from("profiles")
        .select("user_id, is_active")
        .eq("username", username)
        .maybeSingle();
      if (!prof || !prof.is_active) {
        return new Response(notFoundHtml(), {
          status: 404,
          headers: { ...corsHeaders, "content-type": "text/html; charset=utf-8" },
        });
      }
      ownerId = prof.user_id;
    }

    // First, try a landing_page with this slug (custom landing pages).
    const landingQuery = supabase
      .from("landing_pages")
      .select("product_id, title, description, images, price, original_price, owner_id, is_visible, puck_data")
      .eq("slug", slug)
      .eq("is_visible", true);
    if (ownerId) landingQuery.eq("owner_id", ownerId);
    const { data: landingRows } = await landingQuery.limit(5);
    const landing = landingRows?.[0];

    let product: any = null;
    let puckData: unknown = null;
    let puckHero: ReturnType<typeof extractPuckHero> = null;

    if (landing) {
      puckData = landing.puck_data;
      puckHero = extractPuckHero(puckData);
      const { data: prod } = await supabase
        .from("products")
        .select("id, name, slug, price, original_price, description, images, owner_id")
        .eq("id", landing.product_id)
        .is("deleted_at", null)
        .maybeSingle();
      if (prod) {
        const lpImages = Array.isArray(landing.images) ? landing.images : [];
        product = {
          ...prod,
          name: landing.title || prod.name,
          description: landing.description || prod.description,
          price: landing.price ?? prod.price,
          original_price: landing.original_price ?? prod.original_price,
          images: lpImages.length ? lpImages : prod.images,
          owner_id: landing.owner_id || prod.owner_id,
        };
      }
    } else {
      const productQuery = supabase
        .from("products")
        .select("id, name, slug, price, original_price, description, images, owner_id")
        .eq("slug", slug)
        .eq("is_visible", true)
        .limit(1);
      if (ownerId) productQuery.eq("owner_id", ownerId);
      const { data: products } = await productQuery;
      product = products?.[0];
    }

    if (!product) {
      return new Response(notFoundHtml(), {
        status: 404,
        headers: { ...corsHeaders, "content-type": "text/html; charset=utf-8" },
      });
    }

    const [currency, platformName] = await Promise.all([
      getStoreCurrency(product.owner_id),
      getPlatformName(),
    ]);
    const { tokens: themeTokens, customCss: themeCustomCss } = await getStoreTheme(
      product.owner_id,
      (product as { store_id?: string }).store_id ?? null
    );

    const pageUrl = `https://${publicHost}${targetPath}`;
    const shell = absolutizeAssets(await getShell());
    const themeCss = themeTokensToSsrCssFromTokens(themeTokens, "#root", themeCustomCss);
    const headInjection = buildHead(product, currency, pageUrl, platformName, publicHost) + `<style id="ssr-theme">${themeCss}</style>`;
    const bodyInjection = puckHasRenderableContent(puckData)
      ? renderPuckToHtml(puckData)
      : buildAboveFold(product, currency, puckHero, publicHost);

    let html = shell.replace(/<title>[\s\S]*?<\/title>/i, "");
    // Strip any static OG tags from the shell so ours win for crawlers.
    html = html.replace(/<meta\s+(?:property|name)="(?:og:[^"]+|twitter:[^"]+|description)"[^>]*>\s*/gi, "");
    html = html.replace("</head>", `${headInjection}\n</head>`);
    html = html.replace(
      /<div id="root">\s*<\/div>/,
      `<div id="root">${bodyInjection}</div>`,
    );

    return new Response(html, {
      status: 200,
      headers: {
        ...corsHeaders,
        "content-type": "text/html; charset=utf-8",
        // Keep CDN cache short so new deploys (rotated asset hashes) are
        // picked up quickly. Browsers should always revalidate.
        "cache-control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
      },
    });
  } catch (err) {
    console.error("landing-ssr error", err);
    return new Response(notFoundHtml(), {
      status: 500,
      headers: { ...corsHeaders, "content-type": "text/html; charset=utf-8" },
    });
  }
});