ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS carrier_status text,
  ADD COLUMN IF NOT EXISTS carrier_status_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS carrier_status_raw jsonb;

CREATE INDEX IF NOT EXISTS idx_orders_shipping_reference ON public.orders (shipping_reference);