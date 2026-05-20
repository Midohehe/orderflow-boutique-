
CREATE SEQUENCE IF NOT EXISTS public.order_code_seq START 1;

-- Advance sequence past any existing numeric codes to avoid collisions
SELECT setval(
  'public.order_code_seq',
  GREATEST(
    1,
    COALESCE((
      SELECT MAX(order_code::bigint)
      FROM public.orders
      WHERE order_code ~ '^[0-9]+$'
    ), 0) + 1
  ),
  false
);

CREATE OR REPLACE FUNCTION public.generate_order_code()
 RETURNS text
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  _n bigint;
  _code text;
BEGIN
  LOOP
    _n := nextval('public.order_code_seq');
    _code := lpad(_n::text, 3, '0');
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.orders WHERE order_code = _code);
  END LOOP;
  RETURN _code;
END;
$function$;
