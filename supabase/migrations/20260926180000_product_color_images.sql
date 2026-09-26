ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS color_images jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.products.color_images IS
  'Optional color name to image URL mapping; color names remain the stock/order keys.';

NOTIFY pgrst, 'reload schema';
