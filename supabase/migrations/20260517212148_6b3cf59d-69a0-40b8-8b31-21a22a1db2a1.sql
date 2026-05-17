
-- 1. Stores table
CREATE TABLE public.stores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  name text NOT NULL DEFAULT 'المتجر الرئيسي',
  slug text NOT NULL UNIQUE,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_stores_owner ON public.stores(owner_id);

ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read stores" ON public.stores FOR SELECT USING (true);
CREATE POLICY "Owner manage stores" ON public.stores FOR ALL
  USING (is_member_of(owner_id) OR has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (is_member_of(owner_id) OR has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_stores_updated_at BEFORE UPDATE ON public.stores
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. store_member_stores: which stores a sub-user can access
CREATE TABLE public.store_member_stores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (member_id, store_id)
);

ALTER TABLE public.store_member_stores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read sms" ON public.store_member_stores FOR SELECT USING (true);
CREATE POLICY "Admin write sms" ON public.store_member_stores FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- 3. has_store_access helper
CREATE OR REPLACE FUNCTION public.has_store_access(_store_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _store_id IS NULL OR EXISTS (
    SELECT 1 FROM public.stores s
    WHERE s.id = _store_id AND (
      -- Owner of the store
      s.owner_id = auth.uid()
      -- Admin
      OR has_role(auth.uid(), 'admin'::app_role)
      -- Sub-user with explicit access to this store
      OR EXISTS (
        SELECT 1 FROM public.store_members sm
        JOIN public.store_member_stores sms ON sms.member_id = sm.id
        WHERE sm.member_user_id = auth.uid()
          AND sm.owner_id = s.owner_id
          AND sms.store_id = _store_id
      )
      -- Sub-user with NO explicit store restriction (backward compat): full access
      OR EXISTS (
        SELECT 1 FROM public.store_members sm
        WHERE sm.member_user_id = auth.uid()
          AND sm.owner_id = s.owner_id
          AND NOT EXISTS (SELECT 1 FROM public.store_member_stores WHERE member_id = sm.id)
      )
    )
  );
$$;

-- 4. Backfill: create one default store per existing owner (from profiles)
INSERT INTO public.stores (owner_id, name, slug, is_default)
SELECT p.user_id, 'المتجر الرئيسي', p.username, true
FROM public.profiles p
ON CONFLICT (slug) DO NOTHING;

-- 5. Add store_id column to each operational table, backfill from owner's default store
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'products','landing_pages','orders','order_items',
    'safes','safe_movements','expenses','purchases','expense_types',
    'shipping_settings','shipping_zones','shipping_warehouse_products',
    'pixel_settings','header_settings','order_form_fields',
    'confirmation_settings','confirmation_templates','cancellation_reasons',
    'easyorders_products','returns','return_shipments',
    'settlements','settlement_shipments',
    'city_corrections','analytics_events','order_confirmation_attempts',
    'carrier_status_mappings','hidden_default_cities','hidden_default_carrier_codes'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS store_id uuid', t);
    EXECUTE format(
      'UPDATE public.%I tbl SET store_id = s.id
       FROM public.stores s
       WHERE s.owner_id = tbl.owner_id AND s.is_default = true AND tbl.store_id IS NULL',
      t
    );
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_store_id ON public.%I(store_id)', t, t);
  END LOOP;
END $$;
