ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS webhook_token TEXT UNIQUE;

CREATE OR REPLACE FUNCTION public.generate_webhook_token()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.webhook_token IS NULL THEN
    NEW.webhook_token := encode(gen_random_bytes(24), 'hex');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_webhook_token ON public.profiles;
CREATE TRIGGER profiles_webhook_token BEFORE INSERT ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.generate_webhook_token();

UPDATE public.profiles SET webhook_token = encode(gen_random_bytes(24), 'hex') WHERE webhook_token IS NULL;