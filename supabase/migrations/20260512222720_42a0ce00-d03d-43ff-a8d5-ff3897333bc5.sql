CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.generate_webhook_token()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'extensions'
AS $function$
BEGIN
  IF NEW.webhook_token IS NULL THEN
    NEW.webhook_token := encode(extensions.gen_random_bytes(24), 'hex');
  END IF;
  RETURN NEW;
END;
$function$;