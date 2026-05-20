import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const SCOPES = [
  "ads_read",
  "ads_management",
  "business_management",
  "read_insights",
  "public_profile",
  "email",
].join(",");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization") || "";
    const jwt = auth.replace("Bearer ", "");
    if (!jwt) throw new Error("unauthorized");

    const sb = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: userData, error: userErr } = await sb.auth.getUser(jwt);
    if (userErr || !userData?.user) throw new Error("unauthorized");
    const userId = userData.user.id;

    const { store_id } = await req.json();
    if (!store_id) throw new Error("store_id required");

    // Verify the user owns/has access to this store
    const { data: store } = await sb.from("stores").select("id, owner_id").eq("id", store_id).maybeSingle();
    if (!store) throw new Error("store not found");

    const { data: isMember } = await sb.rpc("is_member_of", { _owner_id: store.owner_id } as any);
    if (!isMember && store.owner_id !== userId) throw new Error("forbidden");

    const { data: cfg } = await sb.from("facebook_app_config" as any).select("app_id").limit(1).maybeSingle();
    const appId = (cfg as any)?.app_id;
    if (!appId) throw new Error("Facebook App ID not configured");

    // Create state token
    const token = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
    await sb.from("facebook_oauth_states" as any).insert({
      token,
      store_id,
      owner_id: store.owner_id,
    });

    const redirectUri = `${SUPABASE_URL}/functions/v1/facebook-oauth-callback`;
    const url = new URL("https://www.facebook.com/v21.0/dialog/oauth");
    url.searchParams.set("client_id", appId);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("state", token);
    url.searchParams.set("scope", SCOPES);
    url.searchParams.set("response_type", "code");

    return new Response(JSON.stringify({ auth_url: url.toString(), redirect_uri: redirectUri }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});