
CREATE TABLE IF NOT EXISTS public.store_sku_counters (
  store_id uuid PRIMARY KEY,
  last_value bigint NOT NULL DEFAULT 0
);

ALTER TABLE public.store_sku_counters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner manage store_sku_counters"
ON public.store_sku_counters FOR ALL
USING (has_store_access(store_id) OR has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_store_access(store_id) OR has_role(auth.uid(), 'admin'::app_role));

-- Helper: collect all SKUs already used by products in a store (single + variant)
CREATE OR REPLACE FUNCTION public.store_used_skus(_store_id uuid)
RETURNS SETOF text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT DISTINCT trim(s)
  FROM (
    SELECT unnest(product_codes) AS s FROM public.products
      WHERE store_id IS NOT DISTINCT FROM _store_id
    UNION ALL
    SELECT jsonb_each_text.value AS s
      FROM public.products,
           jsonb_each_text(variant_skus)
      WHERE store_id IS NOT DISTINCT FROM _store_id
  ) t
  WHERE s IS NOT NULL AND trim(s) <> '';
$$;

-- Seed counter from max numeric SKU per store
INSERT INTO public.store_sku_counters (store_id, last_value)
SELECT _store_id,
       COALESCE(MAX(CASE WHEN sku ~ '^[0-9]+$' THEN sku::bigint ELSE 0 END), 0)
FROM (
  SELECT store_id AS _store_id, sku
  FROM public.products,
       LATERAL (SELECT unnest(product_codes) AS sku) u
  UNION ALL
  SELECT store_id AS _store_id, value AS sku
  FROM public.products,
       LATERAL jsonb_each_text(variant_skus)
) z
WHERE _store_id IS NOT NULL
GROUP BY _store_id
ON CONFLICT (store_id) DO UPDATE
SET last_value = GREATEST(public.store_sku_counters.last_value, EXCLUDED.last_value);

-- Generate N next SKUs for a store, skipping any already used
CREATE OR REPLACE FUNCTION public.next_skus_for_store(_store_id uuid, _count integer)
RETURNS text[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _used text[];
  _result text[] := ARRAY[]::text[];
  _n bigint;
  _code text;
BEGIN
  IF _count IS NULL OR _count <= 0 THEN
    RETURN _result;
  END IF;
  IF NOT (has_store_access(_store_id) OR has_role(auth.uid(), 'admin'::app_role)) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT array_agg(s) INTO _used FROM public.store_used_skus(_store_id) s;
  _used := COALESCE(_used, ARRAY[]::text[]);

  INSERT INTO public.store_sku_counters (store_id, last_value)
    VALUES (_store_id, 0)
  ON CONFLICT (store_id) DO NOTHING;

  WHILE array_length(_result, 1) IS NULL OR array_length(_result, 1) < _count LOOP
    UPDATE public.store_sku_counters
      SET last_value = last_value + 1
      WHERE store_id = _store_id
      RETURNING last_value INTO _n;

    _code := lpad(_n::text, 3, '0');
    IF _code = ANY(_used) THEN
      CONTINUE;
    END IF;
    _result := array_append(_result, _code);
    _used := array_append(_used, _code);
  END LOOP;

  RETURN _result;
END;
$$;
