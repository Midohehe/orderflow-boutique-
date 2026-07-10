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

export async function fetchMissedOrdersPage(
  storeId: string,
  page: number,
  pageSize: number,
  _search?: string,
): Promise<MissedOrdersPageResult> {
  const offset = (page - 1) * pageSize;

  const [{ data, error }, count] = await Promise.all([
    (supabase as any).rpc("list_missed_orders_for_store", {
      _store_id: storeId,
      _limit: pageSize,
      _offset: offset,
    }),
    fetchMissedOrdersCount(storeId),
  ]);

  if (error) throw error;
  return { rows: (data || []) as MissedOrder[], total: count };
}

export async function fetchMissedOrdersCount(storeId: string): Promise<number> {
  const { data, error } = await (supabase as any).rpc("count_missed_orders_for_store", {
    _store_id: storeId,
  });
  if (error) throw error;
  return Number(data) || 0;
}

export type LogMissedOrderPayload = {
  product_id: string;
  owner_id?: string | null;
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

/**
 * Log checkout abandoned at confirmation dialog.
 * Product id is enough — server derives owner/store from the product row.
 */
export async function logMissedOrder(payload: LogMissedOrderPayload): Promise<boolean> {
  if (!payload.product_id) {
    console.error("logMissedOrder: missing product_id");
    return false;
  }
  if (!payload.phone?.trim() && !payload.customer_name?.trim()) {
    console.error("logMissedOrder: missing contact");
    return false;
  }

  const rpcArgs = {
    _product_id: payload.product_id,
    _owner_id: payload.owner_id || null,
    _store_id: payload.store_id || null,
    _customer_name: payload.customer_name || null,
    _phone: payload.phone || null,
    _address: payload.address || null,
    _city: payload.city || null,
    _governorate: payload.governorate || null,
    _quantity: payload.quantity ?? 1,
    _estimated_price: payload.estimated_price ?? null,
    _landing_slug: payload.landing_slug || null,
    _product_name: payload.product_name || null,
    _form_data: payload.form_data ?? null,
  };

  try {
    const { data, error } = await (supabase as any).rpc("log_missed_order", rpcArgs);
    if (!error && data) return true;
    if (error) console.error("logMissedOrder rpc:", error);
  } catch (e) {
    console.error("logMissedOrder rpc exception:", e);
  }

  try {
    const { data, error } = await supabase.functions.invoke("log-missed-order", {
      body: { ...payload, reason: "confirmation_cancelled" },
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
