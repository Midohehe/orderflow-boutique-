-- Fix: STABLE RPC cannot call seed_store_defaults (INSERT) inside a read-only transaction.
-- Seeding already runs on store creation and in the merchant dashboard load path.
CREATE OR REPLACE FUNCTION public.get_public_order_form_fields(
  _owner_id uuid,
  _store_id uuid DEFAULT NULL
)
RETURNS TABLE(
  id uuid,
  field_key text,
  label text,
  placeholder text,
  field_type text,
  required boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _sid uuid;
BEGIN
  IF _owner_id IS NULL THEN
    RETURN;
  END IF;

  _sid := _store_id;
  IF _sid IS NULL THEN
    SELECT s.id INTO _sid
    FROM public.stores s
    WHERE s.owner_id = _owner_id AND s.is_default = true
    LIMIT 1;
  END IF;
  IF _sid IS NULL THEN
    SELECT s.id INTO _sid
    FROM public.stores s
    WHERE s.owner_id = _owner_id
    ORDER BY s.created_at ASC
    LIMIT 1;
  END IF;

  RETURN QUERY
  SELECT
    f.id,
    f.field_key,
    f.label,
    f.placeholder,
    f.field_type,
    f.required
  FROM public.order_form_fields f
  INNER JOIN public.form_field_catalog c
    ON c.field_key = f.field_key AND c.admin_enabled = true
  WHERE f.owner_id = _owner_id
    AND f.store_id = _sid
    AND f.enabled = true
  ORDER BY f.sort_order ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_order_form_fields(uuid, uuid) TO anon, authenticated;
