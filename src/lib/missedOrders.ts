import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export interface MissedOrder {
  id: string;
  owner_id: string;
  store_id: string;
  product_id: string | null;
  product_name: string | null;
  landing_slug: string | null;
  customer_name: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  governorate: string | null;
  quantity: number;
  estimated_price: number | null;
  reason: string;
  created_at: string;
}

export interface MissedOrdersPageResult {
  rows: MissedOrder[];
  total: number;
}

const MISSED_COLS =
  "id, owner_id, store_id, product_id, product_name, landing_slug, customer_name, phone, address, city, governorate, quantity, estimated_price, reason, created_at";

export async function fetchMissedOrdersPage(
  storeId: string,
  page: number,
  pageSize: number,
  search?: string,
): Promise<MissedOrdersPageResult> {
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let q = supabase
    .from("missed_orders")
    .select(MISSED_COLS, { count: "exact" })
    .eq("store_id", storeId)
    .order("created_at", { ascending: false });

  if (search?.trim()) {
    const s = `%${search.trim()}%`;
    q = q.or(`phone.ilike.${s},customer_name.ilike.${s},product_name.ilike.${s}`);
  }

  const { data, error, count } = await q.range(from, to);
  if (error) throw error;
  return { rows: (data || []) as MissedOrder[], total: count ?? 0 };
}

export async function fetchMissedOrdersCount(storeId: string): Promise<number> {
  const { count, error } = await supabase
    .from("missed_orders")
    .select("id", { count: "exact", head: true })
    .eq("store_id", storeId);
  if (error) throw error;
  return count ?? 0;
}

export type LogMissedOrderPayload = {
  product_id: string;
  owner_id: string;
  store_id?: string | null;
  product_name?: string;
  landing_slug?: string | null;
  customer_name?: string;
  phone?: string;
  address?: string;
  city?: string;
  governorate?: string;
  quantity?: number;
  estimated_price?: number;
  form_data?: Record<string, string>;
};

/** Log checkout abandoned at confirmation dialog. */
export async function logMissedOrder(payload: LogMissedOrderPayload): Promise<boolean> {
  if (!payload.product_id || !payload.owner_id) return false;
  if (!payload.phone?.trim() && !payload.customer_name?.trim()) return false;
  try {
    const { data, error } = await supabase.functions.invoke("log-missed-order", {
      body: {
        ...payload,
        reason: "confirmation_cancelled",
      },
    });
    if (error) {
      console.error("logMissedOrder invoke:", error);
      return false;
    }
    if (data && typeof data === "object" && "error" in data && (data as { error?: string }).error) {
      console.error("logMissedOrder:", (data as { error: string }).error);
      return false;
    }
    return true;
  } catch (e) {
    console.error("logMissedOrder:", e);
    return false;
  }
}
