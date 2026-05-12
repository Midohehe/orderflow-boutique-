// Sync warehouse products from the shipping company (Turbo Express) to local DB.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData } = await userClient.auth.getUser();
    if (!userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: settingsRows } = await admin
      .from("shipping_settings")
      .select("*")
      .eq("owner_id", userData.user.id)
      .eq("enabled", true)
      .order("updated_at", { ascending: false })
      .limit(1);
    const settings = settingsRows?.[0];
    if (!settings?.email || !settings?.password) {
      return new Response(JSON.stringify({ error: "إعدادات شركة الشحن غير مكتملة" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: appS } = await admin.from("app_settings").select("shipping_endpoint").maybeSingle();
    const endpoint: string = (appS as any)?.shipping_endpoint || settings.endpoint || "https://turboex.ly:8001/graphql";

    // Login
    const loginRes = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: `mutation Login($input: LoginInput!) { login(input: $input) { token } }`,
        variables: { input: { username: settings.email, password: settings.password, rememberMe: true } },
      }),
    });
    const loginJson = await loginRes.json().catch(() => ({}));
    const token = loginJson?.data?.login?.token;
    if (!token) {
      return new Response(JSON.stringify({ error: "فشل تسجيل الدخول لشركة الشحن", details: loginJson }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch products list (paginated) with availableQuantity
    const products: Array<{ id: number; name: string; code: string; availableQuantity: number }> = [];
    const PAGE_SIZE = 100;
    let page = 1;
    let lastPage = 1;
    do {
      const prodRes = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          query: `query($first:Int!,$page:Int!){ listProducts(first:$first,page:$page){ paginatorInfo { lastPage } data { id code name availableQuantity } } }`,
          variables: { first: PAGE_SIZE, page },
        }),
      });
      const prodJson = await prodRes.json().catch(() => ({}));
      const lp = prodJson?.data?.listProducts;
      if (!lp) break;
      lastPage = Number(lp?.paginatorInfo?.lastPage || 1);
      for (const p of (lp.data || [])) {
        products.push({
          id: Number(p.id),
          name: p.name || "",
          code: p.code || "",
          availableQuantity: Number(p.availableQuantity ?? 0),
        });
      }
      page++;
    } while (page <= lastPage);

    if (products.length === 0) {
      return new Response(JSON.stringify({ ok: true, count: 0, message: "لا توجد منتجات في مخزن الشركة" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Upsert
    const rows = products.map((p) => ({
      owner_id: userData.user.id,
      external_id: p.id,
      code: p.code || null,
      name: p.name || null,
      stock: p.availableQuantity ?? 0,
      synced_at: new Date().toISOString(),
    }));
    const { error: upErr } = await admin
      .from("shipping_warehouse_products")
      .upsert(rows, { onConflict: "owner_id,external_id" });
    if (upErr) {
      return new Response(JSON.stringify({ error: upErr.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true, count: products.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
