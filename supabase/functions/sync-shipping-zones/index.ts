// Fetches all zones (cities) and their areas from the shipping company
// and stores them in public.shipping_zones for fast lookup + AI matching.
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

    // Resolve effective owner (sub-user → parent owner)
    let ownerId = userData.user.id;
    const { data: member } = await admin
      .from("store_members").select("owner_id").eq("member_user_id", ownerId).maybeSingle();
    if (member?.owner_id) ownerId = member.owner_id;

    const { data: settingsList } = await admin
      .from("shipping_settings").select("*").eq("owner_id", ownerId).limit(1);
    const settings = settingsList?.[0];
    if (!settings?.enabled || !settings.email || !settings.password) {
      return new Response(JSON.stringify({ error: "إعدادات شركة الشحن غير مكتملة" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: appS } = await admin.from("app_settings").select("shipping_endpoint").maybeSingle();
    const endpoint: string = (appS as any)?.shipping_endpoint || settings.endpoint || "https://turboex.ly:8001/graphql";

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

    const gql = async (query: string, variables: Record<string, unknown> = {}) => {
      const r = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ query, variables }),
      });
      return await r.json().catch(() => ({}));
    };

    // Fetch top-level zones (cities)
    const zonesRes = await gql(`{ listZonesDropdown { id name } }`);
    const zones: Array<{ id: number; name: string }> = zonesRes?.data?.listZonesDropdown || [];

    const rows: Array<{ external_id: number; parent_external_id: number | null; name: string; kind: string; owner_id: string }> = [];
    for (const z of zones) {
      rows.push({ external_id: z.id, parent_external_id: null, name: z.name, kind: "zone", owner_id: ownerId });
    }

    // Fetch areas/sub-zones for each city in parallel batches
    let areaCount = 0;
    const fetchAreas = async (z: { id: number; name: string }) => {
      const childRes = await gql(
        `query ChildZones($input: ListZonesFilterInput) { listZonesDropdown(input: $input) { id name } }`,
        { input: { parentId: z.id } },
      );
      let children: Array<{ id: number; name: string }> = childRes?.data?.listZonesDropdown || [];
      if (children.length === 0) {
        const ar = await gql(`query Areas($cityId: Int) { listAreasDropdown(cityId: $cityId) { id name } }`, { cityId: z.id });
        children = ar?.data?.listAreasDropdown || [];
      }
      return children.map((c) => ({ external_id: c.id, parent_external_id: z.id, name: c.name, kind: "area", owner_id: ownerId }));
    };

    const concurrency = 8;
    for (let i = 0; i < zones.length; i += concurrency) {
      const batch = zones.slice(i, i + concurrency);
      const results = await Promise.all(batch.map(fetchAreas));
      for (const arr of results) {
        rows.push(...arr);
        areaCount += arr.length;
      }
    }

    // Replace this owner's cached zones
    await admin.from("shipping_zones").delete().eq("owner_id", ownerId);
    const chunkSize = 500;
    for (let i = 0; i < rows.length; i += chunkSize) {
      const chunk = rows.slice(i, i + chunkSize);
      const { error } = await admin.from("shipping_zones").insert(chunk);
      if (error) console.error("insert chunk error", error);
    }

    return new Response(JSON.stringify({ ok: true, zones: zones.length, areas: areaCount, total: rows.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
