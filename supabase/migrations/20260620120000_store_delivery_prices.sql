-- Per-store delivery city prices + order form field «نوع التوصيل»

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS shipping_fee numeric NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.store_delivery_prices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  city_name text NOT NULL,
  price numeric NOT NULL DEFAULT 0 CHECK (price >= 0),
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, city_name)
);

CREATE INDEX IF NOT EXISTS idx_store_delivery_prices_store
  ON public.store_delivery_prices (store_id, sort_order);

ALTER TABLE public.store_delivery_prices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "store_delivery_prices_select" ON public.store_delivery_prices
  FOR SELECT TO authenticated
  USING (public.rls_store_select(store_id) OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "store_delivery_prices_write" ON public.store_delivery_prices
  FOR ALL TO authenticated
  USING (public.rls_store_write(store_id, owner_id))
  WITH CHECK (public.rls_store_write(store_id, owner_id));

CREATE POLICY "Public read store delivery prices" ON public.store_delivery_prices
  FOR SELECT TO anon, authenticated
  USING (true);

CREATE TRIGGER trg_store_delivery_prices_updated_at
  BEFORE UPDATE ON public.store_delivery_prices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_assert_store_owner_store_delivery_prices
  BEFORE INSERT OR UPDATE OF store_id, owner_id ON public.store_delivery_prices
  FOR EACH ROW EXECUTE FUNCTION public.assert_store_owner_match();

INSERT INTO public.form_field_catalog (
  field_key, label, field_type, default_required, default_placeholder, sort_order, admin_enabled
) VALUES (
  'delivery_city', 'نوع التوصيل', 'delivery_select', true, 'اختر المدينة', 25, true
)
ON CONFLICT (field_key) DO UPDATE SET
  label = EXCLUDED.label,
  field_type = EXCLUDED.field_type,
  default_placeholder = EXCLUDED.default_placeholder,
  admin_enabled = true;

-- Seed the new field for existing stores
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT owner_id, id AS store_id FROM public.stores
  LOOP
    PERFORM public.seed_store_defaults(r.owner_id, r.store_id);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.get_public_delivery_prices(_store_id uuid)
RETURNS TABLE(city_name text, price numeric, sort_order integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT d.city_name, d.price, d.sort_order
  FROM public.store_delivery_prices d
  WHERE d.store_id = _store_id
  ORDER BY d.sort_order ASC, d.city_name ASC;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_delivery_prices(uuid) TO anon, authenticated;
