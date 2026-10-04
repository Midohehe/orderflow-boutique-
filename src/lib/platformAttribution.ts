// Separate from merchant/order attribution. Never persist URLs, emails or passwords.
const key = "wasla_platform_signup_source_v1";
const fields = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"] as const;
export function capturePlatformAttribution(search: string): void {
  try {
    const params = new URLSearchParams(search);
    const values = Object.fromEntries(fields.flatMap(field => {
      const value = params.get(field)?.trim().slice(0, 200);
      return value ? [[field, value]] : [];
    }));
    if (Object.keys(values).length) sessionStorage.setItem(key, JSON.stringify(values));
  } catch { /* Signup works when browser storage is unavailable. */ }
}
export function readPlatformAttribution(): Record<string, string> | undefined {
  try {
    const stored = JSON.parse(sessionStorage.getItem(key) || "null");
    if (!stored || typeof stored !== "object") return;
    const values = Object.fromEntries(fields.flatMap(field => typeof stored[field] === "string" && stored[field].trim()
      ? [[field, stored[field].trim().slice(0, 200)]] : []));
    return Object.keys(values).length ? values : undefined;
  } catch { return; }
}
