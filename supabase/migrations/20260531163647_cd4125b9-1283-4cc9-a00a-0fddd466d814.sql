ALTER TABLE public.whatsapp_settings
  ADD COLUMN IF NOT EXISTS whatchimp_template_id TEXT,
  ADD COLUMN IF NOT EXISTS whatchimp_template_buttons TEXT;