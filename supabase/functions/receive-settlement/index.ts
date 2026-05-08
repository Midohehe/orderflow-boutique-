// Marks a settlement as "received" and flags all linked orders as
// settlement_received = true so they appear in the cashbox / financial flow.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface Body { settlement_id: string; received: boolean }

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const ownerId = userData.user.id;

    const body = (await req.json()) as Body;
    if (!body.settlement_id) {
      return new Response(JSON.stringify({ error: "settlement_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: settlement } = await admin
      .from("settlements").select("id, owner_id")
      .eq("id", body.settlement_id).maybeSingle();
    if (!settlement || settlement.owner_id !== ownerId) {
      return new Response(JSON.stringify({ error: "Not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const received = !!body.received;
    const ts = received ? new Date().toISOString() : null;

    await admin.from("settlements").update({
      received, received_at: ts,
    }).eq("id", settlement.id);

    // Update linked orders
    const { data: shipments } = await admin
      .from("settlement_shipments")
      .select("order_id")
      .eq("settlement_id", settlement.id)
      .not("order_id", "is", null);
    const orderIds = Array.from(new Set((shipments || []).map((s: any) => s.order_id).filter(Boolean)));
    if (orderIds.length) {
      await admin.from("orders").update({
        settlement_received: received,
        settlement_received_at: ts,
      }).in("id", orderIds).eq("owner_id", ownerId);
    }

    return new Response(JSON.stringify({ ok: true, updated_orders: orderIds.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});