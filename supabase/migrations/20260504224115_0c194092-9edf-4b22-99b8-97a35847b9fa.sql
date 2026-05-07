
ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_slug_key;
CREATE UNIQUE INDEX products_owner_slug_key ON public.products(owner_id, slug);
