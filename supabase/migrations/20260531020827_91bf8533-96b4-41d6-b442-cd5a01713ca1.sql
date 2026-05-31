UPDATE public.whatsapp_settings SET provider = 'whatchimp' WHERE provider IS NULL OR provider <> 'whatchimp';

ALTER TABLE public.whatsapp_settings
  ALTER COLUMN provider SET DEFAULT 'whatchimp',
  DROP COLUMN IF EXISTS instance_id,
  DROP COLUMN IF EXISTS api_token,
  DROP COLUMN IF EXISTS api_url,
  DROP COLUMN IF EXISTS webhook_token;