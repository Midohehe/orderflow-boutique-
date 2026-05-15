-- Ensure usernames are unique
CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_unique ON public.profiles (lower(username));

-- Function to handle new user signup: create profile + default role
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _username text;
  _full_name text;
  _base text;
  _candidate text;
  _i int := 0;
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

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Ensure user_roles has unique (user_id, role) so ON CONFLICT works
CREATE UNIQUE INDEX IF NOT EXISTS user_roles_user_role_unique ON public.user_roles (user_id, role);