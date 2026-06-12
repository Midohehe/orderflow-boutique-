/**
 * Cloudflare Worker — edge cache for landing SSR + Supabase Storage images.
 *
 * Routes (configure in Cloudflare Dashboard or wrangler.toml):
 *   www.was-la.com/p/*       → landing-ssr (HTML cached 1h at edge)
 *   www.was-la.com/cdn/img*  → Supabase Storage proxy (images cached 30d)
 *
 * All other paths bypass this worker and go straight to Vercel via DNS.
 * Do NOT route `/*` through this worker — that creates a proxy loop with Vercel.
 *
 * Deploy: npm run cf:deploy (see cloudflare-worker/DEPLOY.md)
 */

/** HTML: 1h edge cache — purge via purge-landing-cache edge function on publish */
const SSR_EDGE_CACHE =
  "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400";
/** Images: 30d edge cache — cuts Supabase Storage egress */
const IMG_EDGE_CACHE =
  "public, max-age=604800, s-maxage=2592000, immutable";

function requiredEnv(env, key) {
  const v = env[key];
  if (!v || !String(v).trim()) {
    throw new Error(`Missing Worker env: ${key}`);
  }
  return String(v).trim();
}

function isAllowedStorageUrl(target, supabaseOrigin) {
  try {
    const u = new URL(target);
    return u.origin === supabaseOrigin && u.pathname.startsWith("/storage/v1/");
  } catch {
    return false;
  }
}

async function respondFromCache(request, upstreamUrl, cacheControl, contentType, anonKey) {
  const cache = caches.default;
  const cacheKey = new Request(request.url, { method: "GET" });
  const hit = await cache.match(cacheKey);
  if (hit) {
    const headers = new Headers(hit.headers);
    headers.set("x-wasla-cache", "HIT");
    return new Response(hit.body, { status: hit.status, headers });
  }

  const upstream = await fetch(upstreamUrl, {
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
    },
  });
  if (!upstream.ok) return upstream;

  const body = await upstream.arrayBuffer();
  const res = new Response(body, {
    status: upstream.status,
    headers: {
      "content-type": contentType || upstream.headers.get("content-type") || "application/octet-stream",
      "cache-control": cacheControl,
      "x-wasla-cache": "MISS",
    },
  });
  try {
    await cache.put(cacheKey, res.clone());
  } catch (_) {}
  return res;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const supabaseOrigin = requiredEnv(env, "SUPABASE_ORIGIN");
    const ssrEndpoint = requiredEnv(env, "SSR_ENDPOINT");
    const anonKey = requiredEnv(env, "SUPABASE_ANON_KEY");

    if (url.pathname === "/cdn/img") {
      const target = url.searchParams.get("u");
      if (!target || !isAllowedStorageUrl(target, supabaseOrigin)) {
        return new Response("Bad Request", { status: 400 });
      }
      return respondFromCache(request, target, IMG_EDGE_CACHE, null, anonKey);
    }

    if (url.pathname.startsWith("/p/")) {
      const ssrUrl = new URL(ssrEndpoint);
      ssrUrl.searchParams.set("path", url.pathname);
      ssrUrl.searchParams.set("host", url.host);

      const cache = caches.default;
      const cacheKey = new Request(`https://${url.host}${url.pathname}`, { method: "GET" });
      const cached = await cache.match(cacheKey);
      if (cached) {
        const headers = new Headers(cached.headers);
        headers.set("x-wasla-cache", "HIT");
        return new Response(cached.body, { status: cached.status, headers });
      }

      const ssrRes = await fetch(ssrUrl.toString(), {
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${anonKey}`,
        },
      });

      const body = await ssrRes.arrayBuffer();
      const res = new Response(body, {
        status: ssrRes.status,
        headers: {
          "content-type": "text/html; charset=utf-8",
          "cache-control": SSR_EDGE_CACHE,
          "x-wasla-cache": "MISS",
        },
      });
      if (ssrRes.ok) {
        try {
          await cache.put(cacheKey, res.clone());
        } catch (_) {}
      }
      return res;
    }

    // Should not run when routes are scoped to /p/* and /cdn/img only.
    return fetch(request);
  },
};
