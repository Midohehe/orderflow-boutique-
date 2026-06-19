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
    const uid = userData.user.id;

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

    const { data: ownerData } = await admin.rpc("get_effective_owner_id", { _uid: uid });
    const effectiveOwnerId = (ownerData as string) || uid;

    const { data: settlement } = await admin
      .from("settlements").select("id, owner_id, payment_amount, received, received_at, code, safe_id, deposit_ref_id, reversal_ref_id")
      .eq("id", body.settlement_id).maybeSingle();
    if (!settlement) {
      return new Response(JSON.stringify({ error: "Not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    // Authorization: owner, staff member, or admin (use user-scoped client for auth.uid())
    const { data: isMember } = await supabase.rpc("is_member_of", { _owner_id: settlement.owner_id });
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: uid, _role: "admin" });
    if (!isMember && !isAdmin && settlement.owner_id !== effectiveOwnerId && settlement.owner_id !== uid) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const received = !!body.received;
    const safeId = body.safe_id || settlement.safe_id || null;
    const completingPartial = settlement.received && received && !settlement.deposit_ref_id;

    // Idempotency: if state is unchanged and deposit exists, do nothing.
    if (settlement.received === received && !completingPartial) {
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

    // Reconciliation: compare settlement header amount vs linked shipment lines
    const { data: allShipments } = await admin
      .from("settlement_shipments")
      .select("order_id, paid_amount")
      .eq("settlement_id", settlement.id);
    const linkedSum = (allShipments || [])
      .filter((s: any) => s.order_id)
      .reduce((sum: number, s: any) => sum + Number(s.paid_amount || 0), 0);
    const paymentAmount = Number(settlement.payment_amount) || 0;
    const reconciliation = {
      payment_amount: paymentAmount,
      linked_shipments_sum: linkedSum,
      linked_count: (allShipments || []).filter((s: any) => s.order_id).length,
      total_shipments: (allShipments || []).length,
      delta: paymentAmount - linkedSum,
      ok: paymentAmount === 0 || linkedSum === 0
        ? true
        : Math.abs(paymentAmount - linkedSum) <= Math.max(1, paymentAmount * 0.02),
    };

    const ownerIdSettlement = settlement.owner_id;
    const ts = received
      ? (settlement.received_at || new Date().toISOString())
      : null;

    const { data: shipments } = await admin
      .from("settlement_shipments")
      .select("order_id")
      .eq("settlement_id", settlement.id)
      .not("order_id", "is", null);
    const orderIds = Array.from(new Set((shipments || []).map((s: any) => s.order_id).filter(Boolean)));

    let updatedOrders = 0;

    // Update linked orders first — fail before mutating settlement / safe
    if (orderIds.length) {
      if (received) {
        const { data: settledRows, error: primaryErr } = await admin.from("orders").update({
          settlement_received: true,
          settlement_received_at: ts,
          status: "settled",
        }).in("id", orderIds).eq("owner_id", ownerIdSettlement)
          .in("status", ["shipped", "delivered"])
          .select("id");
        if (primaryErr) {
          console.error("orders primary update failed", primaryErr);
          return new Response(JSON.stringify({ error: primaryErr.message }), {
            status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        updatedOrders += settledRows?.length ?? 0;

        const { data: flaggedRows, error: secondaryErr } = await admin.from("orders").update({
          settlement_received: true,
          settlement_received_at: ts,
        }).in("id", orderIds).eq("owner_id", ownerIdSettlement)
          .eq("settlement_received", false)
          .not("status", "in", '("shipped","delivered","settled")')
          .select("id");
        if (secondaryErr) {
          console.error("orders secondary update failed", secondaryErr);
          return new Response(JSON.stringify({ error: secondaryErr.message }), {
            status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        updatedOrders += flaggedRows?.length ?? 0;
      } else {
        const { data: revertedRows, error: revPrimaryErr } = await admin.from("orders").update({
          settlement_received: false,
          settlement_received_at: null,
          status: "shipped",
        }).in("id", orderIds).eq("owner_id", ownerIdSettlement)
          .eq("status", "settled")
          .select("id");
        if (revPrimaryErr) {
          console.error("orders reversal primary failed", revPrimaryErr);
          return new Response(JSON.stringify({ error: revPrimaryErr.message }), {
            status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        updatedOrders += revertedRows?.length ?? 0;

        const { data: clearedRows, error: revSecondaryErr } = await admin.from("orders").update({
          settlement_received: false,
          settlement_received_at: null,
        }).in("id", orderIds).eq("owner_id", ownerIdSettlement)
          .eq("settlement_received", true)
          .neq("status", "settled")
          .select("id");
        if (revSecondaryErr) {
          console.error("orders reversal secondary failed", revSecondaryErr);
          return new Response(JSON.stringify({ error: revSecondaryErr.message }), {
            status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        updatedOrders += clearedRows?.length ?? 0;
      }
    }

    if (!completingPartial) {
      await admin.from("settlements").update({
        received, received_at: ts, safe_id: received ? safeId : null,
      }).eq("id", settlement.id);
    } else if (received && safeId && !settlement.safe_id) {
      await admin.from("settlements").update({ safe_id: safeId }).eq("id", settlement.id);
    }

    // CONFIRM: append a new deposit movement with a fresh reference code.
    if (received && safeId && !settlement.deposit_ref_id) {
      const { data: safe } = await admin
        .from("safes").select("id, store_id").eq("id", safeId).eq("owner_id", ownerIdSettlement).maybeSingle();
      if (!safe) {
        return new Response(JSON.stringify({ error: "الخزينة غير موجودة أو لا تخص نفس الحساب" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const amount = Number(settlement.payment_amount) || 0;
      const depositRef = crypto.randomUUID();
      const { error: movErr } = await admin.from("safe_movements").insert({
        safe_id: safeId,
        amount,
        movement_type: "deposit",
        reference_id: depositRef,
        notes: `إيداع قيمة تسوية ${settlement.code || settlement.id}`,
        owner_id: ownerIdSettlement,
        store_id: safe.store_id ?? null,
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
        const { data: safeRow } = await admin
          .from("safes").select("store_id").eq("id", lastDeposit.safe_id).maybeSingle();
        const { error: revErr } = await admin.from("safe_movements").insert({
          safe_id: lastDeposit.safe_id,
          amount: -Number(lastDeposit.amount),
          movement_type: "settlement_reversal",
          reference_id: reversalRef,
          notes: `تراجع عن تسوية ${settlement.code || settlement.id}`,
          owner_id: ownerIdSettlement,
          store_id: safeRow?.store_id ?? null,
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

    return new Response(JSON.stringify({
      ok: true,
      updated_orders: updatedOrders,
      completed_partial: completingPartial,
      reconciliation,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
