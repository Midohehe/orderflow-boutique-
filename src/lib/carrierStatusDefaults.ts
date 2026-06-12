/**
 * Default carrier status codes, labels, and delivery-rate categories.
 * Used when a store owner has not saved custom mappings in carrier_status_mappings.
 * Matches the standard Libyan carrier (Wassal) code set.
 */
export type CarrierCategory = "delivered" | "returned" | "in_progress";

export interface CarrierStatusMappingRow {
  status_code: string;
  custom_label: string;
  category: CarrierCategory | null;
  color?: string;
  sort_order?: number;
}

export const DEFAULT_CARRIER_STATUS_MAPPINGS: CarrierStatusMappingRow[] = [
  { status_code: "PRP", custom_label: "جارى التجهيز", category: "in_progress", sort_order: 10 },
  { status_code: "PRPD", custom_label: "تم التجهيز", category: "in_progress", sort_order: 20 },
  { status_code: "STD", custom_label: "قيد الارسال للمندوب", category: "in_progress", sort_order: 30 },
  { status_code: "DEX", custom_label: "متابعة", category: "in_progress", sort_order: 40 },
  { status_code: "HTR", custom_label: "انتظار لإعادة التوصيل", category: "in_progress", sort_order: 50 },
  { status_code: "PKH", custom_label: "انتظار لإعادة الالتقاط", category: "in_progress", sort_order: 60 },
  { status_code: "OTD", custom_label: "قيد التوصيل", category: "in_progress", sort_order: 70 },
  { status_code: "RITS", custom_label: "RITS", category: "in_progress", sort_order: 80 },
  { status_code: "PKR", custom_label: "PKR", category: "in_progress", sort_order: 90 },
  { status_code: "DTR", custom_label: "تم التسليم", category: "delivered", sort_order: 100 },
  { status_code: "DTRC", custom_label: "تم التسليم والتحصيل", category: "delivered", sort_order: 110 },
  { status_code: "DTRCP", custom_label: "تم التسليم والسداد للعميل", category: "delivered", sort_order: 120 },
  { status_code: "DTRUC", custom_label: "تم التسليم دون تحصيل", category: "delivered", sort_order: 130 },
  { status_code: "RTS", custom_label: "راجع", category: "returned", sort_order: 200 },
  { status_code: "RTSD", custom_label: "راجع لدى المندوب", category: "returned", sort_order: 210 },
  { status_code: "RTSC", custom_label: "راجع لدى الشركة", category: "returned", sort_order: 220 },
  { status_code: "OTR", custom_label: "قيد الإرجاع", category: "returned", sort_order: 230 },
  { status_code: "RTRN", custom_label: "تم الإرجاع للراسل", category: "returned", sort_order: 240 },
  { status_code: "RCV", custom_label: "ارتجاع للمخزن", category: "returned", sort_order: 250 },
  { status_code: "UPKBL", custom_label: "جاهز للتفريغ", category: "returned", sort_order: 260 },
  { status_code: "UPKBD", custom_label: "تم التفريغ", category: "returned", sort_order: 270 },
  { status_code: "UKDB", custom_label: "تم التفريغ", category: "returned", sort_order: 280 },
  { status_code: "BMR", custom_label: "مناولة بين الفروع - وارد", category: "in_progress", sort_order: 300 },
  { status_code: "BMT", custom_label: "مناولة بين الفروع - صادر", category: "in_progress", sort_order: 310 },
];

/** Alternate spellings / labels seen in carrier_status column without a saved mapping row. */
export const CARRIER_LABEL_ALIASES: Record<string, string> = {
  "جاري التجهيز": "جارى التجهيز",
  "متابعة : لدي المندوب": "متابعة",
  "تم الاستلام في الشركه": "تم التجهيز",
  "طلب شحن": "قيد الارسال للمندوب",
};

export function mergeCarrierStatusMappings(
  ownerMappings: Array<{
    status_code: string;
    custom_label: string | null;
    color?: string | null;
    sort_order?: number | null;
    category?: string | null;
  }>,
): CarrierStatusMappingRow[] {
  const byCode = new Map<string, CarrierStatusMappingRow>();
  for (const d of DEFAULT_CARRIER_STATUS_MAPPINGS) {
    byCode.set(d.status_code.toUpperCase(), { ...d });
  }
  for (const row of ownerMappings) {
    const code = String(row.status_code).toUpperCase();
    const category =
      row.category === "delivered" || row.category === "returned" || row.category === "in_progress"
        ? row.category
        : byCode.get(code)?.category ?? null;
    byCode.set(code, {
      status_code: code,
      custom_label: row.custom_label?.trim() || byCode.get(code)?.custom_label || code,
      category,
      color: row.color ?? undefined,
      sort_order: row.sort_order ?? byCode.get(code)?.sort_order,
    });
  }
  return Array.from(byCode.values());
}
