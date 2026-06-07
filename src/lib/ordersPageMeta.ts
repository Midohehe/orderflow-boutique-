import { supabase } from "@/integrations/supabase/client";

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
  ownerId: string | null | undefined
): Promise<OrdersPageMeta> {
  const [
    currencyRes,
    mapRes,
    productsRes,
    stickerRes,
    headerRes,
    walletRes,
    statusCountsRes,
    carrierCountsRes,
    confirmCountsRes,
    deletedCountRes,
  ] = await Promise.all([
    supabase.from("store_settings").select("currency_symbol").eq("store_id", storeId).maybeSingle(),
    supabase
      .from("carrier_status_mappings")
      .select("status_code, custom_label, color, sort_order, category")
      .eq("store_id", storeId),
    supabase.from("products").select("id, name").eq("store_id", storeId),
    supabase.from("sticker_settings").select(STICKER_COLS).eq("store_id", storeId).maybeSingle(),
    supabase.from("header_settings").select("logo_text").eq("store_id", storeId).maybeSingle(),
    ownerId
      ? supabase.from("wallets").select("balance").eq("user_id", ownerId).maybeSingle()
      : Promise.resolve({ data: null } as { data: null }),
    supabase.rpc("orders_status_counts", { _store_id: storeId }),
    supabase.rpc("orders_shipped_carrier_counts", { _store_id: storeId }),
    supabase.rpc("orders_confirmation_counts", { _store_id: storeId }),
    supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("store_id", storeId)
      .eq("is_deleted", true),
  ]);

  const productsMap: Record<string, string> = {};
  (productsRes.data || []).forEach((p: { id?: string; name?: string }) => {
    if (p?.id && p?.name) productsMap[p.id] = p.name;
  });

  const statusCounts: Record<string, number> = {};
  (statusCountsRes.data as Array<{ status: string; cnt: number }> | null)?.forEach((r) => {
    statusCounts[String(r.status)] = Number(r.cnt) || 0;
  });

  const carrierCounts: Record<string, number> = {};
  (carrierCountsRes.data as Array<{ label: string; cnt: number }> | null)?.forEach((r) => {
    carrierCounts[String(r.label ?? "")] = Number(r.cnt) || 0;
  });

  const confirmationCounts: Record<string, number> = {};
  (confirmCountsRes.data as Array<{ confirmation_status: string; cnt: number }> | null)?.forEach((r) => {
    confirmationCounts[String(r.confirmation_status ?? "unconfirmed")] = Number(r.cnt) || 0;
  });

  return {
    currencySymbol: currencyRes.data?.currency_symbol ?? null,
    productsMap,
    stickerSettings: (stickerRes.data as Record<string, unknown>) || null,
    storeName: headerRes.data?.logo_text ?? null,
    walletBalance: walletRes.data?.balance != null ? Number(walletRes.data.balance) : null,
    statusCounts,
    carrierCounts,
    confirmationCounts,
    deletedCount: deletedCountRes.count ?? 0,
    statusMappings: (mapRes.data as OrdersPageMeta["statusMappings"]) || [],
  };
}
