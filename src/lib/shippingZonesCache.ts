import { supabase } from "@/integrations/supabase/client";

export type ShippingZoneOption = { id: number; name: string; canonical?: string };

type DbRow = {
  external_id: number;
  name: string;
  display_name: string | null;
  kind: string;
  parent_external_id: number | null;
};

function rowToOption(r: DbRow): ShippingZoneOption {
  return {
    id: r.external_id,
    name: (r.display_name || r.name || "").trim(),
    canonical: (r.name || "").trim(),
  };
}

/** Load all cities + areas from the local shipping_zones cache (one DB round-trip). */
export async function loadShippingZonesFromDb(): Promise<{
  zones: ShippingZoneOption[];
  areasByZoneId: Record<number, ShippingZoneOption[]>;
  empty: boolean;
}> {
  const { data, error } = await supabase
    .from("shipping_zones")
    .select("external_id, name, display_name, kind, parent_external_id")
    .order("name");

  if (error) throw error;

  const zones: ShippingZoneOption[] = [];
  const areasByZoneId: Record<number, ShippingZoneOption[]> = {};

  for (const row of (data || []) as DbRow[]) {
    if (row.kind === "zone") {
      zones.push(rowToOption(row));
    } else if (row.kind === "area" && row.parent_external_id != null) {
      (areasByZoneId[row.parent_external_id] ||= []).push(rowToOption(row));
    }
  }

  zones.sort((a, b) => a.name.localeCompare(b.name, "ar"));
  for (const areas of Object.values(areasByZoneId)) {
    areas.sort((a, b) => a.name.localeCompare(b.name, "ar"));
  }

  return { zones, areasByZoneId, empty: zones.length === 0 };
}

/** Map a stored value (canonical or display name) to the current display name. */
export function remapZoneName(
  value: string,
  options: ShippingZoneOption[],
): string {
  if (!value) return value;
  if (options.some((z) => z.name === value)) return value;
  const byCanon = options.find((z) => z.canonical === value);
  return byCanon ? byCanon.name : value;
}
