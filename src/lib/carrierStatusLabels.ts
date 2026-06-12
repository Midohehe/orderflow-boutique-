/** Map status_code → custom_label from carrier_status_mappings rows. */
export function buildStatusCodeMap(
  mappings: Array<{ status_code: string; custom_label: string | null }>,
): Record<string, string> {
  const m: Record<string, string> = {};
  mappings.forEach((r) => {
    const label = r.custom_label ?? "";
    const codeKey = String(r.status_code).toUpperCase();
    m[codeKey] = label;
    m[String(r.status_code)] = label;
  });
  return m;
}

/** Canonical display label for a raw carrier_status value or "Label (CODE)" string. */
export function normalizeCarrierDisplayLabel(
  raw: string,
  statusMap: Record<string, string> = {},
): string {
  const trimmed = (raw || "").trim();
  if (!trimmed || trimmed === "null" || trimmed === "undefined") return "بدون حالة";

  const match = trimmed.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
  if (match) {
    const code = match[2].trim();
    const upper = code.toUpperCase();
    const mapped = statusMap[code] ?? statusMap[upper];
    if (mapped) return mapped;
    const base = match[1].trim();
    return base || trimmed;
  }

  const upper = trimmed.toUpperCase();
  return statusMap[trimmed] ?? statusMap[upper] ?? trimmed;
}

/** Merge raw carrier_status counts into one count per display label (no duplicate keys). */
export function aggregateCarrierCounts(
  rawCounts: Record<string, number>,
  statusMap: Record<string, string> = {},
): Record<string, number> {
  const out: Record<string, number> = {};
  Object.entries(rawCounts).forEach(([raw, n]) => {
    const count = Number(n) || 0;
    if (!count) return;
    const label = normalizeCarrierDisplayLabel(raw, statusMap);
    out[label] = (out[label] || 0) + count;
  });
  return out;
}
