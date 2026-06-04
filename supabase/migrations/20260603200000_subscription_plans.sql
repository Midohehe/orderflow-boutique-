-- Phase 6: SaaS subscription plans + usage limits per merchant

CREATE TABLE IF NOT EXISTS public.subscription_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  max_stores integer NOT NULL DEFAULT 1,
  max_orders_month integer NOT NULL DEFAULT 500,
  max_products integer NOT NULL DEFAULT 100,
  max_staff integer NOT NULL DEFAULT 3,
  price_monthly numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'LYD',
  features jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_public boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT plan_limits_sane CHECK (
    max_stores <> 0 AND max_orders_month <> 0 AND max_products <> 0 AND max_staff <> 0
  )
);

COMMENT ON COLUMN public.subscription_plans.max_stores IS '-1 = unlimited';
COMMENT ON COLUMN public.subscription_plans.max_orders_month IS '-1 = unlimited per calendar month';
COMMENT ON COLUMN public.subscription_plans.max_products IS '-1 = unlimited';
COMMENT ON COLUMN public.subscription_plans.max_staff IS '-1 = unlimited sub-users';

ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read subscription plans"
  ON public.subscription_plans FOR SELECT
  USING (is_public = true OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admin manage subscription plans"
  ON public.subscription_plans FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_subscription_plans_updated
  BEFORE UPDATE ON public.subscription_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.subscription_plans (
  slug, name, description, max_stores, max_orders_month, max_products, max_staff,
  price_monthly, currency, features, is_public, sort_order
) VALUES
  (
    'free',
    'مجاني',
    'مناسب للبداية — متجر واحد وحدود معقولة',
    1, 300, 50, 2, 0, 'LYD',
    '["متجر واحد","300 طلب/شهر","50 منتج","2 موظف"]'::jsonb,
    true, 0
  ),
  (
    'starter',
    'Starter',
    'للمتاجر النامية — عدة متاجر وطلبات أكثر',
    3, 3000, 500, 8, 49, 'LYD',
    '["3 متاجر","3000 طلب/شهر","500 منتج","8 موظفين","دعم أولوية"]'::jsonb,
    true, 1
  ),
  (
    'pro',
    'Pro',
    'للفرق والوكالات — حدود مرتفعة',
    10, 15000, 5000, 25, 149, 'LYD',
    '["10 متاجر","15000 طلب/شهر","5000 منتج","25 موظف","API (قريباً)"]'::jsonb,
    true, 2
  ),
  (
    'enterprise',
    'Enterprise',
    'بدون حدود — للمؤسسات',
    -1, -1, -1, -1, 499, 'LYD',
    '["متاجر غير محدودة","طلبات غير محدودة","منتجات غير محدودة","موظفون غير محدودون","مدير حساب"]'::jsonb,
    true, 3
  )
ON CONFLICT (slug) DO NOTHING;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS plan_id uuid REFERENCES public.subscription_plans(id) ON DELETE SET NULL;

UPDATE public.profiles p
SET plan_id = sp.id
FROM public.subscription_plans sp
WHERE p.plan_id IS NULL AND sp.slug = 'free';

-- Resolve billing owner (merchant account, not staff)
CREATE OR REPLACE FUNCTION public.resolve_merchant_owner(_uid uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT sm.owner_id FROM public.store_members sm WHERE sm.member_user_id = _uid LIMIT 1),
    _uid
  );
$$;

GRANT EXECUTE ON FUNCTION public.resolve_merchant_owner(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_merchant_plan(_owner_id uuid)
RETURNS public.subscription_plans
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT sp.*
  FROM public.profiles p
  JOIN public.subscription_plans sp ON sp.id = COALESCE(p.plan_id, (SELECT id FROM public.subscription_plans WHERE slug = 'free' LIMIT 1))
  WHERE p.user_id = _owner_id
  LIMIT 1;
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

CREATE OR REPLACE FUNCTION public.plan_limit_exceeded(
  _owner_id uuid,
  _metric text,
  _current int,
  _limit int
)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT _limit >= 0 AND _current >= _limit;
$$;

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
  _msg text;
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
      AND date_trunc('month', created_at) = date_trunc('month', now());
    IF public.plan_limit_exceeded(_owner, 'orders_month', _count, _plan.max_orders_month) THEN
      RAISE EXCEPTION 'plan_limit:orders_month:%', _plan.max_orders_month USING ERRCODE = 'P0001';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_plan_stores ON public.stores;
CREATE TRIGGER trg_enforce_plan_stores
  BEFORE INSERT ON public.stores
  FOR EACH ROW EXECUTE FUNCTION public.enforce_merchant_plan_limits();

DROP TRIGGER IF EXISTS trg_enforce_plan_products ON public.products;
CREATE TRIGGER trg_enforce_plan_products
  BEFORE INSERT ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.enforce_merchant_plan_limits();

DROP TRIGGER IF EXISTS trg_enforce_plan_staff ON public.store_members;
CREATE TRIGGER trg_enforce_plan_staff
  BEFORE INSERT ON public.store_members
  FOR EACH ROW EXECUTE FUNCTION public.enforce_merchant_plan_limits();

DROP TRIGGER IF EXISTS trg_enforce_plan_orders ON public.orders;
CREATE TRIGGER trg_enforce_plan_orders
  BEFORE INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.enforce_merchant_plan_limits();

GRANT EXECUTE ON FUNCTION public.get_merchant_plan(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.merchant_usage(uuid) TO authenticated;

-- Admin: assign plan to merchant
CREATE OR REPLACE FUNCTION public.admin_assign_plan(_user_id uuid, _plan_slug text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _plan_id uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  SELECT id INTO _plan_id FROM public.subscription_plans WHERE slug = _plan_slug LIMIT 1;
  IF _plan_id IS NULL THEN
    RAISE EXCEPTION 'plan not found: %', _plan_slug;
  END IF;
  UPDATE public.profiles SET plan_id = _plan_id WHERE user_id = _user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_assign_plan(uuid, text) TO authenticated;
