export const config = {
  runtime: "edge",
};

const IMG_EDGE_CACHE = "public, max-age=604800, s-maxage=2592000, immutable";

function supabaseOrigin(): string | null {
  const raw = process.env.VITE_SUPABASE_URL?.replace(/\/$/, "");
  if (!raw) return null;
  try {
    return new URL(raw).origin;
  } catch {
    return null;
  }
}

function isAllowedStorageUrl(target: string, origin: string | null): boolean {
  try {
    const u = new URL(target);
    return !!origin && u.origin === origin && u.pathname.startsWith("/storage/v1/");
  } catch {
    return false;
  }
}

export default async function handler(request: Request) {
  const url = new URL(request.url);
  const target = url.searchParams.get("u");
  const origin = supabaseOrigin();

  if (!target || !isAllowedStorageUrl(target, origin)) {
    return new Response("Bad Request", { status: 400 });
  }

  const anonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
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
