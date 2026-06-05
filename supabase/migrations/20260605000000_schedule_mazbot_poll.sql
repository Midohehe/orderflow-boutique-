-- Schedule the mazbot-poll Edge Function to sync incoming WhatsApp messages.
-- MazBot does NOT support webhooks, so inbound replies (order confirmations)
-- must be pulled via REST polling. Docs recommend a 10-30s interval and forbid
-- polling faster than once every 5s (HTTP 429). We use 15s.
--
-- The function is deployed with verify_jwt = false, so the public anon key is
-- sufficient to invoke it (no service-role secret required). The anon key is a
-- publishable key and is safe to store in a migration.

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Idempotent: drop any previous schedule before (re)creating it.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'mazbot-poll') THEN
    PERFORM cron.unschedule('mazbot-poll');
  END IF;
END $$;

-- Run every 15 seconds, but only fire the HTTP request when at least one
-- merchant has an enabled, configured MazBot integration (avoids idle traffic).
SELECT cron.schedule(
  'mazbot-poll',
  '15 seconds',
  $cron$
  SELECT net.http_post(
    url := 'https://sukehkrhvasfnoheyvvx.supabase.co/functions/v1/mazbot-poll',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN1a2Voa3JodmFzZm5vaGV5dnZ4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA0OTkyOTAsImV4cCI6MjA5NjA3NTI5MH0.0Hjhq0Qf6xWAGJ2rpiW6fAUwQzw-CU-N4HAR1AfTO4k',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN1a2Voa3JodmFzZm5vaGV5dnZ4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA0OTkyOTAsImV4cCI6MjA5NjA3NTI5MH0.0Hjhq0Qf6xWAGJ2rpiW6fAUwQzw-CU-N4HAR1AfTO4k'
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  )
  WHERE EXISTS (
    SELECT 1 FROM public.whatsapp_settings
    WHERE enabled = true
      AND provider = 'mazbot'
      AND mazbot_api_key IS NOT NULL AND mazbot_api_key <> ''
  );
  $cron$
);
