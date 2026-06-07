-- Landing checkout blockers: anon analytics insert + monthly order limit counts active orders only.

GRANT INSERT ON public.analytics_events TO anon;

CREATE OR REPLACE FUNCTION public.enforce_merchant_plan_limits()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _owner uuid;
  _plan public.subscription_plans;
  _count int;
BEGIN
  _owner := COALESCE(NEW.owner_id, OLD.owner_id);
  IF _owner IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF public.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT * INTO _plan FROM public.get_merchant_plan(_owner);

  IF TG_TABLE_NAME = 'stores' AND TG_OP = 'INSERT' THEN
    SELECT COUNT(*)::int INTO _count FROM public.stores WHERE owner_id = _owner;
    IF public.plan_limit_exceeded(_owner, 'stores', _count, _plan.max_stores) THEN
      RAISE EXCEPTION 'plan_limit:stores:%', _plan.max_stores USING ERRCODE = 'P0001';
    END IF;
  ELSIF TG_TABLE_NAME = 'products' AND TG_OP = 'INSERT' THEN
    SELECT COUNT(*)::int INTO _count FROM public.products WHERE owner_id = _owner AND deleted_at IS NULL;
    IF public.plan_limit_exceeded(_owner, 'products', _count, _plan.max_products) THEN
      RAISE EXCEPTION 'plan_limit:products:%', _plan.max_products USING ERRCODE = 'P0001';
    END IF;
  ELSIF TG_TABLE_NAME = 'store_members' AND TG_OP = 'INSERT' THEN
    SELECT COUNT(*)::int INTO _count FROM public.store_members WHERE owner_id = _owner;
    IF public.plan_limit_exceeded(_owner, 'staff', _count, _plan.max_staff) THEN
      RAISE EXCEPTION 'plan_limit:staff:%', _plan.max_staff USING ERRCODE = 'P0001';
    END IF;
  ELSIF TG_TABLE_NAME = 'orders' AND TG_OP = 'INSERT' THEN
    SELECT COUNT(*)::int INTO _count
    FROM public.orders
    WHERE owner_id = _owner
      AND is_deleted = false
      AND date_trunc('month', created_at) = date_trunc('month', now());
    IF public.plan_limit_exceeded(_owner, 'orders_month', _count, _plan.max_orders_month) THEN
      RAISE EXCEPTION 'plan_limit:orders_month:%', _plan.max_orders_month USING ERRCODE = 'P0001';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.merchant_usage(_owner_id uuid)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _caller uuid := auth.uid();
  _plan public.subscription_plans;
  _stores int;
  _products int;
  _staff int;
  _orders_month int;
BEGIN
  IF _caller IS NULL THEN
    RETURN json_build_object('error', 'unauthorized');
  END IF;

  IF _caller <> _owner_id
     AND NOT public.has_role(_caller, 'admin'::app_role)
     AND NOT public.is_member_of(_owner_id) THEN
    RETURN json_build_object('error', 'forbidden');
  END IF;

  SELECT * INTO _plan FROM public.get_merchant_plan(_owner_id);

  SELECT COUNT(*)::int INTO _stores FROM public.stores WHERE owner_id = _owner_id;
  SELECT COUNT(*)::int INTO _products FROM public.products WHERE owner_id = _owner_id AND deleted_at IS NULL;
  SELECT COUNT(*)::int INTO _staff FROM public.store_members WHERE owner_id = _owner_id;
  SELECT COUNT(*)::int INTO _orders_month
  FROM public.orders
  WHERE owner_id = _owner_id
    AND is_deleted = false
    AND date_trunc('month', created_at) = date_trunc('month', now());

  RETURN json_build_object(
    'plan', json_build_object(
      'id', _plan.id,
      'slug', _plan.slug,
      'name', _plan.name,
      'description', _plan.description,
      'max_stores', _plan.max_stores,
      'max_orders_month', _plan.max_orders_month,
      'max_products', _plan.max_products,
      'max_staff', _plan.max_staff,
      'price_monthly', _plan.price_monthly,
      'currency', _plan.currency,
      'features', _plan.features
    ),
    'usage', json_build_object(
      'stores', _stores,
      'products', _products,
      'staff', _staff,
      'orders_month', _orders_month
    )
  );
END;
$$;
