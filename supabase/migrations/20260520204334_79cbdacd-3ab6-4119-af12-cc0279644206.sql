
CREATE TABLE IF NOT EXISTS public.store_order_counters (
  store_id uuid PRIMARY KEY,
  last_value bigint NOT NULL DEFAULT 0
);

ALTER TABLE public.store_order_counters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin manage store_order_counters"
ON public.store_order_counters FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Seed counters from existing orders per store (max numeric order_code per store)
INSERT INTO public.store_order_counters (store_id, last_value)
SELECT store_id,
       COALESCE(MAX(CASE WHEN order_code ~ '^[0-9]+$' THEN order_code::bigint ELSE 0 END), 0)
FROM public.orders
WHERE store_id IS NOT NULL
GROUP BY store_id
ON CONFLICT (store_id) DO UPDATE
SET last_value = GREATEST(public.store_order_counters.last_value, EXCLUDED.last_value);

-- New function: per-store sequential order code
CREATE OR REPLACE FUNCTION public.generate_order_code_for_store(_store_id uuid)
RETURNS text
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  _n bigint;
  _code text;
BEGIN
  IF _store_id IS NULL THEN
    -- Fallback to global sequence if no store
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

-- Update trigger function to use per-store generator
CREATE OR REPLACE FUNCTION public.set_order_code()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.order_code IS NULL OR NEW.order_code = '' THEN
    NEW.order_code := public.generate_order_code_for_store(NEW.store_id);
  END IF;
  RETURN NEW;
END;
$function$;
