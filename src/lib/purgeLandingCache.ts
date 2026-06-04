import { supabase } from "@/integrations/supabase/client";

const CACHE_PREFIX = "libya_";

/** Clear client sessionStorage cache for a landing slug after admin edits. */
export function clearLandingClientCache(slug: string, username?: string | null) {
  try {
    const keys = [
      `${CACHE_PREFIX}product_${username || "_"}${slug}`,
      `${CACHE_PREFIX}product__${slug}`,
    ];
    keys.forEach((k) => sessionStorage.removeItem(k));
  } catch {
    /* ignore */
  }
}

/** Ask edge function to purge Cloudflare cache for landing paths (no-op if CF not configured). */
export async function purgeLandingCache(slug: string, username?: string | null) {
  clearLandingClientCache(slug, username);
  const paths = [`/p/${slug}`];
  if (username) paths.unshift(`/p/${username}/${slug}`);
  try {
    await supabase.functions.invoke("purge-landing-cache", { body: { paths } });
  } catch {
    /* CF purge is optional */
  }
}
