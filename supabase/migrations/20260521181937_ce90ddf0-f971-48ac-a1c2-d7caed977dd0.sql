
CREATE TABLE public.rejected_orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID,
  store_id UUID,
  product_id UUID,
  product_name TEXT,
  landing_slug TEXT,
  customer_name TEXT,
  phone TEXT,
  address TEXT,
  city TEXT,
  quantity INTEGER,
  reason TEXT NOT NULL,
  elapsed_ms INTEGER,
  honeypot_value TEXT,
  client_ip TEXT,
  user_agent TEXT,
  payload JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_rejected_orders_owner_created ON public.rejected_orders(owner_id, created_at DESC);
CREATE INDEX idx_rejected_orders_store_created ON public.rejected_orders(store_id, created_at DESC);

ALTER TABLE public.rejected_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public insert rejected_orders"
  ON public.rejected_orders FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Owner read rejected_orders"
  ON public.rejected_orders FOR SELECT
  USING (is_member_of(owner_id) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Owner delete rejected_orders"
  ON public.rejected_orders FOR DELETE
  USING (is_member_of(owner_id) OR has_role(auth.uid(), 'admin'::app_role));
