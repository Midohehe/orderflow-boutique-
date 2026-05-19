/**
 * Cloudflare Worker — was-la.com
 * ------------------------------------------------------------------
 * Routes:
 *   /p/*          → Supabase Edge Function `landing-ssr` (pre-rendered
 *                   HTML so LCP paints instantly + dynamic OG tags).
 *   everything    → proxied to the Lovable origin (the SPA).
 *
 * Deploy via Cloudflare Dashboard → Workers & Pages → Create Worker
 * (paste this code), then add a Route:  was-la.com/*  →  this worker.
 * Make sure was-la.com (and www) are added to Cloudflare with proxy ON.
 */

const LOVABLE_ORIGIN  = "https://was-la.lovable.app";
const SSR_ENDPOINT    = "https://iyqooryhmshlajuhabmc.supabase.co/functions/v1/landing-ssr";

// Supabase publishable (anon) key — safe to expose, required by the gateway.
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml5cW9vcnlobXNobGFqdWhhYm1jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgxNTE2MDgsImV4cCI6MjA5MzcyNzYwOH0.2TiusoOpuE9tpMYUMyAULURH9MDN-nJmAesyROtP0HU";

export default {
  async fetch(request) {
    const url = new URL(request.url);

    // 1) Pre-rendered landing pages
    if (url.pathname.startsWith("/p/")) {
      const ssrUrl = new URL(SSR_ENDPOINT);
      ssrUrl.searchParams.set("path", url.pathname);
      ssrUrl.searchParams.set("host", url.host);

      // Edge cache by full path so each product gets its own cached HTML.
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

      // Re-emit so we can set our own cache headers and store it.
      const body = await ssrRes.arrayBuffer();
      const res = new Response(body, {
        status: ssrRes.status,
        headers: {
          "content-type": "text/html; charset=utf-8",
          // Cache pre-rendered HTML aggressively at the edge so repeat
          // visitors get sub-100ms TTFB. SWR keeps it warm even after
          // expiry while we revalidate in the background.
          "cache-control": "public, max-age=0, s-maxage=300, stale-while-revalidate=86400",
        },
      });
      if (ssrRes.ok) {
        // Don't await — let caching happen in the background.
        try { await cache.put(cacheKey, res.clone()); } catch (_) {}
      }
      return res;
    }

    // 2) Everything else → transparent proxy to the Lovable SPA
    const upstream = new URL(url.pathname + url.search, LOVABLE_ORIGIN);
    const proxied = new Request(upstream.toString(), request);
    proxied.headers.set("host", new URL(LOVABLE_ORIGIN).host);

    // Hashed build assets (e.g. /assets/index-abc123.js) are immutable —
    // cache them aggressively at the edge AND in the browser so repeat
    // visits skip the network entirely.
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