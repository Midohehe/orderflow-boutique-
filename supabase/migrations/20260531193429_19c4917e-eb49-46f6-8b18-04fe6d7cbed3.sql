
ALTER TABLE public.whatsapp_settings
  ADD COLUMN IF NOT EXISTS mazbot_last_polled_at timestamptz;

-- Ensure pg_cron + pg_net are enabled for scheduling
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
