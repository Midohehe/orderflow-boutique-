-- Fix missed orders for non-admin stores:
-- 1) Log RPC derives owner/store from product (no client owner mismatch).
-- 2) List/count RPCs use has_store_access so store owners/staff can read reliably.
-- 3) Recreate RLS policies + grants.

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.missed_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "store_tenant_select" ON public.missed_orders;
DROP POLICY IF EXISTS "store_tenant_delete" ON public.missed_orders;

CREATE POLICY "store_tenant_select" ON public.missed_orders
  FOR SELECT TO authenticated
  USING (public.rls_store_select(store_id));

CREATE POLICY "store_tenant_delete" ON public.missed_orders
  FOR DELETE TO authenticated
  USING (public.rls_store_select(store_id));

GRANT SELECT, DELETE ON public.missed_orders TO authenticated;

-- ---------------------------------------------------------------------------
-- Log: derive owner/store from product (anon-safe)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.log_missed_order(
  _product_id uuid,
  _owner_id uuid DEFAULT NULL,
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
  _oid uuid;
  _sid uuid;
  _qty integer;
  _id uuid;
BEGIN
  IF _product_id IS NULL THEN
    RAISE EXCEPTION 'missing_product';
  END IF;

  IF COALESCE(trim(_phone), '') = '' AND COALESCE(trim(_customer_name), '') = '' THEN
    RAISE EXCEPTION 'missing_contact';
  END IF;

  SELECT p.id, p.name, p.owner_id, p.store_id, p.is_visible
  INTO _prod
  FROM public.products p
  WHERE p.id = _product_id
    AND p.deleted_at IS NULL
  LIMIT 1;

  IF _prod.id IS NULL THEN
    RAISE EXCEPTION 'product_unavailable';
  END IF;

  -- Prefer authoritative product ownership; client ids are optional hints only.
  _oid := _prod.owner_id;
  _sid := COALESCE(_prod.store_id, _store_id);

  IF _oid IS NULL OR _sid IS NULL THEN
    RAISE EXCEPTION 'missing_store';
  END IF;

  -- If client sent owner/store, ignore mismatches (landing pages sometimes
  -- resolve username/profile differently). Product row is source of truth.

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
    _oid,
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

-- ---------------------------------------------------------------------------
-- List for dashboard (bypasses brittle client RLS edge-cases)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.list_missed_orders_for_store(
  _store_id uuid,
  _limit integer DEFAULT 50,
  _offset integer DEFAULT 0
)
RETURNS TABLE(
  id uuid,
  owner_id uuid,
  store_id uuid,
  product_id uuid,
  product_name text,
  landing_slug text,
  customer_name text,
  phone text,
  address text,
  city text,
  governorate text,
  quantity integer,
  estimated_price numeric,
  reason text,
  created_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR _store_id IS NULL THEN
    RETURN;
  END IF;
  IF NOT public.rls_store_select(_store_id) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    m.id,
    m.owner_id,
    m.store_id,
    m.product_id,
    m.product_name,
    m.landing_slug,
    m.customer_name,
    m.phone,
    m.address,
    m.city,
    m.governorate,
    m.quantity,
    m.estimated_price,
    m.reason,
    m.created_at
  FROM public.missed_orders m
  WHERE m.store_id = _store_id
  ORDER BY m.created_at DESC
  LIMIT GREATEST(1, LEAST(COALESCE(_limit, 50), 200))
  OFFSET GREATEST(0, COALESCE(_offset, 0));
END;
$$;

CREATE OR REPLACE FUNCTION public.count_missed_orders_for_store(_store_id uuid)
RETURNS bigint
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _n bigint;
BEGIN
  IF auth.uid() IS NULL OR _store_id IS NULL THEN
    RETURN 0;
  END IF;
  IF NOT public.rls_store_select(_store_id) THEN
    RETURN 0;
  END IF;

  SELECT COUNT(*) INTO _n
  FROM public.missed_orders m
  WHERE m.store_id = _store_id;

  RETURN COALESCE(_n, 0);
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_missed_orders_for_store(uuid, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.count_missed_orders_for_store(uuid) TO authenticated;
