import { supabase } from "@/integrations/supabase/client";
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

export async function fetchDeliveryStatsSummary(
  storeId: string,
  ownerId: string | null | undefined,
  productName: string | null = null,
): Promise<DeliveryStatsSummary | null> {
  const { data, error } = await supabase.rpc("orders_delivery_stats_summary", {
    _store_id: storeId,
    _owner_id: ownerId ?? null,
    _product_name: productName,
  });
  if (error) throw error;
  return parseDeliveryStatsRpc(data as DeliveryStatsRpcRow | null);
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
