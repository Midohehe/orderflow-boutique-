CREATE TABLE public.platform_registration_events (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  event_id uuid NOT NULL DEFAULT gen_random_uuid(),
  claimed_at timestamptz
);
ALTER TABLE public.platform_registration_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.platform_registration_events FROM anon, authenticated;

CREATE FUNCTION public.prepare_platform_registration_event() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.raw_user_meta_data->>'platform_signup' = 'true'
     AND COALESCE(NEW.raw_user_meta_data->>'sub_user', 'false') <> 'true'
     AND COALESCE(NEW.raw_app_meta_data->>'account_type', '') <> 'courier' THEN
    INSERT INTO public.platform_registration_events(user_id) VALUES (NEW.id);
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER prepare_platform_registration_event AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.prepare_platform_registration_event();
REVOKE ALL ON FUNCTION public.prepare_platform_registration_event() FROM PUBLIC;

CREATE FUNCTION public.claim_platform_registration_event() RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE result uuid;
BEGIN
  UPDATE public.platform_registration_events e SET claimed_at = now()
  WHERE e.user_id = auth.uid() AND e.claimed_at IS NULL
    AND EXISTS (SELECT 1 FROM auth.users u WHERE u.id = auth.uid() AND u.email_confirmed_at IS NOT NULL)
  RETURNING e.event_id INTO result;
  RETURN result;
END;
$$;
REVOKE ALL ON FUNCTION public.claim_platform_registration_event() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_platform_registration_event() TO authenticated;
