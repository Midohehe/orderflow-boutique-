ALTER TABLE public.products ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ NULL;
CREATE INDEX IF NOT EXISTS idx_products_deleted_at ON public.products(deleted_at);