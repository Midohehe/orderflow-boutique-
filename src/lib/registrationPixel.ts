import { supabase } from "@/integrations/supabase/client";
import { fetchAppSettings } from "@/lib/appSettings";
import { initializePlatformPixel } from "@/lib/platformPixel";
import type { User } from "@supabase/supabase-js";

let inflight: Promise<void> | null = null;
const completed = new Set<string>();
const retryAfter = new Map<string, number>();

export function sendCompletedRegistration(user: User): Promise<void> {
  if (completed.has(user.id) || (retryAfter.get(user.id) ?? 0) > Date.now()) return Promise.resolve();
  if (!window.location.pathname.startsWith("/dashboard")) return Promise.resolve();
  if (inflight) return inflight;
  retryAfter.set(user.id, Date.now() + 60_000);
  inflight = send(user).catch(() => {}).finally(() => { inflight = null; });
  return inflight;
}

async function send(user: User) {
  if (!user?.email_confirmed_at || !user.user_metadata.platform_signup
      || user.user_metadata.sub_user || user.app_metadata.account_type === "courier") return;
  const path = window.location.pathname;
  // Confirmation URLs contain one-time tokens; send only after reaching the dashboard.
  if (!path.startsWith("/dashboard")) return;
  const settings = await fetchAppSettings();
  const id = settings?.platform_facebook_pixel_id;
  if (!id || !initializePlatformPixel(id)) return;
  // Do not consume the one-time claim if the browser blocks Meta's script.
  for (let attempt = 0; attempt < 40 && !window.fbq?.callMethod; attempt++) {
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  if (!window.fbq?.callMethod) return;
  const { data: eventId, error } = await supabase.rpc("claim_platform_registration_event");
  if (error) return;
  completed.add(user.id);
  if (!eventId) return;
  window.fbq("trackSingle", id, "CompleteRegistration", { status: true }, { eventID: eventId });
}
