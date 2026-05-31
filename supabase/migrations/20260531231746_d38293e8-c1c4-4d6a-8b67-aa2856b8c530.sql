ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS country_code text;
CREATE INDEX IF NOT EXISTS idx_orders_country_code ON public.orders(country_code);