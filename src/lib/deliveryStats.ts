import {
  CARRIER_LABEL_ALIASES,
  type CarrierCategory,
  type CarrierStatusMappingRow,
  mergeCarrierStatusMappings,
} from "@/lib/carrierStatusDefaults";

export interface DeliveryStatsOrder {
  status: string;
  confirmation_status: string | null;
  carrier_status: string | null;
  carrier_status_raw: unknown;
  product_id: string | null;
  product_name: string | null;
  shipping_reference: string | null;
}

export interface CarrierMappingIndexes {
  statusMap: Record<string, string>;
  statusCategoryMap: Record<string, CarrierCategory>;
  labelCategoryMap: Record<string, CarrierCategory>;
  labelOrderMap: Record<string, number>;
}

export interface DeliveryRateBucket {
  total: number;
  delivered: number;
  rate: number;
}

export interface DeliveryStatsSummary {
  confirmed: DeliveryRateBucket;
  /** All sent-to-carrier orders whose confirmation_status is not «confirmed». */
  otherConfirmation: DeliveryRateBucket;
  carrierCategories: {
    delivered: number;
    returned: number;
    in_progress: number;
    uncategorized: number;
  };
  carrierRates: {
    delivered: number;
    returned: number;
    in_progress: number;
  };
}

const ACTIVE_SENT_STATUSES = new Set([
  "shipped",
  "delivered",
  "settled",
  "returned_received",
  "unpacked",
]);

export function buildCarrierMappingIndexes(
  mappings: CarrierStatusMappingRow[],
): CarrierMappingIndexes {
  const statusMap: Record<string, string> = {};
  const statusCategoryMap: Record<string, CarrierCategory> = {};
  const labelCategoryMap: Record<string, CarrierCategory> = {};
  const labelOrderMap: Record<string, number> = {};

  mappings.forEach((row) => {
    const code = String(row.status_code).toUpperCase();
    const label = row.custom_label.trim();
    statusMap[code] = label;
    statusMap[String(row.status_code)] = label;
    if (row.category) {
      statusCategoryMap[code] = row.category;
      statusCategoryMap[String(row.status_code)] = row.category;
      labelCategoryMap[label] = row.category;
    }
    const order = Number(row.sort_order ?? 0);
    if (order > 0 && (labelOrderMap[label] === undefined || order < labelOrderMap[label])) {
      labelOrderMap[label] = order;
    }
  });

  return { statusMap, statusCategoryMap, labelCategoryMap, labelOrderMap };
}

export function buildIndexesFromDbMappings(
  dbMappings: Array<{
    status_code: string;
    custom_label: string | null;
    color?: string | null;
    sort_order?: number | null;
    category?: string | null;
  }>,
): CarrierMappingIndexes {
  return buildCarrierMappingIndexes(mergeCarrierStatusMappings(dbMappings));
}

export function extractCarrierStatusCode(
  order: Pick<DeliveryStatsOrder, "carrier_status" | "carrier_status_raw">,
  statusMap: Record<string, string>,
): string | null {
  const raw = order.carrier_status_raw;
  if (raw && typeof raw === "object") {
    const payload = raw as Record<string, unknown>;
    let base: unknown =
      payload.shipmentStatusCode ??
      payload.shipment_status_code;
    if (base == null || base === "") {
      const st = payload.status;
      if (typeof st === "string") base = st;
      else if (st && typeof st === "object") {
        const stObj = st as Record<string, unknown>;
        base = stObj.code ?? stObj.name;
      }
    }
    if (base != null && base !== "") {
      const baseStr = String(base).trim();
      if (baseStr.toUpperCase() === "DTR") return "DTR";
      const suffix =
        payload.deliveryTypeCode ??
        payload.delivery_type_code ??
        payload.returnTypeCode ??
        payload.return_type_code;
      if (suffix != null && String(suffix).trim() !== "") {
        return (baseStr + String(suffix).trim()).toUpperCase();
      }
      return baseStr.toUpperCase();
    }
  }

  const text = order.carrier_status?.trim();
  if (!text) return null;

  const paren = text.match(/\(([^)]+)\)\s*$/);
  if (paren) return paren[1].trim().toUpperCase();

  const upper = text.toUpperCase();
  if (statusMap[text] || statusMap[upper]) return upper;

  return null;
}

function normalizeLabel(label: string): string {
  const trimmed = label.trim();
  return CARRIER_LABEL_ALIASES[trimmed] ?? trimmed;
}

