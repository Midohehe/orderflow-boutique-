-- Public RPC so landing-page visitors (anon) can log confirmation cancellations
-- without depending on edge-function JWT settings.

CREATE OR REPLACE FUNCTION public.log_missed_order(
  _product_id uuid,
  _owner_id uuid,
  _store_id uuid DEFAULT NULL,
  _customer_name text DEFAULT NULL,
  _phone text DEFAULT NULL,
  _address text DEFAULT NULL,
  _city text DEFAULT NULL,
  _governorate text DEFAULT NULL,
  _quantity integer DEFAULT 1,
  _estimated_price numeric DEFAULT NULL,
  _landing_slug text DEFAULT NULL,
  _product_name text DEFAULT NULL,
  _form_data jsonb DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _prod record;
  _sid uuid;
  _qty integer;
  _id uuid;
BEGIN
  IF _product_id IS NULL OR _owner_id IS NULL THEN
    RAISE EXCEPTION 'missing_fields';
  END IF;

  IF COALESCE(trim(_phone), '') = '' AND COALESCE(trim(_customer_name), '') = '' THEN
    RAISE EXCEPTION 'missing_contact';
  END IF;

  SELECT p.id, p.name, p.owner_id, p.store_id, p.is_visible
  INTO _prod
  FROM public.products p
  WHERE p.id = _product_id
  LIMIT 1;

  IF _prod.id IS NULL OR _prod.is_visible IS NOT TRUE THEN
    RAISE EXCEPTION 'product_unavailable';
  END IF;

  IF _prod.owner_id IS DISTINCT FROM _owner_id THEN
    RAISE EXCEPTION 'invalid_owner';
  END IF;

  _sid := COALESCE(_prod.store_id, _store_id);
  IF _sid IS NULL THEN
    RAISE EXCEPTION 'missing_store';
  END IF;

  _qty := GREATEST(1, LEAST(999, COALESCE(_quantity, 1)));

  INSERT INTO public.missed_orders (
    owner_id,
    store_id,
    product_id,
    product_name,
    landing_slug,
    customer_name,
    phone,
    address,
    city,
    governorate,
    quantity,
    estimated_price,
    reason,
    form_data
  ) VALUES (
    _owner_id,
    _sid,
    _product_id,
    COALESCE(NULLIF(trim(_product_name), ''), _prod.name),
    NULLIF(trim(_landing_slug), ''),
    NULLIF(trim(_customer_name), ''),
    NULLIF(trim(_phone), ''),
    NULLIF(trim(_address), ''),
    NULLIF(trim(_city), ''),
    NULLIF(trim(_governorate), ''),
    _qty,
    _estimated_price,
    'confirmation_cancelled',
    _form_data
  )
  RETURNING id INTO _id;

  RETURN _id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_missed_order(
  uuid, uuid, uuid, text, text, text, text, text, integer, numeric, text, text, jsonb
) TO anon, authenticated;

COMMENT ON FUNCTION public.log_missed_order IS
  'Public insert for checkout confirmation cancellations (missed orders).';
