// Returns zones (cities) and optionally areas under a given zone, live from the carrier API.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { defaultCityAreas } from "../_shared/defaultCityAreas.ts";

const normalizeAr = (s: string) =>
  (s || "")
    .replace(/[\u064B-\u0652\u0670]/g, "") // diacritics
    .replace(/[إأآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

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
      return new Response(JSON.stringify({ error: "فشل تسجيل الدخول لشركة الشحن" }), {
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

    const body = await req.json().catch(() => ({} as any));
    const zoneId: number | undefined = body?.zoneId;
    const zoneName: string | undefined = body?.zoneName;

    if (zoneId) {
      // Areas of a city = zones whose parent.id === zoneId.
      // Fetch the full zone list with parent info and filter locally — the
      // carrier's `listZonesDropdown(input:{parentId})` filter is unreliable.
      const allRes = await gql(`{ listZonesDropdown { id name parent { id } } }`);
      const all: Array<{ id: number; name: string; parent?: { id: number } | null }> =
        allRes?.data?.listZonesDropdown || [];
      let areas: Array<{ id: number; name: string }> = all
        .filter((it) => it?.parent?.id === zoneId)
        .map((it) => ({ id: it.id, name: it.name }));

      // Fallback: legacy listAreasDropdown endpoint, then local map.
      if (areas.length === 0) {
        const ar = await gql(
          `query Areas($cityId: Int) { listAreasDropdown(cityId: $cityId) { id name } }`,
          { cityId: zoneId },
        );
        areas = ar?.data?.listAreasDropdown || [];
      }
      if (areas.length === 0) {
        const cityName = zoneName || all.find((z) => z.id === zoneId)?.name;
        if (cityName) {
          const key = Object.keys(defaultCityAreas).find((k) => normalizeAr(k) === normalizeAr(cityName));
          const localAreas = key ? defaultCityAreas[key] : [];
          const flatByName = new Map(all.map((it) => [normalizeAr(it.name), it]));
          areas = localAreas.map((n, idx) => {
            const found = flatByName.get(normalizeAr(n));
            return found ? { id: found.id, name: found.name } : { id: -(idx + 1), name: n };
          });
        }
      }
      return new Response(JSON.stringify({ areas }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Cities = zones with no parent.
    const zonesRes = await gql(`{ listZonesDropdown { id name parent { id } } }`);
    const allItems: Array<{ id: number; name: string; parent?: { id: number } | null }> =
      zonesRes?.data?.listZonesDropdown || [];
    const cityItems = allItems.filter((it) => !it?.parent?.id);

    const seenIds = new Set<number>();
    const seenNames = new Set<string>();
    const zones: Array<{ id: number; name: string }> = [];
    for (const it of cityItems) {
      if (!it?.name) continue;
      const nameKey = normalizeAr(it.name);
      if (seenIds.has(it.id) || seenNames.has(nameKey)) continue;
      seenIds.add(it.id);
      seenNames.add(nameKey);
      zones.push({ id: it.id, name: it.name.trim() });
    }
    zones.sort((a, b) => a.name.localeCompare(b.name, "ar"));
    return new Response(JSON.stringify({ zones }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
