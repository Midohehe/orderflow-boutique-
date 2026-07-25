-- Unified Offer Builder (Upsell / Cross-sell / Post-purchase / Bumps / Bundles / …)

CREATE TABLE IF NOT EXISTS public.offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  name text NOT NULL,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('active', 'draft', 'disabled')),
  priority integer NOT NULL DEFAULT 0,
  offer_type text NOT NULL
    CHECK (offer_type IN (
      'upsell', 'cross_sell', 'post_purchase', 'order_bump', 'bundle',
      'quantity', 'buy_x_get_y', 'free_gift', 'free_shipping', 'flash'
    )),
  design jsonb NOT NULL DEFAULT '{}'::jsonb,
  pricing jsonb NOT NULL DEFAULT '{}'::jsonb,
  trigger_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  frequency jsonb NOT NULL DEFAULT '{}'::jsonb,
  schedule jsonb NOT NULL DEFAULT '{}'::jsonb,
  template_key text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_offers_store_status
  ON public.offers(store_id, status, priority DESC);
CREATE INDEX IF NOT EXISTS idx_offers_store_type
  ON public.offers(store_id, offer_type);

CREATE TABLE IF NOT EXISTS public.offer_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id uuid NOT NULL REFERENCES public.offers(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  category_id uuid,
  collection_key text,
  sort_order integer NOT NULL DEFAULT 0,
  is_default boolean NOT NULL DEFAULT false,
  allow_variants boolean NOT NULL DEFAULT true,
  allow_multi_select boolean NOT NULL DEFAULT false,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_offer_products_offer
  ON public.offer_products(offer_id, sort_order);

CREATE TABLE IF NOT EXISTS public.offer_rule_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id uuid NOT NULL REFERENCES public.offers(id) ON DELETE CASCADE,
  parent_group_id uuid REFERENCES public.offer_rule_groups(id) ON DELETE CASCADE,
  logic text NOT NULL DEFAULT 'and' CHECK (logic IN ('and', 'or')),
  sort_order integer NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.offer_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id uuid NOT NULL REFERENCES public.offers(id) ON DELETE CASCADE,
  group_id uuid REFERENCES public.offer_rule_groups(id) ON DELETE CASCADE,
  field text NOT NULL,
  operator text NOT NULL DEFAULT 'eq',
  value jsonb NOT NULL DEFAULT 'null'::jsonb,
  sort_order integer NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_offer_rules_offer ON public.offer_rules(offer_id);

CREATE TABLE IF NOT EXISTS public.offer_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id uuid NOT NULL REFERENCES public.offers(id) ON DELETE CASCADE,
  on_event text NOT NULL CHECK (on_event IN ('accept', 'decline')),
  action_type text NOT NULL,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  sort_order integer NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_offer_actions_offer ON public.offer_actions(offer_id, on_event);

CREATE TABLE IF NOT EXISTS public.offer_flows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  graph jsonb NOT NULL DEFAULT '{"nodes":[],"edges":[]}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_offer_flows_store ON public.offer_flows(store_id);

CREATE TABLE IF NOT EXISTS public.offer_analytics_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id uuid NOT NULL REFERENCES public.offers(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  event_type text NOT NULL
    CHECK (event_type IN ('view', 'click', 'accept', 'reject', 'dismiss')),
  revenue numeric DEFAULT 0,
  device text,
  city text,
  landing_slug text,
  campaign text,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_offer_analytics_offer_created
  ON public.offer_analytics_events(offer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_offer_analytics_store_created
  ON public.offer_analytics_events(store_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.offer_stats (
  offer_id uuid PRIMARY KEY REFERENCES public.offers(id) ON DELETE CASCADE,
  views bigint NOT NULL DEFAULT 0,
  clicks bigint NOT NULL DEFAULT 0,
  accepts bigint NOT NULL DEFAULT 0,
  rejects bigint NOT NULL DEFAULT 0,
  revenue numeric NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offer_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offer_rule_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offer_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offer_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offer_flows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offer_analytics_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offer_stats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS store_tenant_select ON public.offers;
DROP POLICY IF EXISTS store_tenant_insert ON public.offers;
DROP POLICY IF EXISTS store_tenant_update ON public.offers;
DROP POLICY IF EXISTS store_tenant_delete ON public.offers;
DROP POLICY IF EXISTS store_tenant_select ON public.offer_products;
DROP POLICY IF EXISTS store_tenant_insert ON public.offer_products;
DROP POLICY IF EXISTS store_tenant_update ON public.offer_products;
DROP POLICY IF EXISTS store_tenant_delete ON public.offer_products;
DROP POLICY IF EXISTS store_tenant_select ON public.offer_rule_groups;
DROP POLICY IF EXISTS store_tenant_insert ON public.offer_rule_groups;
DROP POLICY IF EXISTS store_tenant_update ON public.offer_rule_groups;
DROP POLICY IF EXISTS store_tenant_delete ON public.offer_rule_groups;
DROP POLICY IF EXISTS store_tenant_select ON public.offer_rules;
DROP POLICY IF EXISTS store_tenant_insert ON public.offer_rules;
DROP POLICY IF EXISTS store_tenant_update ON public.offer_rules;
DROP POLICY IF EXISTS store_tenant_delete ON public.offer_rules;
DROP POLICY IF EXISTS store_tenant_select ON public.offer_actions;
DROP POLICY IF EXISTS store_tenant_insert ON public.offer_actions;
DROP POLICY IF EXISTS store_tenant_update ON public.offer_actions;
DROP POLICY IF EXISTS store_tenant_delete ON public.offer_actions;
DROP POLICY IF EXISTS store_tenant_select ON public.offer_flows;
DROP POLICY IF EXISTS store_tenant_insert ON public.offer_flows;
DROP POLICY IF EXISTS store_tenant_update ON public.offer_flows;
DROP POLICY IF EXISTS store_tenant_delete ON public.offer_flows;
DROP POLICY IF EXISTS store_tenant_select ON public.offer_analytics_events;
DROP POLICY IF EXISTS store_tenant_insert ON public.offer_analytics_events;
DROP POLICY IF EXISTS anon_insert_offer_analytics ON public.offer_analytics_events;
DROP POLICY IF EXISTS store_tenant_select ON public.offer_stats;
DROP POLICY IF EXISTS store_tenant_upsert ON public.offer_stats;

CREATE POLICY store_tenant_select ON public.offers
  FOR SELECT TO authenticated USING (public.rls_store_select(store_id));
CREATE POLICY store_tenant_insert ON public.offers
  FOR INSERT TO authenticated WITH CHECK (public.rls_store_write(store_id, owner_id));
CREATE POLICY store_tenant_update ON public.offers
  FOR UPDATE TO authenticated
  USING (public.rls_store_select(store_id))
  WITH CHECK (public.rls_store_write(store_id, owner_id));
CREATE POLICY store_tenant_delete ON public.offers
  FOR DELETE TO authenticated USING (public.rls_store_select(store_id));

CREATE OR REPLACE FUNCTION public.offer_belongs_to_accessible_store(_offer_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.offers o
    WHERE o.id = _offer_id AND public.rls_store_select(o.store_id)
  );
$$;

CREATE OR REPLACE FUNCTION public.offer_writable(_offer_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.offers o
    WHERE o.id = _offer_id AND public.rls_store_write(o.store_id, o.owner_id)
  );
$$;

GRANT EXECUTE ON FUNCTION public.offer_belongs_to_accessible_store(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.offer_writable(uuid) TO authenticated;

CREATE POLICY store_tenant_select ON public.offer_products
  FOR SELECT TO authenticated
  USING (public.offer_belongs_to_accessible_store(offer_id));
CREATE POLICY store_tenant_insert ON public.offer_products
  FOR INSERT TO authenticated
  WITH CHECK (public.offer_writable(offer_id));
CREATE POLICY store_tenant_update ON public.offer_products
  FOR UPDATE TO authenticated
  USING (public.offer_belongs_to_accessible_store(offer_id))
  WITH CHECK (public.offer_writable(offer_id));
CREATE POLICY store_tenant_delete ON public.offer_products
  FOR DELETE TO authenticated
  USING (public.offer_writable(offer_id));

CREATE POLICY store_tenant_select ON public.offer_rule_groups
  FOR SELECT TO authenticated
  USING (public.offer_belongs_to_accessible_store(offer_id));
CREATE POLICY store_tenant_insert ON public.offer_rule_groups
  FOR INSERT TO authenticated
  WITH CHECK (public.offer_writable(offer_id));
CREATE POLICY store_tenant_update ON public.offer_rule_groups
  FOR UPDATE TO authenticated
  USING (public.offer_belongs_to_accessible_store(offer_id))
  WITH CHECK (public.offer_writable(offer_id));
CREATE POLICY store_tenant_delete ON public.offer_rule_groups
  FOR DELETE TO authenticated
  USING (public.offer_writable(offer_id));

CREATE POLICY store_tenant_select ON public.offer_rules
  FOR SELECT TO authenticated
  USING (public.offer_belongs_to_accessible_store(offer_id));
CREATE POLICY store_tenant_insert ON public.offer_rules
  FOR INSERT TO authenticated
  WITH CHECK (public.offer_writable(offer_id));
CREATE POLICY store_tenant_update ON public.offer_rules
  FOR UPDATE TO authenticated
  USING (public.offer_belongs_to_accessible_store(offer_id))
  WITH CHECK (public.offer_writable(offer_id));
CREATE POLICY store_tenant_delete ON public.offer_rules
  FOR DELETE TO authenticated
  USING (public.offer_writable(offer_id));

CREATE POLICY store_tenant_select ON public.offer_actions
  FOR SELECT TO authenticated
  USING (public.offer_belongs_to_accessible_store(offer_id));
CREATE POLICY store_tenant_insert ON public.offer_actions
  FOR INSERT TO authenticated
  WITH CHECK (public.offer_writable(offer_id));
CREATE POLICY store_tenant_update ON public.offer_actions
  FOR UPDATE TO authenticated
  USING (public.offer_belongs_to_accessible_store(offer_id))
  WITH CHECK (public.offer_writable(offer_id));
CREATE POLICY store_tenant_delete ON public.offer_actions
  FOR DELETE TO authenticated
  USING (public.offer_writable(offer_id));

CREATE POLICY store_tenant_select ON public.offer_flows
  FOR SELECT TO authenticated USING (public.rls_store_select(store_id));
CREATE POLICY store_tenant_insert ON public.offer_flows
  FOR INSERT TO authenticated WITH CHECK (public.rls_store_write(store_id, owner_id));
CREATE POLICY store_tenant_update ON public.offer_flows
  FOR UPDATE TO authenticated
  USING (public.rls_store_select(store_id))
  WITH CHECK (public.rls_store_write(store_id, owner_id));
CREATE POLICY store_tenant_delete ON public.offer_flows
  FOR DELETE TO authenticated USING (public.rls_store_select(store_id));

CREATE POLICY store_tenant_select ON public.offer_analytics_events
  FOR SELECT TO authenticated USING (public.rls_store_select(store_id));
CREATE POLICY store_tenant_insert ON public.offer_analytics_events
  FOR INSERT TO authenticated WITH CHECK (public.rls_store_select(store_id));

CREATE POLICY store_tenant_select ON public.offer_stats
  FOR SELECT TO authenticated
  USING (public.offer_belongs_to_accessible_store(offer_id));
CREATE POLICY store_tenant_upsert ON public.offer_stats
  FOR ALL TO authenticated
  USING (public.offer_belongs_to_accessible_store(offer_id))
  WITH CHECK (public.offer_writable(offer_id));

CREATE POLICY anon_insert_offer_analytics ON public.offer_analytics_events
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.offers TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.offer_products TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.offer_rule_groups TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.offer_rules TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.offer_actions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.offer_flows TO authenticated;
GRANT SELECT, INSERT ON public.offer_analytics_events TO authenticated, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.offer_stats TO authenticated;

CREATE OR REPLACE FUNCTION public.get_offer_stats_summary(_store_id uuid)
RETURNS TABLE(
  offer_id uuid,
  views bigint,
  clicks bigint,
  accepts bigint,
  rejects bigint,
  revenue numeric,
  acceptance_rate numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.rls_store_select(_store_id) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    o.id,
    COALESCE(s.views, 0),
    COALESCE(s.clicks, 0),
    COALESCE(s.accepts, 0),
    COALESCE(s.rejects, 0),
    COALESCE(s.revenue, 0),
    CASE
      WHEN COALESCE(s.views, 0) = 0 THEN 0
      ELSE ROUND((COALESCE(s.accepts, 0)::numeric / s.views::numeric) * 100, 2)
    END
  FROM public.offers o
  LEFT JOIN public.offer_stats s ON s.offer_id = o.id
  WHERE o.store_id = _store_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_offer_stats_summary(uuid) TO authenticated;
