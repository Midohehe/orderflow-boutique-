/**
 * Cloudflare Worker — custom domain routing
 * ------------------------------------------------------------------
 * Routes:
 *   /p/*          → Supabase Edge Function `landing-ssr` (pre-rendered
 *                   HTML so LCP paints instantly + dynamic OG tags).
 *   everything    → proxied to your deployed SPA (SPA_ORIGIN).
 *
 * Deploy via Cloudflare Dashboard → Workers & Pages → Create Worker
 * (paste this code), then add a Route:  your-domain.com/*  →  this worker.
 */

// Set to your deployed SPA URL (Cloudflare Pages, Netlify, VPS, etc.)
const SPA_ORIGIN = "https://www.was-la.com";
const SSR_ENDPOINT = "https://sukehkrhvasfnoheyvvx.supabase.co/functions/v1/landing-ssr";

// Anon / publishable key from Supabase Dashboard → Project Settings → API
const SUPABASE_ANON_KEY =
  "sb_publishable_xYuelPLc4OuaoDh8js6lfw_itON8QuM";

export default {
  async fetch(request) {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/p/")) {
      const ssrUrl = new URL(SSR_ENDPOINT);
      ssrUrl.searchParams.set("path", url.pathname);
      ssrUrl.searchParams.set("host", url.host);

      const cache = caches.default;
      const cacheKey = new Request(`https://${url.host}${url.pathname}`, { method: "GET" });
      let cached = await cache.match(cacheKey);
      if (cached) return cached;

      const ssrRes = await fetch(ssrUrl.toString(), {
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
      });

      const body = await ssrRes.arrayBuffer();
      const res = new Response(body, {
        status: ssrRes.status,
        headers: {
          "content-type": "text/html; charset=utf-8",
          "cache-control": "public, max-age=0, s-maxage=300, stale-while-revalidate=86400",
        },
      });
      if (ssrRes.ok) {
        try { await cache.put(cacheKey, res.clone()); } catch (_) {}
      }
      return res;
    }

    const upstream = new URL(url.pathname + url.search, SPA_ORIGIN);
    const proxied = new Request(upstream.toString(), request);
    proxied.headers.set("host", new URL(SPA_ORIGIN).host);

    if (
      url.pathname.startsWith("/assets/") ||
      /\.(js|css|woff2?|ttf|otf|png|jpg|jpeg|webp|avif|svg|ico)$/i.test(url.pathname)
    ) {
      const cache = caches.default;
      const assetKey = new Request(`https://${url.host}${url.pathname}`, { method: "GET" });
      const hit = await cache.match(assetKey);
      if (hit) return hit;

      const upstreamRes = await fetch(proxied);
      if (upstreamRes.ok) {
        const headers = new Headers(upstreamRes.headers);
        headers.set("cache-control", "public, max-age=31536000, immutable");
        const cached = new Response(upstreamRes.body, {
          status: upstreamRes.status,
          headers,
        });
        try { await cache.put(assetKey, cached.clone()); } catch (_) {}
        return cached;
      }
      return upstreamRes;
    }

    return fetch(proxied);
  },
};
