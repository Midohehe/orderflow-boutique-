
CREATE TABLE public.easyorders_products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL,
  external_id TEXT NOT NULL,
  name TEXT,
  sku TEXT,
  variants JSONB NOT NULL DEFAULT '[]'::jsonb,
  raw JSONB,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (owner_id, external_id)
);

ALTER TABLE public.easyorders_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner all easyorders_products"
ON public.easyorders_products
FOR ALL
USING ((auth.uid() = owner_id) OR has_role(auth.uid(), 'admin'::app_role))
WITH CHECK ((auth.uid() = owner_id) OR has_role(auth.uid(), 'admin'::app_role));

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS easyorders_product_id TEXT,
  ADD COLUMN IF NOT EXISTS variant_easyorders_ids JSONB NOT NULL DEFAULT '{}'::jsonb;
