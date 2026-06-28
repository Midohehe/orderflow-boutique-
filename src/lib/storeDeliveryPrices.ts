import type { SupabaseClient } from "@supabase/supabase-js";
import type { OrderFormField } from "@/lib/landingOrderForm";

export interface StoreDeliveryPrice {
  city_name: string;
  price: number;
  sort_order?: number;
}

export function orderFormUsesDeliverySelect(fields: OrderFormField[]): boolean {
  return fields.some((f) => f.field_type === "delivery_select" || f.field_key === "delivery_city");
}

export function lookupDeliveryFee(
  cityName: string | undefined | null,
  prices: StoreDeliveryPrice[],
): number {
  const key = (cityName || "").trim();
  if (!key) return 0;
  const row = prices.find((p) => p.city_name === key);
  return Number(row?.price ?? 0);
}

export async function fetchPublicDeliveryPrices(
  supabase: SupabaseClient,
  storeId: string | null,
): Promise<StoreDeliveryPrice[]> {
  if (!storeId) return [];
  const { data, error } = await supabase.rpc("get_public_delivery_prices", {
    _store_id: storeId,
  });
  if (error || !Array.isArray(data)) return [];
  return (data as StoreDeliveryPrice[]).map((r) => ({
    city_name: String(r.city_name),
    price: Number(r.price) || 0,
    sort_order: Number(r.sort_order) || 0,
  }));
}
