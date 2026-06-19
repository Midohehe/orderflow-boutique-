import { DEFAULT_CARRIER_STATUS_MAPPINGS } from "@/lib/carrierStatusDefaults";

/** Select value for the composite «كل التسليمات» filter option. */
export const ALL_DELIVERIES_FILTER_VALUE = "__all_delivered__";
export const ALL_DELIVERIES_FILTER_LABEL = "كل التسليمات";

/** Carrier codes grouped under «كل التسليمات». */
export const ALL_DELIVERIES_STATUS_CODES = ["DTR", "DTRC", "DTRUC"] as const;

const ALL_DELIVERIES_CODE_SET = new Set<string>(ALL_DELIVERIES_STATUS_CODES);

/** Default Arabic labels for the three delivery variants. */
export function defaultAllDeliveriesLabels(): string[] {
  return DEFAULT_CARRIER_STATUS_MAPPINGS.filter((r) =>
    ALL_DELIVERIES_CODE_SET.has(r.status_code.toUpperCase()),
  ).map((r) => r.custom_label);
}

/** Build label set from owner mappings (statusMap) plus defaults. */
export function buildAllDeliveriesLabelSet(statusMap: Record<string, string> = {}): Set<string> {
  const labels = new Set(defaultAllDeliveriesLabels());
  for (const code of ALL_DELIVERIES_STATUS_CODES) {
    const mapped = statusMap[code] ?? statusMap[code.toUpperCase()];
    if (mapped) labels.add(mapped);
  }
  return labels;
}

/** Parse trailing "(CODE)" from a carrier_status display string. */
export function extractCarrierStatusCodeFromText(raw: string | null | undefined): string | null {
  const s = (raw || "").trim();
  if (!s) return null;
  const m = s.match(/\(([^)]+)\)\s*$/);
  if (m) return m[1].trim().toUpperCase();
  const upper = s.toUpperCase();
  if (ALL_DELIVERIES_CODE_SET.has(upper)) return upper;
  return null;
}

export function orderMatchesAllDeliveriesFilter(args: {
  carrierStatus?: string | null;
  label: string;
  statusCode?: string | null;
  deliveredLabels?: Set<string>;
}): boolean {
  const code = (args.statusCode ?? extractCarrierStatusCodeFromText(args.carrierStatus))?.toUpperCase();
  if (code && ALL_DELIVERIES_CODE_SET.has(code)) return true;
  const labels = args.deliveredLabels ?? buildAllDeliveriesLabelSet();
  return labels.has(args.label);
}

/** Sum server-side carrier counts for the three delivery labels. */
export function sumAllDeliveriesServerCounts(
  serverCarrierCounts: Record<string, number>,
  statusMap: Record<string, string> = {},
): number {
  const labels = buildAllDeliveriesLabelSet(statusMap);
  let sum = 0;
  for (const label of labels) {
    sum += Number(serverCarrierCounts[label] || 0);
  }
  return sum;
}
