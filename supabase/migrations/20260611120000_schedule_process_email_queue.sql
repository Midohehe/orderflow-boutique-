-- Schedule process-email-queue to drain auth/transactional email queues.
-- Uses EMAIL_CRON_SECRET (set same value in Edge Function secrets).

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'process-email-queue') THEN
    PERFORM cron.unschedule('process-email-queue');
  END IF;
END $$;

SELECT cron.schedule(
  'process-email-queue',
  '30 seconds',
  $cron$
  SELECT net.http_post(
    url := 'https://sukehkrhvasfnoheyvvx.supabase.co/functions/v1/process-email-queue',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer WaslaEmailCron2026_M3nP8kQ1vR5w'
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
  $cron$
);
