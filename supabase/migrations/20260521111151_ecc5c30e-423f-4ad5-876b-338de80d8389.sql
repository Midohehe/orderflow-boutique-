DROP INDEX IF EXISTS public.orders_order_code_unique;
CREATE UNIQUE INDEX orders_order_code_unique
  ON public.orders (order_code, COALESCE(store_id, '00000000-0000-0000-0000-000000000000'::uuid));