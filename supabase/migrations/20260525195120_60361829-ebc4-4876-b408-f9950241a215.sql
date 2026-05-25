CREATE OR REPLACE FUNCTION public.get_easyorders_enabled()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT easyorders_enabled FROM public.profiles
     WHERE user_id = public.get_effective_owner_id(auth.uid())
     LIMIT 1),
    false
  );
$$;