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
    const { data: settings } = await admin.from("shipping_settings").select("*").maybeSingle();
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

    if (zoneId) {
      // Try child zones first, then areas dropdown
      const childRes = await gql(
        `query ChildZones($input: ListZonesFilterInput) { listZonesDropdown(input: $input) { id name } }`,
        { input: { parentId: zoneId } },
      );
      let areas: Array<{ id: number; name: string }> = childRes?.data?.listZonesDropdown || [];
      if (areas.length === 0) {
        const ar = await gql(
          `query Areas($cityId: Int) { listAreasDropdown(cityId: $cityId) { id name } }`,
          { cityId: zoneId },
        );
        areas = ar?.data?.listAreasDropdown || [];
      }
      return new Response(JSON.stringify({ areas }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const zonesRes = await gql(`{ listZonesDropdown { id name } }`);
    const allItems: Array<{ id: number; name: string }> = zonesRes?.data?.listZonesDropdown || [];

    // The carrier's listZonesDropdown returns a flat union of cities AND areas
    // (with overlapping id sequences). Filter to entries whose name matches a
    // known Libyan city, then dedupe by normalized name.
    const cityNameSet = new Set(Object.keys(defaultCityAreas).map(normalizeAr));
    const seen = new Set<string>();
    const zones: Array<{ id: number; name: string }> = [];
    for (const it of allItems) {
      const key = normalizeAr(it.name);
      if (!cityNameSet.has(key)) continue;
      if (seen.has(key)) continue;
      seen.add(key);
      zones.push(it);
    }
    return new Response(JSON.stringify({ zones }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
