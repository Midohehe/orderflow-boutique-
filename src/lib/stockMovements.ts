import { supabase } from "@/integrations/supabase/client";

export interface StockMovementRow {
  id: string;
  product_id: string | null;
  product_name: string | null;
  variant_key: string | null;
  warehouse_code: string | null;
  qty: number;
  unit_price: number | null;
  reason: string;
  order_id: string | null;
  return_id: string | null;
  notes: string | null;
  created_at: string;
  store_id?: string | null;
}

const MOVEMENT_COLS =
  "id, product_id, product_name, variant_key, warehouse_code, qty, unit_price, reason, order_id, return_id, notes, created_at, store_id";

const PAGE_SIZE = 1000;

export function computeMovementTotals(rows: Pick<StockMovementRow, "qty">[]) {
  let inQty = 0;
  let outQty = 0;
  for (const r of rows) {
    if (r.qty > 0) inQty += r.qty;
    else if (r.qty < 0) outQty += -r.qty;
  }
  return { inQty, outQty, net: inQty - outQty };
}

/** Fetch all stock movements for a store (paginated server-side). */
export async function fetchStoreStockMovements(
  ownerId: string,
  storeId: string | null
): Promise<StockMovementRow[]> {
  const all: StockMovementRow[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    let q = (supabase as any)
      .from("stock_movements")
      .select(MOVEMENT_COLS)
      .eq("owner_id", ownerId)
      .order("created_at", { ascending: false })
      .range(from, from + PAGE_SIZE - 1);

    if (storeId) {
      q = q.eq("store_id", storeId);
    }

    const { data, error } = await q;
    if (error) throw error;
    const batch = (data as StockMovementRow[]) || [];
    all.push(...batch);
    if (batch.length < PAGE_SIZE) break;
  }
  return all;
}
