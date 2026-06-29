-- Delivery stats: use ONLY saved carrier_status_mappings (admin + store owner).
-- No built-in default code categories. «لا يحتسب» (NULL category) = excluded from rate buckets.

CREATE OR REPLACE FUNCTION public._merged_carrier_mappings(_store_id uuid, _owner_id uuid)
RETURNS TABLE(status_code text, custom_label text, category text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH admin_rows AS (
    SELECT
      UPPER(m.status_code) AS status_code,
      COALESCE(NULLIF(TRIM(m.custom_label), ''), UPPER(m.status_code)) AS custom_label,
      CASE
        WHEN m.category IN ('delivered', 'returned', 'in_progress') THEN m.category
        ELSE NULL
      END AS category
    FROM public.carrier_status_mappings m
    WHERE EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = m.owner_id
        AND ur.role = 'admin'
    )
    AND (m.store_id IS NULL OR m.store_id = _store_id)
  ),
  owner_rows AS (
    SELECT
      UPPER(m.status_code) AS status_code,
      COALESCE(NULLIF(TRIM(m.custom_label), ''), UPPER(m.status_code)) AS custom_label,
      CASE
        WHEN m.category IN ('delivered', 'returned', 'in_progress') THEN m.category
        ELSE NULL
      END AS category
    FROM public.carrier_status_mappings m
    WHERE m.owner_id = _owner_id
      AND (m.store_id = _store_id OR m.store_id IS NULL)
  )
  SELECT DISTINCT ON (combined.status_code)
    combined.status_code,
    combined.custom_label,
    combined.category
  FROM (
    SELECT 1 AS pri, a.status_code, a.custom_label, a.category FROM admin_rows a
    UNION ALL
    SELECT 2 AS pri, o.status_code, o.custom_label, o.category FROM owner_rows o
  ) combined
  ORDER BY combined.status_code, combined.pri DESC;
$$;

CREATE OR REPLACE FUNCTION public._order_carrier_category(
  _order_status text,
  _carrier_status text,
  _carrier_status_raw jsonb,
  _store_id uuid,
  _owner_id uuid
)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _code text;
  _label text;
  _cat text;
  _base text;
BEGIN
  _code := public._order_extract_carrier_code(_carrier_status, _carrier_status_raw);

  IF _code IS NOT NULL THEN
    SELECT m.category INTO _cat
    FROM public._merged_carrier_mappings(_store_id, _owner_id) m
    WHERE m.status_code = _code
    LIMIT 1;
    IF _cat IS NOT NULL THEN
      RETURN _cat;
    END IF;
  END IF;

  SELECT public._order_carrier_display_label(
    _carrier_status,
    _carrier_status_raw,
    _code,
    (SELECT m.custom_label FROM public._merged_carrier_mappings(_store_id, _owner_id) m WHERE m.status_code = _code LIMIT 1)
  ) INTO _label;

  SELECT m.category INTO _cat
  FROM public._merged_carrier_mappings(_store_id, _owner_id) m
  WHERE m.custom_label = _label
  LIMIT 1;
  IF _cat IS NOT NULL THEN
    RETURN _cat;
  END IF;

  IF _carrier_status ~ '^(.*?)\s*\(([^)]+)\)\s*$' THEN
    _base := TRIM((regexp_match(_carrier_status, '^(.*?)\s*\(([^)]+)\)\s*$'))[1]);
    IF _base IS NOT NULL AND _base <> '' THEN
      SELECT m.category INTO _cat
      FROM public._merged_carrier_mappings(_store_id, _owner_id) m
      WHERE m.custom_label = public._carrier_label_alias(_base)
      LIMIT 1;
      IF _cat IS NOT NULL THEN
        RETURN _cat;
      END IF;
    END IF;
  END IF;

  RETURN NULL;
END;
$$;
