-- Disk IO reduction: indexes for high sequential-scan tables and common dashboard filters.

-- store_settings: queried by store_id alone (composite unique is owner_id-first)
CREATE INDEX IF NOT EXISTS idx_store_settings_store_id
  ON public.store_settings (store_id);

-- whatsapp_settings: per-store lookups under strict RLS
CREATE INDEX IF NOT EXISTS idx_whatsapp_settings_store_id
  ON public.whatsapp_settings (store_id);

-- orders page tabs: store + deleted + status + sort by created_at
CREATE INDEX IF NOT EXISTS idx_orders_store_tab_list
  ON public.orders (store_id, is_deleted, status, created_at DESC);

-- confirmation center pending queue
CREATE INDEX IF NOT EXISTS idx_orders_store_pending_confirm
  ON public.orders (store_id, created_at)
  WHERE is_deleted = false AND status = 'pending';

-- whatsapp: latest outgoing status per order (confirmation center)
CREATE INDEX IF NOT EXISTS idx_wa_msg_order_out_created
  ON public.whatsapp_messages (order_id, created_at DESC)
  WHERE direction = 'out' AND order_id IS NOT NULL;

-- stock movements store ledger
CREATE INDEX IF NOT EXISTS idx_stock_movements_store_created
  ON public.stock_movements (store_id, created_at DESC)
  WHERE store_id IS NOT NULL;

-- order confirmation attempts by store
CREATE INDEX IF NOT EXISTS idx_order_confirm_attempts_store_created
  ON public.order_confirmation_attempts (store_id, created_at DESC);

-- carrier mappings filtered by store on orders page
CREATE INDEX IF NOT EXISTS idx_carrier_status_mappings_store_owner
  ON public.carrier_status_mappings (store_id, owner_id);

-- sticker settings per store (orders page)
CREATE INDEX IF NOT EXISTS idx_sticker_settings_store_id
  ON public.sticker_settings (store_id)
  WHERE store_id IS NOT NULL;
