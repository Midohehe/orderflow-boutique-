// Marks a settlement as "received" and flags all linked orders as
// settlement_received = true so they appear in the cashbox / financial flow.
//
// Accounting model:
// - On CONFIRM: generate a NEW deposit_ref_id (UUID) and insert a positive
//   `deposit` movement using it as reference_id. Movements are append-only.
// - On REVERSAL: keep the original deposit, generate a NEW reversal_ref_id
//   and insert a NEGATIVE `settlement_reversal` movement. This keeps a full
//   audit trail and lets the same settlement be confirmed→reversed→confirmed
//   multiple times without colliding with the unique index
//   uniq_safe_movements_ref (safe_id, movement_type, reference_id).
// - The `sync_safe_balance` trigger updates safes.balance automatically.
//   Never update safes.balance manually here or it will double-apply.
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
      .from("settlements").select("id, owner_id, payment_amount, received, code, safe_id, deposit_ref_id, reversal_ref_id")
      .eq("id", body.settlement_id).maybeSingle();
    if (!settlement) {
      return new Response(JSON.stringify({ error: "Not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    // Authorization: owner or member of owner, or admin
    const { data: isMember } = await admin.rpc("is_member_of", { _owner_id: settlement.owner_id });
    const { data: isAdmin } = await admin.rpc("has_role", { _user_id: ownerId, _role: "admin" });
    if (!isMember && !isAdmin && settlement.owner_id !== ownerId) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const received = !!body.received;
    const safeId = body.safe_id || null;

    // Idempotency: if state is unchanged, do nothing.
    if (settlement.received === received) {
      return new Response(JSON.stringify({
        ok: true, unchanged: true, updated_orders: 0,
        message: received ? "التسوية مستلمة مسبقاً" : "التسوية غير مستلمة أصلاً",
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (received && !safeId) {
      return new Response(JSON.stringify({ error: "safe_id مطلوب لتأكيد الاستلام" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ownerIdSettlement = settlement.owner_id;
    const ts = received ? new Date().toISOString() : null;

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
      const { error: updErr } = await admin.from("orders").update({
        settlement_received: received,
        settlement_received_at: ts,
        status: received ? "settled" : "delivered",
      }).in("id", orderIds).eq("owner_id", ownerIdSettlement);
      if (updErr) {
        console.error("orders update failed", updErr);
        return new Response(JSON.stringify({ error: updErr.message }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // CONFIRM: append a new deposit movement with a fresh reference code.
    if (received && safeId) {
      const { data: safe } = await admin
        .from("safes").select("id").eq("id", safeId).eq("owner_id", ownerIdSettlement).maybeSingle();
      if (!safe) {
        return new Response(JSON.stringify({ error: "الخزينة غير موجودة أو لا تخص نفس الحساب" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const amount = Number(settlement.payment_amount) || 0;
      // New unique reference for this confirm attempt
      const depositRef = crypto.randomUUID();
      const { error: movErr } = await admin.from("safe_movements").insert({
        safe_id: safeId, amount, movement_type: "deposit",
        reference_id: depositRef,
        notes: `إيداع قيمة تسوية ${settlement.code || settlement.id}`,
        owner_id: ownerIdSettlement,
      });
      if (movErr) {
        console.error("movement insert failed", movErr);
        return new Response(JSON.stringify({ error: movErr.message }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      await admin.from("settlements")
        .update({ deposit_ref_id: depositRef })
        .eq("id", settlement.id);
    }

    // REVERSAL: append a negative settlement_reversal movement (do NOT delete
    // the original deposit). This preserves the audit trail and lets the same
    // settlement be re-confirmed later without unique-constraint collisions.
    if (!received) {
      // Find the active deposit movement to know which safe to debit and how much
      const { data: lastDeposit } = await admin
        .from("safe_movements")
        .select("id, safe_id, amount")
        .eq("reference_id", settlement.deposit_ref_id ?? settlement.id)
        .eq("movement_type", "deposit")
        .maybeSingle();
      if (lastDeposit) {
        const reversalRef = crypto.randomUUID();
        const { error: revErr } = await admin.from("safe_movements").insert({
          safe_id: lastDeposit.safe_id,
          amount: -Number(lastDeposit.amount),
          movement_type: "settlement_reversal",
          reference_id: reversalRef,
          notes: `تراجع عن تسوية ${settlement.code || settlement.id}`,
          owner_id: ownerIdSettlement,
        });
        if (revErr) {
          console.error("reversal insert failed", revErr);
          return new Response(JSON.stringify({ error: revErr.message }), {
            status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        await admin.from("settlements")
          .update({ reversal_ref_id: reversalRef, deposit_ref_id: null })
          .eq("id", settlement.id);
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
