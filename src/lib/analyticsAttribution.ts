const SESSION_KEY = "wasla_analytics_sid";
const ATTRIBUTION_KEY = "wasla_attribution_v1";

/** Stable per browser tab session — used to dedupe page views. */
export function getAnalyticsSessionId(): string {
  try {
    let sid = sessionStorage.getItem(SESSION_KEY);
    if (!sid) {
      sid = crypto.randomUUID();
      sessionStorage.setItem(SESSION_KEY, sid);
    }
    return sid;
  } catch {
    return crypto.randomUUID();
  }
}

export function pageViewStorageKey(slug: string, sessionId: string): string {
  return `wasla_pv_${slug}_${sessionId}`;
}

export function hasTrackedPageView(slug: string, sessionId: string): boolean {
  try {
    return sessionStorage.getItem(pageViewStorageKey(slug, sessionId)) === "1";
  } catch {
    return false;
  }
}

export function markPageViewTracked(slug: string, sessionId: string): void {
  try {
    sessionStorage.setItem(pageViewStorageKey(slug, sessionId), "1");
  } catch {
    /* ignore */
  }
}

/** Canonical traffic source keys used in dashboard charts. */
export function normalizeTrafficSource(raw: string | null | undefined): string {
  const s = (raw || "").trim().toLowerCase();
  if (!s) return "direct";
  if (["fb", "facebook", "meta", "fbads"].includes(s)) return "facebook";
  if (["ig", "instagram", "insta"].includes(s)) return "instagram";
  if (["tiktok", "tt"].includes(s)) return "tiktok";
  if (["google", "gads", "adwords"].includes(s)) return "google";
  if (["twitter", "x"].includes(s)) return "twitter";
  if (["snap", "snapchat"].includes(s)) return "snapchat";
  return s;
}

export interface UrlAttribution {
  utm_source: string;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
  fb_campaign_id: string | null;
  fb_adset_id: string | null;
  fb_ad_id: string | null;
  fbclid: string | null;
}

export function resolveAttributionFromUrl(searchParams: URLSearchParams, referrer = ""): UrlAttribution {
  const fresh = resolveAttributionFromUrlOnce(searchParams, referrer);
  const hasFreshSignal =
    searchParams.get("utm_source") ||
    searchParams.get("fbclid") ||
    searchParams.get("gclid") ||
    searchParams.get("ttclid");

  if (hasFreshSignal) {
    try {
      sessionStorage.setItem(ATTRIBUTION_KEY, JSON.stringify(fresh));
    } catch {
      /* ignore */
    }
    return fresh;
  }

  try {
    const raw = sessionStorage.getItem(ATTRIBUTION_KEY);
    if (raw) return JSON.parse(raw) as UrlAttribution;
  } catch {
    /* ignore */
  }

  return fresh;
}

function resolveAttributionFromUrlOnce(searchParams: URLSearchParams, referrer = ""): UrlAttribution {
  const fbclid = searchParams.get("fbclid") || "";
  const gclid = searchParams.get("gclid") || "";
  const ttclid = searchParams.get("ttclid") || "";

  let utmSource = searchParams.get("utm_source");
  if (!utmSource) {
    if (fbclid) utmSource = "facebook";
    else if (gclid) utmSource = "google";
    else if (ttclid) utmSource = "tiktok";
    else if (/facebook\.com|fb\.com/i.test(referrer)) utmSource = "facebook";
    else if (/instagram\.com/i.test(referrer)) utmSource = "instagram";
    else if (/tiktok\.com/i.test(referrer)) utmSource = "tiktok";
    else if (/google\./i.test(referrer)) utmSource = "google";
    else if (/twitter\.com|x\.com/i.test(referrer)) utmSource = "twitter";
    else if (/snapchat\.com/i.test(referrer)) utmSource = "snapchat";
    else utmSource = "direct";
  }

  return {
    utm_source: normalizeTrafficSource(utmSource),
    utm_medium: searchParams.get("utm_medium") || (fbclid || gclid || ttclid ? "paid" : null),
    utm_campaign: searchParams.get("utm_campaign") || null,
    utm_content: searchParams.get("utm_content") || null,
    utm_term: searchParams.get("utm_term") || null,
    fb_campaign_id: searchParams.get("fb_campaign_id") || searchParams.get("utm_campaign") || null,
    fb_adset_id: searchParams.get("fb_adset_id") || searchParams.get("utm_term") || null,
    fb_ad_id: searchParams.get("fb_ad_id") || searchParams.get("utm_content") || null,
    fbclid: fbclid || null,
  };
}
