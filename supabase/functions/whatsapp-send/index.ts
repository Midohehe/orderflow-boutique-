// Disabled platform-wide by the project owner. No provider calls or database mutations.
const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Content-Type': 'application/json' };
Deno.serve((req) => req.method === 'OPTIONS' ? new Response(null, { status: 204, headers }) : new Response(JSON.stringify({ ok: false, skipped: true, reason: 'whatsapp_disabled' }), { headers }));
