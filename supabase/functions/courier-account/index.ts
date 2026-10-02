import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
const headers = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...headers, "Content-Type": "application/json" } });
Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response(null, { headers });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const token = req.headers.get("Authorization")?.replace(/^Bearer /, "");
    if (!token) return json({ error: "Unauthorized" }, 401);
    const { data: { user }, error: authError } = await admin.auth.getUser(token);
    if (authError || !user) return json({ error: "Unauthorized" }, 401);
    const body = await req.json();
    if (typeof body.courier_id !== "string" || !["create", "reset_password"].includes(body.action)) return json({ error: "طلب غير صالح" }, 400);
    const { data: courier, error: courierError } = await admin.from("couriers").select("id,name,store_id").eq("id", body.courier_id).single();
    if (courierError && courierError.code !== "PGRST116") return json({ error: "تعذّر قراءة بيانات المندوب. حاول مرة أخرى أو تواصل مع الإدارة" }, 500);
    if (!courier) return json({ error: "المندوب غير موجود" }, 404);
    const [{ data: store, error: storeError }, { data: roles, error: roleError }] = await Promise.all([
      admin.from("stores").select("owner_id").eq("id", courier.store_id).single(),
      admin.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin"),
    ]);
    if (storeError || roleError || (store?.owner_id !== user.id && !roles?.length)) return json({ error: "إنشاء حساب المندوب متاح لصاحب المتجر والسوبر أدمن فقط" }, 403);
    const password = body.password;
    if (typeof password !== "string" || password.length < 8 || password.length > 128) return json({ error: "كلمة المرور من 8 إلى 128 حرفًا" }, 400);
    const { data: account, error: accountError } = await admin.from("courier_accounts").select("user_id,username").eq("courier_id", courier.id).maybeSingle();
    if (accountError) return json({ error: "تعذّر قراءة الحساب" }, 500);
    if (body.action === "reset_password") {
      if (!account) return json({ error: "لا يوجد حساب لهذا المندوب" }, 400);
      const { error } = await admin.auth.admin.updateUserById(account.user_id, { password });
      if (error) return json({ error: "تعذّر تغيير كلمة المرور" }, 400);
      return json({ ok: true, username: account.username });
    }
    if (account) return json({ error: "يوجد حساب لهذا المندوب بالفعل" }, 409);
    const username = typeof body.username === "string" ? body.username.trim().toLowerCase() : "";
    if (!/^[a-z0-9_]{3,30}$/.test(username)) return json({ error: "اسم المستخدم من 3 إلى 30 حرفًا إنجليزيًا أو رقمًا أو _" }, 400);
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email: `${username}@couriers.wasla.invalid`, password, email_confirm: true,
      app_metadata: { account_type: "courier" }, user_metadata: { sub_user: true, full_name: courier.name },
    });
    if (createError || !created.user) return json({ error: "تعذّر إنشاء الحساب؛ قد يكون اسم المستخدم مستخدمًا أو كلمة المرور غير مقبولة" }, 400);
    const { error: linkError } = await admin.from("courier_accounts").insert({ courier_id: courier.id, user_id: created.user.id, username });
    if (linkError) {
      // A transport error may occur after the insert committed. Verify before cleanup.
      const { data: linked, error: checkError } = await admin.from("courier_accounts").select("user_id").eq("courier_id", courier.id).maybeSingle();
      if (!checkError && linked?.user_id === created.user.id) return json({ ok: true, username });
      if (!checkError) await admin.auth.admin.deleteUser(created.user.id);
      return json({ error: "تعذّر تأكيد ربط الحساب. أعد تحميل صفحة المندوب قبل المحاولة مجددًا" }, 500);
    }
    return json({ ok: true, username });
  } catch { return json({ error: "تعذّر تنفيذ العملية" }, 500); }
});
