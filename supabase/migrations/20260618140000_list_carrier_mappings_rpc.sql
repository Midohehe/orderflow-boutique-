-- Non-admin clients cannot read user_roles (RLS: own row only).
-- Expose merged platform + owner carrier mappings via SECURITY DEFINER RPC.

CREATE OR REPLACE FUNCTION public.list_carrier_mappings_for_store(
  _store_id uuid,
  _owner_id uuid DEFAULT NULL
)
RETURNS TABLE(
  status_code text,
  custom_label text,
  category text,
  color text,
  sort_order integer
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _owner uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_store_access(_store_id) THEN
    RETURN;
  END IF;

  _owner := COALESCE(
    _owner_id,
    (SELECT s.owner_id FROM public.stores s WHERE s.id = _store_id LIMIT 1)
  );

  RETURN QUERY
  WITH merged AS (
    SELECT mm.status_code, mm.custom_label, mm.category
    FROM public._merged_carrier_mappings(_store_id, _owner) mm
  ),
  admin_meta AS (
    SELECT
      UPPER(m.status_code) AS code,
      m.color,
      m.sort_order
    FROM public.carrier_status_mappings m
    WHERE EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = m.owner_id
        AND ur.role = 'admin'
    )
    AND (m.store_id IS NULL OR m.store_id = _store_id)
  ),
  owner_meta AS (
    SELECT
      UPPER(m.status_code) AS code,
      m.color,
      m.sort_order
    FROM public.carrier_status_mappings m
    WHERE m.owner_id = _owner
      AND (m.store_id = _store_id OR m.store_id IS NULL)
  )
  SELECT
    merged.status_code,
    merged.custom_label,
    merged.category,
    COALESCE(owner_meta.color, admin_meta.color, 'default') AS color,
    COALESCE(owner_meta.sort_order, admin_meta.sort_order, 0) AS sort_order
  FROM merged
  LEFT JOIN admin_meta ON admin_meta.code = merged.status_code
  LEFT JOIN owner_meta ON owner_meta.code = merged.status_code;
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_carrier_mappings_for_store(uuid, uuid) TO authenticated;
