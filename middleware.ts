/**
 * Vercel Edge Middleware — route /p/* through Supabase `landing-ssr` so
 * landing pages paint above-the-fold HTML before React loads.
 * (Same behavior as cloudflare-worker/worker.js when DNS points at Cloudflare.)
 */
const SSR_PATH = "/functions/v1/landing-ssr";

export default async function middleware(request: Request) {
  const url = new URL(request.url);
  if (!url.pathname.startsWith("/p/")) {
    return fetch(request);
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL?.replace(/\/$/, "");
  const anonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
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
  matcher: ["/p/:path*"],
};
