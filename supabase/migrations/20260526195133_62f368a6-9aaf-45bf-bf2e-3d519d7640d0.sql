CREATE OR REPLACE FUNCTION public.generate_order_code_for_store(_store_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _n bigint;
  _code text;
BEGIN
  IF _store_id IS NULL THEN
    LOOP
      _n := nextval('public.order_code_seq');
      _code := lpad(_n::text, 3, '0');
      EXIT WHEN NOT EXISTS (SELECT 1 FROM public.orders WHERE order_code = _code AND store_id IS NULL);
    END LOOP;
    RETURN _code;
  END IF;

  LOOP
    INSERT INTO public.store_order_counters (store_id, last_value)
      VALUES (_store_id, 1)
    ON CONFLICT (store_id) DO UPDATE
      SET last_value = public.store_order_counters.last_value + 1
    RETURNING last_value INTO _n;

    _code := lpad(_n::text, 3, '0');
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.orders WHERE order_code = _code AND store_id = _store_id
    );
  END LOOP;
  RETURN _code;
END;
$function$;