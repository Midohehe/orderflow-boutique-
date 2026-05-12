// Marks a settlement as "received" and flags all linked orders as
// settlement_received = true so they appear in the cashbox / financial flow.
// If safe_id is provided, deposits payment_amount into the safe and creates a movement.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface Body { settlement_id: string; received: boolean; safe_id?: string }

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
      .from("settlements").select("id, owner_id, payment_amount, received, code")
      .eq("id", body.settlement_id).maybeSingle();
    if (!settlement || settlement.owner_id !== ownerId) {
      return new Response(JSON.stringify({ error: "Not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const received = !!body.received;
    const ts = received ? new Date().toISOString() : null;

    const safeId = body.safe_id || null;

    await admin.from("settlements").update({
      received, received_at: ts, safe_id: received ? safeId : null,
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
        status: received ? "settled" : "delivered",
      }).in("id", orderIds).eq("owner_id", ownerId);
    }

    // Safe deposit / reversal
    if (received && safeId) {
      const { data: safe } = await admin
        .from("safes").select("id, balance").eq("id", safeId).eq("owner_id", ownerId).maybeSingle();
      if (safe) {
        const amount = Number(settlement.payment_amount) || 0;
        const newBalance = Number(safe.balance) + amount;
        await admin.from("safes").update({ balance: newBalance }).eq("id", safeId);
        await admin.from("safe_movements").insert({
          safe_id: safeId, amount, movement_type: "deposit",
          reference_id: settlement.id,
          notes: `إيداع قيمة تسوية ${settlement.id}`,
          owner_id: ownerId,
        });
      }
    }

    // If un-receiving, reverse deposit from safe_movements
    if (!received && settlement.received) {
      const { data: movs } = await admin
        .from("safe_movements")
        .select("id, safe_id, amount")
        .eq("reference_id", settlement.id)
        .eq("movement_type", "deposit");
      for (const m of (movs || [])) {
        const { data: s } = await admin
          .from("safes").select("id, balance").eq("id", m.safe_id).eq("owner_id", ownerId).maybeSingle();
        if (s) {
          const newBalance = Number(s.balance) - Number(m.amount);
          await admin.from("safes").update({ balance: newBalance }).eq("id", m.safe_id);
          await admin.from("safe_movements").insert({
            safe_id: m.safe_id, amount: -Number(m.amount), movement_type: "adjustment",
            reference_id: settlement.id,
            notes: "تراجع عن استلام تسوية",
            owner_id: ownerId,
          });
        }
      }
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
