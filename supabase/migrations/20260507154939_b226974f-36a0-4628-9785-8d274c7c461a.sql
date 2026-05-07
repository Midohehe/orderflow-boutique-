ALTER TABLE public.orders 
  ADD COLUMN IF NOT EXISTS shipping_error text,
  ADD COLUMN IF NOT EXISTS link_error text;