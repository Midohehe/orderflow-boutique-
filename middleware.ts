/**
 * Vercel Edge Middleware — landing SSR + Supabase storage image proxy.
 * (Cloudflare equivalent: cloudflare-worker/worker.js)
 */
const SSR_PATH = "/functions/v1/landing-ssr";
const IMG_EDGE_CACHE = "public, max-age=31536000, s-maxage=31536000, immutable";

function isAllowedStorageUrl(target: string, supabaseOrigin: string | null): boolean {
  try {
    const u = new URL(target);
    return !!supabaseOrigin && u.origin === supabaseOrigin && u.pathname.startsWith("/storage/v1/");
  } catch {
    return false;
  }
}

export default async function middleware(request: Request) {
  const url = new URL(request.url);
  const supabaseUrl = process.env.VITE_SUPABASE_URL?.replace(/\/$/, "");
  const anonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const supabaseOrigin = supabaseUrl ? new URL(supabaseUrl).origin : null;

  if (url.pathname === "/cdn/img") {
    const target = url.searchParams.get("u");
    if (!target || !isAllowedStorageUrl(target, supabaseOrigin)) {
      return new Response("Bad Request", { status: 400 });
    }

    const upstream = await fetch(target, {
      headers: anonKey
        ? { apikey: anonKey, Authorization: `Bearer ${anonKey}` }
        : undefined,
    });

    if (!upstream.ok) {
      return new Response(upstream.body, { status: upstream.status });
    }

    return new Response(upstream.body, {
      status: upstream.status,
      headers: {
        "content-type": upstream.headers.get("content-type") || "application/octet-stream",
        "cache-control": IMG_EDGE_CACHE,
      },
    });
  }

  if (!url.pathname.startsWith("/p/")) {
    return fetch(request);
  }

  if (!supabaseUrl || !anonKey) {
    return fetch(request);
  }

  const ssrUrl = new URL(SSR_PATH, supabaseUrl);
  ssrUrl.searchParams.set("path", url.pathname);
  ssrUrl.searchParams.set("host", url.host);

  const ssrRes = await fetch(ssrUrl.toString(), {
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
    },
  });

  return new Response(ssrRes.body, {
    status: ssrRes.status,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}

export const config = {
  matcher: ["/p/:path*", "/cdn/img"],
};
