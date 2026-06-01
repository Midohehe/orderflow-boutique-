CREATE OR REPLACE FUNCTION public.try_mazbot_lock()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT pg_try_advisory_lock(hashtext('mazbot_poll_lock')::bigint);
$$;

CREATE OR REPLACE FUNCTION public.release_mazbot_lock()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT pg_advisory_unlock(hashtext('mazbot_poll_lock')::bigint);
$$;

REVOKE EXECUTE ON FUNCTION public.try_mazbot_lock() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.release_mazbot_lock() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.try_mazbot_lock() TO service_role;
GRANT EXECUTE ON FUNCTION public.release_mazbot_lock() TO service_role;