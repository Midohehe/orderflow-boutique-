import { supabase } from "@/integrations/supabase/client";

export const ORDER_LIST_COLS =
  "id, customer_name, phone, address, city, governorate, product_name, product_id, price, shipping_fee, status, created_at, selected_color, selected_size, selected_product_code, quantity, shipping_included, shipping_reference, order_code, matched_zone_name, matched_area_name, shipping_error, link_error, carrier_status, carrier_status_updated_at, carrier_status_raw, carrier_cancellation_reason_id, carrier_notes, confirmation_status, confirmation_notes, confirmation_attempts, postponed_until, confirmed_at, is_deleted, locked_insufficient_balance, insufficient_stock, prep_status, upsell_offers, country_code";

export type OrderTab =
  | "pending"
  | "foreign"
  | "shipped"
  | "delivered"
  | "unpacked"
  | "cancelled"
  | "returned_received"
  | "deleted";

export interface OrdersPageFilters {
  productName?: string;
  confirmationStatus?: string;
  prepStatus?: string;
  deliveryType?: "all" | "with" | "without";
  dateFrom?: string;
  dateTo?: string;
  search?: string;
}

export interface OrdersPageResult {
  rows: Record<string, unknown>[];
  total: number;
}

type OrdersQuery = ReturnType<typeof supabase.from>;

function applyTabFilter(q: OrdersQuery, tab: OrderTab): OrdersQuery {
  if (tab === "deleted") {
    return q.eq("is_deleted", true);
  }
  let next = q.eq("is_deleted", false);
  if (tab === "pending") {
    return next.eq("status", "pending").or("country_code.is.null,country_code.eq.LY,country_code.eq.ly");
  }
  if (tab === "foreign") {
    return next.not("country_code", "is", null).neq("country_code", "LY").neq("country_code", "ly");
  }
  if (tab === "delivered") {
    return next.in("status", ["delivered", "settled"]);
  }
  return next.eq("status", tab);
}

export async function fetchOrdersPage(
  storeId: string,
  tab: OrderTab,
  page: number,
  pageSize: number,
  filters: OrdersPageFilters = {}
): Promise<OrdersPageResult> {
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let q = supabase
    .from("orders")
    .select(ORDER_LIST_COLS, { count: "exact" })
    .eq("store_id", storeId)
    .order("created_at", { ascending: false });

  q = applyTabFilter(q, tab);

  if (filters.productName && filters.productName !== "all") {
    q = q.eq("product_name", filters.productName);
  }
  if (filters.confirmationStatus && filters.confirmationStatus !== "all") {
    q = q.eq("confirmation_status", filters.confirmationStatus);
  }
  if (filters.prepStatus && filters.prepStatus !== "all") {
    q = q.eq("prep_status", filters.prepStatus);
  }
  if (filters.deliveryType === "with") {
    q = q.gt("shipping_fee", 0);
  } else if (filters.deliveryType === "without") {
    q = q.eq("shipping_fee", 0);
  }
  if (filters.dateFrom) {
    q = q.gte("created_at", `${filters.dateFrom}T00:00:00`);
  }
  if (filters.dateTo) {
    q = q.lte("created_at", `${filters.dateTo}T23:59:59.999`);
  }
  if (filters.search?.trim()) {
    const s = `%${filters.search.trim()}%`;
    q = q.or(`shipping_reference.ilike.${s},phone.ilike.${s},customer_name.ilike.${s}`);
  }

  const { data, error, count } = await q.range(from, to);
  if (error) throw error;
  return { rows: (data || []) as Record<string, unknown>[], total: count ?? 0 };
}

/** Fetch all rows matching tab+filters (for Excel export). */
export async function fetchAllOrdersForExport(
  storeId: string,
  tab: OrderTab,
  filters: OrdersPageFilters = {},
  maxRows = 5000
): Promise<Record<string, unknown>[]> {
  const pageSize = 500;
  const all: Record<string, unknown>[] = [];
  for (let page = 1; ; page++) {
    const { rows, total } = await fetchOrdersPage(storeId, tab, page, pageSize, filters);
    all.push(...rows);
    if (all.length >= total || rows.length < pageSize || all.length >= maxRows) break;
  }
  return all.slice(0, maxRows);
}
