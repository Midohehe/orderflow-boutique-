import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const caller = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: authError } = await admin.auth.getUser(authHeader.slice(7));
    if (authError || !user) return json({ error: "Unauthorized" }, 401);
    const { data: isAdmin, error: roleError } = await caller.rpc("has_role", { _user_id: user.id, _role: "admin" });
    if (roleError || !isAdmin) return json({ error: "هذه العملية متاحة للسوبر أدمن فقط" }, 403);
    const body = await req.json(); const action = body.action;
    if (action === "list") {
      // Older open Settings tabs receive explicit safe columns, never profile secrets.
      const { data, error } = await caller.rpc("admin_user_directory", { _page_size: 100 });
      if (error) throw error;
      return json({ ...data, users: data.users.map((u: { kind: string; status: string }) => ({ ...u, roles: [u.kind === "admin" ? "admin" : "user"], is_active: u.status !== "disabled" })) });
    }
    if (action === "create") {
      const username = typeof body.username === "string" ? body.username.trim().toLowerCase() : "";
      const email = typeof body.email === "string" ? body.email.trim() : "";
      if (!/^[a-z0-9_-]{3,50}$/.test(username) || !email || typeof body.password !== "string" || body.password.length < 8 || body.password.length > 128) return json({ error: "اسم المستخدم والبريد وكلمة مرور من 8 إلى 128 حرفًا مطلوبة" }, 400);
      const { data: existing, error: lookupError } = await admin.from("profiles").select("user_id").eq("username", username).maybeSingle();
      if (lookupError) throw lookupError;
      if (existing) return json({ error: "اسم المستخدم مستخدم بالفعل" }, 409);
      const { error } = await admin.auth.admin.createUser({ email, password: body.password, email_confirm: true,
        user_metadata: { username, full_name: typeof body.full_name === "string" ? body.full_name.trim().slice(0,120) : null } });
      if (error) throw error;
      // The auth trigger creates profile, default store and role atomically. Do not insert them twice.
      return json({ ok: true });
    }
    if (!["extend", "toggle_active", "reset_password", "delete"].includes(action)) return json({ error: "Unknown action" }, 400);
    if (typeof body.user_id !== "string" || !/^[0-9a-f-]{36}$/i.test(body.user_id)) return json({ error: "المستخدم غير صالح" }, 400);
    const { data: protectedAccount, error: targetError } = await admin.rpc("has_role", { _user_id: body.user_id, _role: "admin" });
    if (targetError) throw targetError;
    if (protectedAccount || body.user_id === user.id) return json({ error: "لا يمكن تعديل حساب سوبر أدمن من هذه القائمة" }, 403);
    if (action === "toggle_active" || action === "extend") {
      if (action === "toggle_active" && typeof body.is_active !== "boolean") return json({ error: "حالة الحساب غير صالحة" }, 400);
      const payload = action === "extend" ? { subscription_ends_at: null, is_active: true } : { is_active: body.is_active };
      const { error } = await admin.from("profiles").update(payload).eq("user_id", body.user_id).select("user_id").single();
      if (error) throw error;
    } else if (action === "reset_password") {
      if (typeof body.new_password !== "string" || body.new_password.length < 8 || body.new_password.length > 128) return json({ error: "كلمة المرور من 8 إلى 128 حرفًا" }, 400);
      const { error } = await admin.auth.admin.updateUserById(body.user_id, { password: body.new_password });
      if (error) throw error;
    } else if (action === "delete") {
      const { error } = await admin.auth.admin.deleteUser(body.user_id);
      if (error) throw error;
    }
    return json({ ok: true });
  } catch (e) { return json({ error: e instanceof Error ? e.message : (e as { message?: string })?.message || "تعذّر تنفيذ العملية" }, 400); }
});
