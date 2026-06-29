import { supabase } from "@/integrations/supabase/client";
import {
  DEFAULT_CARRIER_STATUS_MAPPINGS,
  mergeCarrierStatusMappings,
  type CarrierStatusMappingRow,
} from "@/lib/carrierStatusDefaults";

type DbCarrierMappingRow = {
  owner_id: string;
  store_id: string | null;
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
  const [{ data: all }, { data: adminRoles }] = await Promise.all([
    supabase
      .from("carrier_status_mappings")
      .select("owner_id, store_id, status_code, custom_label, color, sort_order, category"),
    supabase.from("user_roles").select("user_id").eq("role", "admin"),
  ]);

  const adminIds = new Set((adminRoles || []).map((row) => row.user_id));
  const rows = (all || []) as DbCarrierMappingRow[];

  const platformRows = rows.filter(
    (row) => adminIds.has(row.owner_id) && (row.store_id == null || row.store_id === storeId),
  );
  const ownerRows = ownerId
    ? rows.filter(
        (row) => row.owner_id === ownerId && (row.store_id == null || row.store_id === storeId),
      )
    : [];

  return mergeCarrierStatusMappings([...platformRows, ...ownerRows]);
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

export { DEFAULT_CARRIER_STATUS_MAPPINGS };
