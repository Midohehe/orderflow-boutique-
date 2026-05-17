CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _username text;
  _full_name text;
  _base text;
  _candidate text;
  _i int := 0;
  _slug_base text;
  _slug_candidate text;
  _j int := 0;
  _store_name text;
BEGIN
  _username := NULLIF(trim(NEW.raw_user_meta_data->>'username'), '');
  _full_name := NULLIF(trim(NEW.raw_user_meta_data->>'full_name'), '');
  _base := COALESCE(_username, regexp_replace(split_part(NEW.email, '@', 1), '[^a-zA-Z0-9_]', '', 'g'));
  IF _base IS NULL OR length(_base) = 0 THEN
    _base := 'user' || substring(NEW.id::text, 1, 8);
  END IF;
  _candidate := lower(_base);

  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE lower(username) = _candidate) LOOP
    _i := _i + 1;
    _candidate := lower(_base) || _i::text;
  END LOOP;

  INSERT INTO public.profiles (user_id, username, full_name, is_active)
    VALUES (NEW.id, _candidate, _full_name, true)
    ON CONFLICT DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'user')
    ON CONFLICT DO NOTHING;

  _slug_base := _candidate;
  _slug_candidate := _slug_base;
  WHILE EXISTS (SELECT 1 FROM public.stores WHERE lower(slug) = _slug_candidate) LOOP
    _j := _j + 1;
    _slug_candidate := _slug_base || _j::text;
  END LOOP;
  _store_name := _candidate;

  INSERT INTO public.stores (owner_id, name, slug, is_default)
    VALUES (NEW.id, _store_name, _slug_candidate, true);

  RETURN NEW;
END;
$function$;