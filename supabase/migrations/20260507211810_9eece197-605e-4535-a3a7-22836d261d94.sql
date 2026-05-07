ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS shipping_id text;
CREATE INDEX IF NOT EXISTS idx_orders_shipping_id ON public.orders(shipping_id);