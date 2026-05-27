
ALTER TABLE public.whatsapp_settings 
  ADD COLUMN IF NOT EXISTS provider text NOT NULL DEFAULT 'green_api',
  ADD COLUMN IF NOT EXISTS whatchimp_api_key text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS whatchimp_phone_number_id text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS whatchimp_api_url text NOT NULL DEFAULT 'https://app.whatchimp.com';
