import { supabase } from "@/integrations/supabase/client";
import {
  carrierMappingsFromRows,
  fetchMergedCarrierMappingRows,
} from "@/lib/carrierMappingsForStore";
import { fetchShippedCarrierCounts } from "@/lib/deliveryStatsRpc";
import { fetchMissedOrdersCount } from "@/lib/missedOrders";

const STICKER_COLS =
  "page_width_mm, page_height_mm, font_size, header_text, footer_text, show_barcode, show_logo, fields";

export interface OrdersPageMeta {
  currencySymbol: string | null;
  productsMap: Record<string, string>;
  stickerSettings: Record<string, unknown> | null;
  storeName: string | null;
  walletBalance: number | null;
  statusCounts: Record<string, number>;
  carrierCounts: Record<string, number>;
  confirmationCounts: Record<string, number>;
  deletedCount: number;
  foreignCount: number;
  pendingCountryCounts: Record<string, number>;
  missedCount: number;
  statusMappings: Array<{
    status_code: string;
    custom_label: string | null;
    color: string | null;
    sort_order: number | null;
    category: string | null;
  }>;
}

export async function fetchOrdersPageMeta(
  storeId: string,
  ownerId: string | null | undefined,
): Promise<OrdersPageMeta> {
  const [
    currencyRes,
    mergedMappings,
    productsRes,
    stickerRes,
    headerRes,
    walletRes,
    countsRes,
    carrierCounts,
    missedCount,
  ] = await Promise.all([
    supabase.from("store_settings").select("currency_symbol").eq("store_id", storeId).maybeSingle(),
    fetchMergedCarrierMappingRows(storeId, ownerId),
    supabase.from("products").select("id, name").eq("store_id", storeId),
    supabase.from("sticker_settings").select(STICKER_COLS).eq("store_id", storeId).maybeSingle(),
    supabase.from("header_settings").select("logo_text").eq("store_id", storeId).maybeSingle(),
    ownerId
      ? supabase.from("wallets").select("balance").eq("user_id", ownerId).maybeSingle()
      : Promise.resolve({ data: null } as { data: null }),
    supabase.rpc("orders_page_counts", { _store_id: storeId }),
    fetchShippedCarrierCounts(storeId, ownerId),
    fetchMissedOrdersCount(storeId),
  ]);

  const statusMappings = carrierMappingsFromRows(mergedMappings);

  const productsMap: Record<string, string> = {};
  (productsRes.data || []).forEach((p: { id?: string; name?: string }) => {
    if (p?.id && p?.name) productsMap[p.id] = p.name;
  });

  if (countsRes.error) throw countsRes.error;
  const counts = countsRes.data as { statusCounts: Record<string, number>; confirmationCounts: Record<string, number>; deletedCount: number; foreignCount: number; pendingCountryCounts: Record<string, number> };
  const { statusCounts, confirmationCounts } = counts;

  return {
    currencySymbol: currencyRes.data?.currency_symbol ?? null,
    productsMap,
    stickerSettings: (stickerRes.data as Record<string, unknown>) || null,
    storeName: headerRes.data?.logo_text ?? null,
    walletBalance: walletRes.data?.balance != null ? Number(walletRes.data.balance) : null,
    statusCounts,
    carrierCounts,
    confirmationCounts,
    deletedCount: counts.deletedCount ?? 0,
    foreignCount: counts.foreignCount ?? 0,
    pendingCountryCounts: counts.pendingCountryCounts ?? {},
    missedCount,
    statusMappings,
  };
}
