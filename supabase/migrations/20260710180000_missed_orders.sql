-- Checkout abandoned at confirmation dialog (customer saw popup and cancelled).

CREATE TABLE IF NOT EXISTS public.missed_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  product_name text,
  landing_slug text,
  customer_name text,
  phone text,
  address text,
  city text,
  governorate text,
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity >= 1 AND quantity <= 999),
  estimated_price numeric,
  reason text NOT NULL DEFAULT 'confirmation_cancelled',
  form_data jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_missed_orders_store_created
  ON public.missed_orders(store_id, created_at DESC);

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

COMMENT ON TABLE public.missed_orders IS
  'Checkout attempts abandoned at the pre-submit confirmation dialog.';
