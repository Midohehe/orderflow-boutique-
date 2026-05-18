ALTER TABLE public.prep_list_orders
  ADD CONSTRAINT prep_list_orders_order_id_fkey
  FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;