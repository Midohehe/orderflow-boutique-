import { supabase } from "@/integrations/supabase/client";
import {
  buildIndexesFromDbMappings,
  computeDeliveryStatsSummary,
  type DeliveryStatsOrder,
} from "@/lib/deliveryStats";
import {
  carrierMappingsFromRows,
  fetchMergedCarrierMappingRows,
} from "@/lib/carrierMappingsForStore";
import type { DeliveryStatsSummary } from "@/lib/deliveryStats";

export interface DeliveryStatsRpcRow {
  confirmed_total: number;
  confirmed_delivered: number;
  other_total: number;
  other_delivered: number;
  carrier_delivered: number;
  carrier_returned: number;
  carrier_in_progress: number;
  carrier_uncategorized: number;
}

const pct = (part: number, total: number) =>
  total > 0 ? Math.round((part / total) * 100) : 0;

export function parseDeliveryStatsRpc(data: DeliveryStatsRpcRow | null): DeliveryStatsSummary | null {
  if (!data) return null;
  const categorizedTotal =
    data.carrier_delivered + data.carrier_returned + data.carrier_in_progress;
  return {
    confirmed: {
      total: data.confirmed_total,
      delivered: data.confirmed_delivered,
      rate: pct(data.confirmed_delivered, data.confirmed_total),
    },
    otherConfirmation: {
      total: data.other_total,
      delivered: data.other_delivered,
      rate: pct(data.other_delivered, data.other_total),
    },
    carrierCategories: {
      delivered: data.carrier_delivered,
      returned: data.carrier_returned,
      in_progress: data.carrier_in_progress,
      uncategorized: data.carrier_uncategorized,
    },
    carrierRates: {
      delivered: pct(data.carrier_delivered, categorizedTotal),
      returned: pct(data.carrier_returned, categorizedTotal),
      in_progress: pct(data.carrier_in_progress, categorizedTotal),
    },
  };
}

async function fetchSentOrdersForDeliveryStats(
  storeId: string,
  productName: string | null,
  productsMap: Record<string, string>,
): Promise<DeliveryStatsOrder[]> {
  const out: DeliveryStatsOrder[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("orders")
      .select(
        "status, confirmation_status, carrier_status, carrier_status_raw, product_id, product_name, shipping_reference",
      )
      .eq("store_id", storeId)
      .eq("is_deleted", false)
      .neq("status", "cancelled")
      .or(
        "shipping_reference.not.is.null,status.in.(shipped,delivered,settled,returned_received,unpacked)",
      )
      .range(from, from + 999);
    if (error) throw error;
    if (!data?.length) break;
    out.push(...(data as DeliveryStatsOrder[]));
    if (data.length < 1000) break;
  }

  if (!productName) return out;
  return out.filter((order) => {
    const name = (order.product_id && productsMap[order.product_id]) || order.product_name;
    return name === productName;
  });
}

async function computeDeliveryStatsClientSide(
  storeId: string,
  ownerId: string | null | undefined,
  productName: string | null,
): Promise<DeliveryStatsSummary> {
  const [{ data: products }, mappingRows] = await Promise.all([
    supabase.from("products").select("id, name").eq("store_id", storeId),
    fetchMergedCarrierMappingRows(storeId, ownerId),
  ]);
  const productsMap: Record<string, string> = {};
  (products || []).forEach((p: { id?: string; name?: string }) => {
    if (p?.id && p?.name) productsMap[p.id] = p.name;
  });
  const indexes = buildIndexesFromDbMappings(carrierMappingsFromRows(mappingRows));
  const orders = await fetchSentOrdersForDeliveryStats(storeId, productName, productsMap);
  return computeDeliveryStatsSummary(orders, indexes, "all", productsMap);
}

export async function fetchDeliveryStatsSummary(
  storeId: string,
  ownerId: string | null | undefined,
  productName: string | null = null,
): Promise<DeliveryStatsSummary | null> {
  return computeDeliveryStatsClientSide(storeId, ownerId, productName);
}

export async function fetchShippedCarrierCounts(
  storeId: string,
  ownerId: string | null | undefined,
): Promise<Record<string, number>> {
  const { data, error } = await supabase.rpc("orders_shipped_carrier_counts", {
    _store_id: storeId,
    _owner_id: ownerId ?? null,
  });
  if (error) throw error;
  const out: Record<string, number> = {};
  (data as Array<{ label: string; cnt: number }> | null)?.forEach((r) => {
    if (r.label) out[r.label] = Number(r.cnt) || 0;
  });
  return out;
}