export function resolveCarrierDisplayLabel(
  order: Pick<DeliveryStatsOrder, "carrier_status" | "carrier_status_raw">,
  statusMap: Record<string, string>,
): string {
  const code = extractCarrierStatusCode(order, statusMap);
  if (code && statusMap[code]) return statusMap[code];

  const text = order.carrier_status?.trim();
  if (!text) return "بدون حالة";

  const paren = text.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
  if (paren) {
    const fromCode = statusMap[paren[2].trim()] ?? statusMap[paren[2].trim().toUpperCase()];
    if (fromCode) return fromCode;
    const base = paren[1].trim();
    return normalizeLabel(base || text);
  }

  const upper = text.toUpperCase();
  return normalizeLabel(statusMap[text] ?? statusMap[upper] ?? text);
}

export function resolveCarrierCategory(
  order: DeliveryStatsOrder,
  indexes: CarrierMappingIndexes,
): CarrierCategory | undefined {
  if (order.status === "delivered" || order.status === "settled") return "delivered";
  if (order.status === "returned_received" || order.status === "unpacked") return "returned";

  const code = extractCarrierStatusCode(order, indexes.statusMap);
  if (code) {
    const cat = indexes.statusCategoryMap[code] ?? indexes.statusCategoryMap[code.toUpperCase()];
    if (cat) return cat;
  }

  const label = normalizeLabel(resolveCarrierDisplayLabel(order, indexes.statusMap));
  const fromLabel = indexes.labelCategoryMap[label];
  if (fromLabel) return fromLabel;

  const raw = order.carrier_status?.trim() || "";
  const paren = raw.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
  const base = paren?.[1]?.trim();
  if (base) {
    const fromBase = indexes.labelCategoryMap[normalizeLabel(base)];
    if (fromBase) return fromBase;
  }

  return undefined;
}

export function isSentToCarrierOrder(order: DeliveryStatsOrder): boolean {
  if (order.status === "cancelled") return false;
  return !!order.shipping_reference || ACTIVE_SENT_STATUSES.has(order.status);
}

export function isOrderDelivered(
  order: DeliveryStatsOrder,
  indexes: CarrierMappingIndexes,
): boolean {
  return resolveCarrierCategory(order, indexes) === "delivered";
}

export function computeShippedCarrierCounts(
  orders: DeliveryStatsOrder[],
  statusMap: Record<string, string>,
): Record<string, number> {
  const raw: Record<string, number> = {};
  orders.forEach((o) => {
    if (o.status !== "shipped") return;
    const label = resolveCarrierDisplayLabel(o, statusMap);
    raw[label] = (raw[label] || 0) + 1;
  });
  return raw;
}

export function computeDeliveryStatsSummary(
  orders: DeliveryStatsOrder[],
  indexes: CarrierMappingIndexes,
  productFilter: string | "all" = "all",
  productsMap: Record<string, string> = {},
): DeliveryStatsSummary {
  const pool = orders.filter(isSentToCarrierOrder).filter((o) => {
    if (productFilter === "all") return true;
    const name = (o.product_id && productsMap[o.product_id]) || o.product_name;
    return name === productFilter;
  });

  const confirmedPool = pool.filter((o) => o.confirmation_status === "confirmed");
  const otherPool = pool.filter((o) => o.confirmation_status !== "confirmed");

  const confirmedDelivered = confirmedPool.filter((o) => isOrderDelivered(o, indexes)).length;
  const otherDelivered = otherPool.filter((o) => isOrderDelivered(o, indexes)).length;

  const carrierCategories = {
    delivered: 0,
    returned: 0,
    in_progress: 0,
    uncategorized: 0,
  };

  pool.forEach((o) => {
    const cat = resolveCarrierCategory(o, indexes);
    if (cat === "delivered") carrierCategories.delivered += 1;
    else if (cat === "returned") carrierCategories.returned += 1;
    else if (cat === "in_progress") carrierCategories.in_progress += 1;
    else carrierCategories.uncategorized += 1;
  });

  const categorizedTotal =
    carrierCategories.delivered +
    carrierCategories.returned +
    carrierCategories.in_progress;

  const pct = (part: number, total: number) =>
    total > 0 ? Math.round((part / total) * 100) : 0;

  return {
    confirmed: {
      total: confirmedPool.length,
      delivered: confirmedDelivered,
      rate: pct(confirmedDelivered, confirmedPool.length),
    },
    otherConfirmation: {
      total: otherPool.length,
      delivered: otherDelivered,
      rate: pct(otherDelivered, otherPool.length),
    },
    carrierCategories,
    carrierRates: {
      delivered: pct(carrierCategories.delivered, categorizedTotal),
      returned: pct(carrierCategories.returned, categorizedTotal),
      in_progress: pct(carrierCategories.in_progress, categorizedTotal),
    },
  };
}
