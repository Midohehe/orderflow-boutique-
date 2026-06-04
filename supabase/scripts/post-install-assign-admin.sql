-- Post-install: assign admin role and backfill owner_id after first signup
--
-- WHEN: After `db push` and your first signup (or user created in Auth dashboard)
-- WHERE: Supabase Dashboard → SQL Editor
--
-- 1. Replace you@example.com below with your signup email
-- 2. Run the whole script

DO $$
DECLARE
  _email text := 'you@example.com';  -- ◄◄◄ CHANGE THIS
  _uid uuid;
BEGIN
  SELECT id INTO _uid FROM auth.users WHERE email = _email LIMIT 1;

  IF _uid IS NULL THEN
    RAISE EXCEPTION 'No user for email %. Sign up first, then re-run.', _email;
  END IF;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (_uid, 'admin'::public.app_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  UPDATE public.profiles
  SET is_active = true, subscription_ends_at = NULL
  WHERE user_id = _uid;

  UPDATE public.products            SET owner_id = _uid WHERE owner_id IS NULL;
  UPDATE public.orders              SET owner_id = _uid WHERE owner_id IS NULL;
  UPDATE public.purchases           SET owner_id = _uid WHERE owner_id IS NULL;
  UPDATE public.shipping_settings   SET owner_id = _uid WHERE owner_id IS NULL;
  UPDATE public.shipping_zones      SET owner_id = _uid WHERE owner_id IS NULL;
  UPDATE public.header_settings     SET owner_id = _uid WHERE owner_id IS NULL;
  UPDATE public.store_settings      SET owner_id = _uid WHERE owner_id IS NULL;
  UPDATE public.pixel_settings      SET owner_id = _uid WHERE owner_id IS NULL;
  UPDATE public.order_form_fields   SET owner_id = _uid WHERE owner_id IS NULL;
  UPDATE public.analytics_events    SET owner_id = _uid WHERE owner_id IS NULL;

  -- Safe only after backfill above (seed rows from early migrations)
  IF EXISTS (SELECT 1 FROM public.store_settings WHERE owner_id IS NULL) THEN
    RAISE EXCEPTION 'store_settings still has NULL owner_id rows';
  END IF;
  IF EXISTS (SELECT 1 FROM public.order_form_fields WHERE owner_id IS NULL) THEN
    RAISE EXCEPTION 'order_form_fields still has NULL owner_id rows';
  END IF;
  IF EXISTS (SELECT 1 FROM public.header_settings WHERE owner_id IS NULL) THEN
    RAISE EXCEPTION 'header_settings still has NULL owner_id rows';
  END IF;

  ALTER TABLE public.store_settings    ALTER COLUMN owner_id SET NOT NULL;
  ALTER TABLE public.order_form_fields ALTER COLUMN owner_id SET NOT NULL;
  ALTER TABLE public.header_settings   ALTER COLUMN owner_id SET NOT NULL;

  RAISE NOTICE 'Admin assigned: % (%)', _email, _uid;
END $$;
