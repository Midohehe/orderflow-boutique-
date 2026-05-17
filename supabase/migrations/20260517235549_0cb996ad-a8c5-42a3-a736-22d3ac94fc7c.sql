ALTER TABLE public.products ADD COLUMN IF NOT EXISTS upsell_title text NOT NULL DEFAULT '🎁 عروض خاصة';
ALTER TABLE public.landing_pages ADD COLUMN IF NOT EXISTS upsell_title text;