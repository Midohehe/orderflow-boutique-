CREATE TABLE public.order_items (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL,
  product_id uuid,
  product_name text NOT NULL,
  selected_color text,
  selected_size text,
  selected_product_code text,
  warehouse_code text,
  easyorders_product_id text,
  easyorders_variant_id text,
  quantity integer NOT NULL DEFAULT 1,
  price numeric NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_order_items_order_id ON public.order_items(order_id);
CREATE INDEX idx_order_items_owner_id ON public.order_items(owner_id);

ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner read order_items" ON public.order_items
  FOR SELECT USING ((auth.uid() = owner_id) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Owner update order_items" ON public.order_items
  FOR UPDATE USING ((auth.uid() = owner_id) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Owner delete order_items" ON public.order_items
  FOR DELETE USING ((auth.uid() = owner_id) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Public insert order_items" ON public.order_items
  FOR INSERT WITH CHECK (true);