CREATE TABLE public.shipping_warehouse_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  external_id integer NOT NULL,
  code text,
  name text,
  synced_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, external_id)
);
CREATE INDEX idx_swp_owner ON public.shipping_warehouse_products(owner_id);
ALTER TABLE public.shipping_warehouse_products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner all swp" ON public.shipping_warehouse_products FOR ALL
  USING (auth.uid() = owner_id OR has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (auth.uid() = owner_id OR has_role(auth.uid(), 'admin'::app_role));