import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
    });
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    const { data: u, error: uErr } = await userClient.auth.getUser();
    if (uErr || !u?.user) return json({ error: "Unauthorized" }, 401);
    const callerId = u.user.id;

    // Caller must be a store owner (NOT a sub-user) or super-admin
    const { data: existingMember } = await admin
      .from("store_members").select("id").eq("member_user_id", callerId).maybeSingle();
    if (existingMember) return json({ error: "المستخدم الفرعي لا يمكنه إنشاء مستخدمين" }, 403);

    const body = await req.json();
    const action = body.action as string;

    if (action === "list") {
      const { data: members, error } = await admin
        .from("store_members")
        .select("id, member_user_id, group_id, display_name, created_at")
        .eq("owner_id", callerId)
        .order("created_at", { ascending: false });
      if (error) return json({ error: error.message }, 400);

      const ids = (members || []).map((m: any) => m.member_user_id);
      const emails: Record<string, string> = {};
      if (ids.length) {
        const { data: list } = await admin.auth.admin.listUsers();
        for (const au of list.users || []) if (ids.includes(au.id)) emails[au.id] = au.email || "";
      }
      const { data: extras } = await admin
        .from("store_member_permissions")
        .select("member_id, permission_key")
        .in("member_id", (members || []).map((m: any) => m.id));

      const merged = (members || []).map((m: any) => ({
        ...m,
        email: emails[m.member_user_id] || null,
        extra_permissions: (extras || []).filter((e: any) => e.member_id === m.id).map((e: any) => e.permission_key),
      }));
      return json({ members: merged });
    }

    if (action === "create") {
      const { email, password, display_name, group_id, extra_permissions } = body;
      if (!email || !password || password.length < 6) return json({ error: "بيانات ناقصة أو كلمة المرور قصيرة" }, 400);

      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: display_name || null, sub_user: true },
      });
      if (createErr || !created.user) return json({ error: createErr?.message || "فشل الإنشاء" }, 400);
      const newId = created.user.id;

      // Remove auto-created profile/role for sub-users (they are not stores)
      await admin.from("profiles").delete().eq("user_id", newId);
      await admin.from("user_roles").delete().eq("user_id", newId);

      const { data: member, error: mErr } = await admin
        .from("store_members")
        .insert({ owner_id: callerId, member_user_id: newId, group_id: group_id || null, display_name: display_name || null })
        .select("id").single();
      if (mErr) {
        await admin.auth.admin.deleteUser(newId);
        return json({ error: mErr.message }, 400);
      }

      const { data: ownerStores } = await admin
        .from("stores")
        .select("id")
        .eq("owner_id", callerId);
      if (ownerStores?.length) {
        await admin.from("store_member_stores").insert(
          ownerStores.map((s: { id: string }) => ({ member_id: member.id, store_id: s.id })),
        );
      }

      if (Array.isArray(extra_permissions) && extra_permissions.length) {
        await admin.from("store_member_permissions").insert(
          extra_permissions.map((k: string) => ({ member_id: member.id, permission_key: k }))
        );
      }
      return json({ ok: true, member_id: member.id });
    }

    if (action === "update") {
      const { member_id, group_id, extra_permissions, display_name } = body;
      const { data: m, error } = await admin.from("store_members")
        .select("id, owner_id").eq("id", member_id).maybeSingle();
      if (error || !m || m.owner_id !== callerId) return json({ error: "غير مسموح" }, 403);
      await admin.from("store_members").update({
        group_id: group_id ?? null,
        display_name: display_name ?? null,
      }).eq("id", member_id);
      await admin.from("store_member_permissions").delete().eq("member_id", member_id);
      if (Array.isArray(extra_permissions) && extra_permissions.length) {
        await admin.from("store_member_permissions").insert(
          extra_permissions.map((k: string) => ({ member_id, permission_key: k }))
        );
      }
      return json({ ok: true });
    }

    if (action === "reset_password") {
      const { member_id, new_password } = body;
      if (!new_password || new_password.length < 6) return json({ error: "كلمة المرور قصيرة" }, 400);
      const { data: m } = await admin.from("store_members").select("member_user_id, owner_id").eq("id", member_id).maybeSingle();
      if (!m || m.owner_id !== callerId) return json({ error: "غير مسموح" }, 403);
      await admin.auth.admin.updateUserById(m.member_user_id, { password: new_password });
      return json({ ok: true });
    }

    if (action === "delete") {
      const { member_id } = body;
      const { data: m } = await admin.from("store_members").select("member_user_id, owner_id").eq("id", member_id).maybeSingle();
      if (!m || m.owner_id !== callerId) return json({ error: "غير مسموح" }, 403);
      await admin.from("store_members").delete().eq("id", member_id);
      await admin.auth.admin.deleteUser(m.member_user_id);
      return json({ ok: true });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e: any) {
    return json({ error: e.message }, 500);
  }
});