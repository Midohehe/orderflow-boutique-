import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const FB_VERSION = "v21.0";

async function fbGet(path: string, token: string, params: Record<string, string> = {}) {
  const url = new URL(`https://graph.facebook.com/${FB_VERSION}/${path}`);
  url.searchParams.set("access_token", token);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const r = await fetch(url.toString());
  const j = await r.json();
  if (!r.ok || j.error) throw new Error(j.error?.message || `FB error ${r.status}`);
  return j;
}

async function fbGetAll(path: string, token: string, params: Record<string, string> = {}) {
  let all: any[] = [];
  let next: string | null = null;
  let first = true;
  while (first || next) {
    let j: any;
    if (next) {
      const r = await fetch(next);
      j = await r.json();
      if (!r.ok || j.error) throw new Error(j.error?.message || `FB error ${r.status}`);
    } else {
      j = await fbGet(path, token, { ...params, limit: "100" });
    }
    all = all.concat(j.data || []);
    next = j.paging?.next || null;
    first = false;
    if (all.length > 5000) break; // safety cap
  }
  return all;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization") || "";
    const jwt = auth.replace("Bearer ", "");
    if (!jwt) throw new Error("unauthorized");

    const sb = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: u } = await sb.auth.getUser(jwt);
    if (!u?.user) throw new Error("unauthorized");

    const { store_id, days = 30 } = await req.json();
    if (!store_id) throw new Error("store_id required");

    const { data: store } = await sb.from("stores").select("id, owner_id").eq("id", store_id).maybeSingle();
    if (!store) throw new Error("store not found");
    const { data: ok } = await sb.rpc("is_member_of", { _owner_id: store.owner_id } as any);
    if (!ok && store.owner_id !== u.user.id) throw new Error("forbidden");

    const { data: conn } = await sb.from("store_facebook_connections")
      .select("access_token, ad_account_id").eq("store_id", store_id).maybeSingle();
    if (!conn?.access_token || !conn?.ad_account_id) throw new Error("Facebook not connected for this store");

    const { data: log } = await sb.from("fb_sync_log").insert({
      store_id, owner_id: store.owner_id, status: "running",
    }).select("id").single();
    const logId = log!.id;

    const acct = conn.ad_account_id.startsWith("act_") ? conn.ad_account_id : `act_${conn.ad_account_id}`;
    const token = conn.access_token;

    let campaignsSynced = 0, adsSynced = 0, insightsSynced = 0;

    // 1) Campaigns
    const campaigns = await fbGetAll(`${acct}/campaigns`, token, {
      fields: "id,name,status,objective,daily_budget,lifetime_budget,start_time,stop_time,created_time",
    });
    if (campaigns.length) {
      const rows = campaigns.map((c: any) => ({
        store_id, owner_id: store.owner_id,
        fb_campaign_id: c.id, name: c.name, status: c.status, objective: c.objective,
        daily_budget: c.daily_budget ? Number(c.daily_budget) / 100 : null,
        lifetime_budget: c.lifetime_budget ? Number(c.lifetime_budget) / 100 : null,
        start_time: c.start_time || null, stop_time: c.stop_time || null,
        created_time: c.created_time || null, updated_at: new Date().toISOString(),
      }));
      const { error } = await sb.from("fb_campaigns").upsert(rows, { onConflict: "store_id,fb_campaign_id" });
      if (error) throw error;
      campaignsSynced = rows.length;
    }

    // 2) Ads (with adset + creative thumb + landing URL)
    const ads = await fbGetAll(`${acct}/ads`, token, {
      fields: "id,name,status,adset_id,adset{name},campaign_id,creative{thumbnail_url,object_story_spec,effective_object_story_id,link_url}",
    });
    if (ads.length) {
      const rows = ads.map((a: any) => {
        const cr = a.creative || {};
        const story = cr.object_story_spec || {};
        const landing = cr.link_url || story.link_data?.link || story.video_data?.call_to_action?.value?.link || null;
        return {
          store_id, owner_id: store.owner_id,
          fb_ad_id: a.id, name: a.name, status: a.status,
          fb_adset_id: a.adset_id || null,
          fb_adset_name: a.adset?.name || null,
          fb_campaign_id: a.campaign_id || null,
          creative_thumbnail_url: cr.thumbnail_url || null,
          landing_url: landing,
          updated_at: new Date().toISOString(),
        };
      });
      const { error } = await sb.from("fb_ads").upsert(rows, { onConflict: "store_id,fb_ad_id" });
      if (error) throw error;
      adsSynced = rows.length;
    }

    // 3) Daily insights at ad level for last N days
    const since = new Date(Date.now() - Number(days) * 86400000).toISOString().slice(0, 10);
    const until = new Date().toISOString().slice(0, 10);
    const insights = await fbGetAll(`${acct}/insights`, token, {
      level: "ad",
      time_increment: "1",
      time_range: JSON.stringify({ since, until }),
      fields: "campaign_id,adset_id,ad_id,spend,impressions,clicks,reach,ctr,cpc,cpm,actions,date_start",
    });
    if (insights.length) {
      const rows = insights.map((i: any) => ({
        store_id, owner_id: store.owner_id,
        date: i.date_start,
        fb_campaign_id: i.campaign_id || null,
        fb_adset_id: i.adset_id || null,
        fb_ad_id: i.ad_id || null,
        spend: Number(i.spend) || 0,
        impressions: Number(i.impressions) || 0,
        clicks: Number(i.clicks) || 0,
        reach: Number(i.reach) || 0,
        ctr: i.ctr ? Number(i.ctr) : null,
        cpc: i.cpc ? Number(i.cpc) : null,
        cpm: i.cpm ? Number(i.cpm) : null,
        actions: i.actions || null,
        updated_at: new Date().toISOString(),
      })).filter((r: any) => r.fb_ad_id);
      // Upsert in chunks of 500
      for (let i = 0; i < rows.length; i += 500) {
        const chunk = rows.slice(i, i + 500);
        const { error } = await sb.from("fb_insights_daily").upsert(chunk, { onConflict: "store_id,date,fb_ad_id" });
        if (error) throw error;
      }
      insightsSynced = rows.length;
    }

    await sb.from("fb_sync_log").update({
      finished_at: new Date().toISOString(),
      status: "success",
      campaigns_synced: campaignsSynced,
      ads_synced: adsSynced,
      insights_synced: insightsSynced,
    }).eq("id", logId);

    return new Response(JSON.stringify({
      ok: true, campaigns: campaignsSynced, ads: adsSynced, insights: insightsSynced,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error("fb-sync error", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});