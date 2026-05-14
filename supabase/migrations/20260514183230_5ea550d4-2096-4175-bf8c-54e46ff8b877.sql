ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS upsell_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS upsell_offers jsonb NOT NULL DEFAULT '[]'::jsonb;