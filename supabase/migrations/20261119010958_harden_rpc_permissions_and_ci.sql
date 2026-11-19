-- Close public access to privileged counter RPCs while preserving the
-- authenticated product/order flows that depend on them.

CREATE OR REPLACE FUNCTION public.generate_order_code_for_store(_store_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  _n bigint;
  _code text;
  _jwt_role text := COALESCE(auth.jwt() ->> 'role', '');
BEGIN
  -- Hosted application traffic may only allocate a code for a store the
  -- signed-in caller can access. Service jobs and direct postgres maintenance
  -- remain available for the trusted checkout/import paths.
  IF session_user <> 'postgres' AND _jwt_role <> 'service_role' THEN
    IF _jwt_role <> 'authenticated'
       OR _store_id IS NULL
       OR NOT public.has_store_access(_store_id) THEN
      RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
    END IF;
  END IF;

  IF _store_id IS NULL THEN
    LOOP
      _n := nextval('public.order_code_seq');
      _code := lpad(_n::text, greatest(3, length(_n::text)), '0');
      EXIT WHEN NOT EXISTS (
        SELECT 1 FROM public.orders
        WHERE order_code = _code AND store_id IS NULL
      );
    END LOOP;
    RETURN _code;
  END IF;

  LOOP
    INSERT INTO public.store_order_counters (store_id, last_value)
      VALUES (_store_id, 1)
    ON CONFLICT (store_id) DO UPDATE
      SET last_value = public.store_order_counters.last_value + 1
    RETURNING last_value INTO _n;

    _code := lpad(_n::text, greatest(3, length(_n::text)), '0');
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.orders
      WHERE order_code = _code AND store_id = _store_id
    );
  END LOOP;
  RETURN _code;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.generate_order_code_for_store(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.generate_order_code_for_store(uuid)
  TO authenticated, service_role;

-- The product editor calls this RPC as the signed-in store user. The function
-- already verifies store access before touching the counter.
REVOKE EXECUTE ON FUNCTION public.next_skus_for_store(uuid, integer)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.next_skus_for_store(uuid, integer)
  TO authenticated;

-- Service-role admin functions need to inspect whether a protected target is
-- an administrator. Ordinary users can still only check their own user id.
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT (
      _user_id = auth.uid()
      OR COALESCE(auth.jwt() ->> 'role', '') = 'service_role'
    )
    AND EXISTS (
      SELECT 1
      FROM public.user_roles
      WHERE user_id = _user_id AND role = _role
    )
$function$;

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role)
  TO authenticated, service_role;
