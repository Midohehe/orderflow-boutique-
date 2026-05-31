
ALTER TABLE public.whatsapp_settings
  ADD COLUMN IF NOT EXISTS mazbot_base_url text NOT NULL DEFAULT 'https://mazbot.net/api',
  ADD COLUMN IF NOT EXISTS mazbot_api_key text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS mazbot_email text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS mazbot_password text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS mazbot_template_id text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS mazbot_use_template boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS mazbot_jwt_token text,
  ADD COLUMN IF NOT EXISTS mazbot_jwt_expires_at timestamptz;
