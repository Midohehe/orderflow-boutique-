-- Add optional product variant fields
ALTER TABLE public.products
ADD COLUMN product_code text,
ADD COLUMN colors text[] DEFAULT '{}',
ADD COLUMN sizes text[] DEFAULT '{}';