import { supabase } from "@/integrations/supabase/client";

export interface AppSettingsRow {
  id: string;
  system_name?: string | null;
  order_fee?: number | null;
  wallet_enabled?: boolean | null;
  subscription_currency?: string | null;
  shipping_endpoint?: string | null;
}

let cache: AppSettingsRow | null = null;
let cacheAt = 0;
const TTL_MS = 5 * 60_000;
let inflight: Promise<AppSettingsRow | null> | null = null;

/** Single-row app_settings with in-memory cache to avoid repeated full-table reads. */
export async function fetchAppSettings(force = false): Promise<AppSettingsRow | null> {
  if (!force && cache && Date.now() - cacheAt < TTL_MS) return cache;
  if (!force && inflight) return inflight;

  inflight = supabase
    .from("app_settings")
    .select("id, system_name, order_fee, wallet_enabled, subscription_currency, shipping_endpoint")
    .limit(1)
    .maybeSingle()
    .then(({ data, error }) => {
      inflight = null;
      if (error) throw error;
      cache = (data as AppSettingsRow) || null;
      cacheAt = Date.now();
      return cache;
    })
    .catch((e) => {
      inflight = null;
      throw e;
    });

  return inflight;
}

export function invalidateAppSettingsCache() {
  cache = null;
  cacheAt = 0;
}
