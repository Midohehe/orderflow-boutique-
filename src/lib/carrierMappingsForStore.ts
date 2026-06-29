import { supabase } from "@/integrations/supabase/client";
import {
  mergeCarrierStatusMappings,
  type CarrierStatusMappingRow,
} from "@/lib/carrierStatusDefaults";

type DbCarrierMappingRow = {
  status_code: string;
  custom_label: string | null;
  color?: string | null;
  sort_order?: number | null;
  category?: string | null;
};

/** Platform (super-admin) mappings apply to every store; store-owner rows override. */
export async function fetchMergedCarrierMappingRows(
  storeId: string,
  ownerId: string | null | undefined,
): Promise<CarrierStatusMappingRow[]> {
  const { data, error } = await supabase.rpc("list_carrier_mappings_for_store", {
    _store_id: storeId,
    _owner_id: ownerId ?? null,
  });

  if (!error && Array.isArray(data) && data.length > 0) {
    return mergeCarrierStatusMappings(data as DbCarrierMappingRow[]);
  }

  // Fallback when RPC unavailable: owner rows only (platform rows need server RPC).
  if (!ownerId) return [];

  const { data: ownerRows } = await supabase
    .from("carrier_status_mappings")
    .select("status_code, custom_label, color, sort_order, category")
    .eq("owner_id", ownerId)
    .or(`store_id.eq.${storeId},store_id.is.null`);

  return mergeCarrierStatusMappings((ownerRows || []) as DbCarrierMappingRow[]);
}

export function carrierMappingsFromRows(rows: CarrierStatusMappingRow[]): Array<{
  status_code: string;
  custom_label: string;
  color: string | null;
  sort_order: number | null;
  category: string | null;
}> {
  return rows.map((row) => ({
    status_code: row.status_code,
    custom_label: row.custom_label,
    color: row.color ?? null,
    sort_order: row.sort_order ?? null,
    category: row.category,
  }));
}

export { DEFAULT_CARRIER_STATUS_MAPPINGS } from "@/lib/carrierStatusDefaults";
