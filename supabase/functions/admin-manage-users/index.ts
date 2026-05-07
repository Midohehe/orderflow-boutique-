import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
    });

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Verify caller is admin through the caller's JWT/RLS context.
    // This avoids auth.getUser/getClaims calling /user, which can fail when the auth session row is stale.
    const { data: roleRow, error: roleErr } = await userClient
      .from("user_roles")
      .select("user_id, role")
      .eq("role", "admin")
      .maybeSingle();
    if (roleErr) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!roleRow) return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const body = await req.json();
    const action = body.action as string;

    if (action === "list") {
      const { data: profiles } = await admin.from("profiles").select("*").order("created_at", { ascending: false });
      const { data: { users } } = await admin.auth.admin.listUsers();
      const { data: roles } = await admin.from("user_roles").select("user_id, role");
      const merged = (profiles || []).map((p: any) => ({
        ...p,
        email: users.find((u: any) => u.id === p.user_id)?.email || null,
        roles: (roles || []).filter((r: any) => r.user_id === p.user_id).map((r: any) => r.role),
      }));
      return new Response(JSON.stringify({ users: merged }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "create") {
      const { email, password, username, full_name, duration_months } = body;
      if (!email || !password || !username) {
        return new Response(JSON.stringify({ error: "بيانات ناقصة" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      // create auth user (auto-confirm)
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { username, full_name },
      });
      if (createErr || !created.user) {
        return new Response(JSON.stringify({ error: createErr?.message || "فشل الإنشاء" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const newUserId = created.user.id;
      const months = Number(duration_months) || 1;
      const ends = new Date();
      ends.setMonth(ends.getMonth() + months);

      const { error: profErr } = await admin.from("profiles").insert({
        user_id: newUserId,
        username,
        full_name: full_name || null,
        subscription_starts_at: new Date().toISOString(),
        subscription_ends_at: ends.toISOString(),
        is_active: true,
      });
      if (profErr) {
        await admin.auth.admin.deleteUser(newUserId);
        return new Response(JSON.stringify({ error: profErr.message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      await admin.from("user_roles").insert({ user_id: newUserId, role: "user" });
      return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "extend") {
      const { user_id, duration_months } = body;
      const months = Number(duration_months) || 1;
      const { data: prof } = await admin.from("profiles").select("subscription_ends_at").eq("user_id", user_id).maybeSingle();
      const base = prof?.subscription_ends_at && new Date(prof.subscription_ends_at) > new Date()
        ? new Date(prof.subscription_ends_at)
        : new Date();
      base.setMonth(base.getMonth() + months);
      await admin.from("profiles").update({ subscription_ends_at: base.toISOString(), is_active: true }).eq("user_id", user_id);
      return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "toggle_active") {
      const { user_id, is_active } = body;
      await admin.from("profiles").update({ is_active }).eq("user_id", user_id);
      return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "reset_password") {
      const { user_id, new_password } = body;
      if (!new_password || new_password.length < 6) {
        return new Response(JSON.stringify({ error: "كلمة المرور قصيرة" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      await admin.auth.admin.updateUserById(user_id, { password: new_password });
      return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "delete") {
      const { user_id } = body;
      await admin.auth.admin.deleteUser(user_id);
      return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
