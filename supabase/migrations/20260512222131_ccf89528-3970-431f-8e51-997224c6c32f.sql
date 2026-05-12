ALTER TABLE public.app_settings 
ADD COLUMN IF NOT EXISTS shipping_endpoint text NOT NULL DEFAULT 'https://turboex.ly:8001/graphql';