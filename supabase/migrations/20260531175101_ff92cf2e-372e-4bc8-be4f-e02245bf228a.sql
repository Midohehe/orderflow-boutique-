
ALTER TABLE public.whatsapp_settings
  ADD COLUMN IF NOT EXISTS wati_api_endpoint TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS wati_access_token TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS wati_template_name TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS wati_broadcast_name TEXT NOT NULL DEFAULT 'order_confirmation',
  ADD COLUMN IF NOT EXISTS wati_use_template BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE public.whatsapp_webhook_tokens
  ALTER COLUMN provider DROP DEFAULT;
ALTER TABLE public.whatsapp_webhook_tokens
  ALTER COLUMN provider SET DEFAULT 'wati';
