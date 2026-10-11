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
  storeId: string,
  signal?: AbortSignal
): Promise<StockMovementRow[]> {
  if (!ownerId || !storeId) throw new Error("اختر المتجر لعرض حركة المنتجات");
  const controller = new AbortController();
  const cancel = () => controller.abort();
  signal?.addEventListener("abort", cancel, { once: true });
  if (signal?.aborted) cancel();
  let timedOut = false;
  const timeout = setTimeout(() => { timedOut = true; controller.abort(); }, 30_000);
  const all: StockMovementRow[] = [];
  let cursor: StockMovementRow | undefined;
  try {
    while (true) {
      if (controller.signal.aborted) throw new Error("تم إيقاف تحميل الحركات");
      let q = (supabase as any)
        .from("stock_movements")
        .select(MOVEMENT_COLS)
        .eq("owner_id", ownerId)
        .eq("store_id", storeId)
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .limit(PAGE_SIZE)
        .abortSignal(controller.signal);

      // A stable cursor avoids skipping/repeating movements when new rows arrive
      // while the history is loading, including rows with identical timestamps.
      if (cursor) {
        q = q.or(`created_at.lt.${cursor.created_at},and(created_at.eq.${cursor.created_at},id.lt.${cursor.id})`);
      }

      const { data, error } = await q;
      if (error) throw error;
      const batch = (data as StockMovementRow[]) || [];
      all.push(...batch);
      if (batch.length < PAGE_SIZE) break;
      cursor = batch[batch.length - 1];
    }
    return all;
  } catch (error) {
    if (timedOut) throw new Error("استغرق تحميل حركة المنتجات وقتًا طويلًا. حاول مرة أخرى.");
    throw error;
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", cancel);
  }
}
