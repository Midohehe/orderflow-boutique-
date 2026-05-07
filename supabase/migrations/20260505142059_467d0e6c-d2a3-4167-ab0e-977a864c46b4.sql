ALTER TABLE public.products ADD COLUMN IF NOT EXISTS purchase_price numeric NOT NULL DEFAULT 0;
DROP TABLE IF EXISTS public.purchases;