ALTER TABLE public.whatsapp_settings
  ADD COLUMN IF NOT EXISTS whatchimp_template_name text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS whatchimp_template_language text NOT NULL DEFAULT 'ar',
  ADD COLUMN IF NOT EXISTS whatchimp_use_template boolean NOT NULL DEFAULT false;