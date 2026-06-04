// Purge Cloudflare edge cache for landing page paths after publish.
// Set CLOUDFLARE_ZONE_ID + CLOUDFLARE_API_TOKEN in Edge Function secrets.

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "POST only" }), {
      status: 405,
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }

  const zoneId = Deno.env.get("CLOUDFLARE_ZONE_ID")?.trim();
  const apiToken = Deno.env.get("CLOUDFLARE_API_TOKEN")?.trim();
  const publicHost = Deno.env.get("PUBLIC_HOST")?.trim();

  let body: { paths?: string[] } = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const paths = Array.isArray(body.paths) ? body.paths.filter((p) => typeof p === "string" && p.startsWith("/p/")) : [];
  if (!paths.length) {
    return new Response(JSON.stringify({ ok: true, purged: 0, skipped: "no paths" }), {
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }

  if (!zoneId || !apiToken || !publicHost) {
    return new Response(
      JSON.stringify({ ok: true, purged: 0, skipped: "CLOUDFLARE_* or PUBLIC_HOST not configured" }),
      { headers: { ...corsHeaders, "content-type": "application/json" } }
    );
  }

  const files = paths.map((p) => `https://${publicHost}${p}`);
  const cfRes = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/purge_cache`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ files }),
  });

  const cfJson = await cfRes.json().catch(() => ({}));
  return new Response(
    JSON.stringify({ ok: cfRes.ok, purged: files.length, cloudflare: cfJson }),
    {
      status: cfRes.ok ? 200 : 502,
      headers: { ...corsHeaders, "content-type": "application/json" },
    }
  );
});
