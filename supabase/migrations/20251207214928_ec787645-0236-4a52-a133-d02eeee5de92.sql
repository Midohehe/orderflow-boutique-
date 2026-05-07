-- Change product_code from text to text array
ALTER TABLE public.products 
DROP COLUMN IF EXISTS product_code;

ALTER TABLE public.products 
ADD COLUMN product_codes text[] DEFAULT '{}'::text[];