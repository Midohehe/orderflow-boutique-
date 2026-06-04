-- Phase 5: Strict tenant isolation — store_id-scoped RLS via has_store_access()
-- Replaces has_store_or_legacy() NULL/owner-only bypass for all store-scoped tables.

-- ---------------------------------------------------------------------------
-- 1) Harden has_store_access — no NULL bypass, no implicit all-store staff access
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.has_store_access(_store_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _store_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.stores s
      WHERE s.id = _store_id
        AND (
          s.owner_id = auth.uid()
          OR public.has_role(auth.uid(), 'admin'::app_role)
          OR EXISTS (
            SELECT 1
            FROM public.store_members sm
            JOIN public.store_member_stores sms ON sms.member_id = sm.id
            WHERE sm.member_user_id = auth.uid()
              AND sm.owner_id = s.owner_id
              AND sms.store_id = _store_id
          )
        )
    );
$$;

COMMENT ON FUNCTION public.has_store_access(uuid) IS
  'True when auth.uid() is store owner, platform admin, or staff explicitly assigned to store_id.';

-- Strict replacement for legacy hybrid helper (no owner_id-only fallback).
CREATE OR REPLACE FUNCTION public.has_store_or_legacy(_owner_id uuid, _store_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_store_access(_store_id);
$$;

-- RLS helpers used in policies
CREATE OR REPLACE FUNCTION public.rls_store_select(_store_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_store_access(_store_id);
$$;

CREATE OR REPLACE FUNCTION public.rls_store_write(_store_id uuid, _owner_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'admin'::app_role)
    OR (
      _store_id IS NOT NULL
      AND _owner_id IS NOT NULL
      AND public.has_store_access(_store_id)
      AND EXISTS (
        SELECT 1 FROM public.stores s
        WHERE s.id = _store_id AND s.owner_id = _owner_id
      )
    );
$$;

GRANT EXECUTE ON FUNCTION public.rls_store_select(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rls_store_write(uuid, uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 2) Backfill NULL store_id from owner default store
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  _t text;
  _tables text[] := ARRAY(
    SELECT c.table_name
    FROM information_schema.columns c
    JOIN information_schema.columns o
      ON o.table_schema = c.table_schema
     AND o.table_name = c.table_name
     AND o.column_name = 'owner_id'
    WHERE c.table_schema = 'public'
      AND c.column_name = 'store_id'
      AND c.table_name NOT IN ('stores', 'store_member_stores', 'store_order_counters', 'store_sku_counters')
  );
BEGIN
  FOREACH _t IN ARRAY _tables LOOP
    EXECUTE format(
      $q$
        UPDATE public.%I tbl
        SET store_id = s.id
        FROM public.stores s
        WHERE tbl.store_id IS NULL
          AND tbl.owner_id IS NOT NULL
          AND s.owner_id = tbl.owner_id
          AND s.is_default = true
      $q$,
      _t
    );
  END LOOP;
END $$;

-- Ensure every staff member has explicit store assignments (no implicit all-store access).
INSERT INTO public.store_member_stores (member_id, store_id)
SELECT sm.id, st.id
FROM public.store_members sm
JOIN public.stores st ON st.owner_id = sm.owner_id
WHERE NOT EXISTS (
  SELECT 1 FROM public.store_member_stores x WHERE x.member_id = sm.id
)
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- 3) Enforce store_id / owner_id consistency on write
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.assert_store_owner_match()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.store_id IS NOT NULL AND NEW.owner_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.stores s
      WHERE s.id = NEW.store_id AND s.owner_id = NEW.owner_id
    ) THEN
      RAISE EXCEPTION 'store_id % does not belong to owner_id %', NEW.store_id, NEW.owner_id
        USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DO $$
DECLARE _t text;
DECLARE _tables text[] := ARRAY(
  SELECT c.table_name
  FROM information_schema.columns c
  JOIN information_schema.columns o
    ON o.table_schema = c.table_schema
   AND o.table_name = c.table_name
   AND o.column_name = 'owner_id'
  WHERE c.table_schema = 'public'
    AND c.column_name = 'store_id'
    AND c.table_name NOT IN ('stores', 'store_member_stores', 'store_order_counters', 'store_sku_counters')
);
BEGIN
  FOREACH _t IN ARRAY _tables LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_assert_store_owner_%I ON public.%I', _t, _t);
    EXECUTE format(
      'CREATE TRIGGER trg_assert_store_owner_%I
       BEFORE INSERT OR UPDATE OF store_id, owner_id ON public.%I
       FOR EACH ROW EXECUTE FUNCTION public.assert_store_owner_match()',
      _t, _t
    );
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 4) Bulk rewrite RLS on all tables with store_id + owner_id
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  _t text;
  _tables text[] := ARRAY(
    SELECT c.table_name
    FROM information_schema.columns c
    JOIN information_schema.columns o
      ON o.table_schema = c.table_schema
     AND o.table_name = c.table_name
     AND o.column_name = 'owner_id'
    WHERE c.table_schema = 'public'
      AND c.column_name = 'store_id'
      AND c.table_name NOT IN (
        'stores', 'store_member_stores', 'store_order_counters', 'store_sku_counters',
        -- handled individually below (public read / insert exceptions)
        'products', 'landing_pages', 'header_settings', 'store_settings',
        'pixel_settings', 'order_form_fields', 'analytics_events', 'orders',
        'order_items', 'home_page_sections', 'store_page_layouts', 'landing_page_templates'
      )
  );
  _p record;
BEGIN
  FOREACH _t IN ARRAY _tables LOOP
    FOR _p IN
      SELECT policyname FROM pg_policies
      WHERE schemaname = 'public' AND tablename = _t
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', _p.policyname, _t);
    END LOOP;

    EXECUTE format($f$
      CREATE POLICY "store_tenant_select" ON public.%I
        FOR SELECT TO authenticated
        USING (public.rls_store_select(store_id));
      CREATE POLICY "store_tenant_insert" ON public.%I
        FOR INSERT TO authenticated
        WITH CHECK (public.rls_store_write(store_id, owner_id));
      CREATE POLICY "store_tenant_update" ON public.%I
        FOR UPDATE TO authenticated
        USING (public.rls_store_select(store_id))
        WITH CHECK (public.rls_store_write(store_id, owner_id));
      CREATE POLICY "store_tenant_delete" ON public.%I
        FOR DELETE TO authenticated
        USING (public.rls_store_select(store_id));
    $f$, _t, _t, _t, _t);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 5) Public-facing tables — keep anon read, strict authenticated write
-- ---------------------------------------------------------------------------

-- products
DO $do$ DECLARE _p record; BEGIN
  FOR _p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='products' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.products', _p.policyname);
  END LOOP;
END $do$;
CREATE POLICY "Public read products" ON public.products FOR SELECT USING (true);
CREATE POLICY "store_tenant_insert" ON public.products FOR INSERT TO authenticated
  WITH CHECK (public.rls_store_write(store_id, owner_id));
CREATE POLICY "store_tenant_update" ON public.products FOR UPDATE TO authenticated
  USING (public.rls_store_select(store_id))
  WITH CHECK (public.rls_store_write(store_id, owner_id));
CREATE POLICY "store_tenant_delete" ON public.products FOR DELETE TO authenticated
  USING (public.rls_store_select(store_id));

-- landing_pages
DO $do$ DECLARE _p record; BEGIN
  FOR _p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='landing_pages' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.landing_pages', _p.policyname);
  END LOOP;
END $do$;
CREATE POLICY "Public read landing_pages" ON public.landing_pages FOR SELECT USING (true);
CREATE POLICY "store_tenant_insert" ON public.landing_pages FOR INSERT TO authenticated
  WITH CHECK (public.rls_store_write(store_id, owner_id));
CREATE POLICY "store_tenant_update" ON public.landing_pages FOR UPDATE TO authenticated
  USING (public.rls_store_select(store_id))
  WITH CHECK (public.rls_store_write(store_id, owner_id));
CREATE POLICY "store_tenant_delete" ON public.landing_pages FOR DELETE TO authenticated
  USING (public.rls_store_select(store_id));

-- header_settings, store_settings, pixel_settings, order_form_fields
DO $do$ DECLARE _tbl text; _p record; BEGIN
  FOREACH _tbl IN ARRAY ARRAY['header_settings','store_settings','pixel_settings','order_form_fields'] LOOP
    FOR _p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename=_tbl LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', _p.policyname, _tbl);
    END LOOP;
    EXECUTE format('CREATE POLICY "Public read %I" ON public.%I FOR SELECT USING (true)', _tbl, _tbl);
    EXECUTE format(
      'CREATE POLICY "store_tenant_write" ON public.%I FOR ALL TO authenticated
       USING (public.rls_store_select(store_id))
       WITH CHECK (public.rls_store_write(store_id, owner_id))',
      _tbl
    );
  END LOOP;
END $do$;

-- analytics_events
DO $do$ DECLARE _p record; BEGIN
  FOR _p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='analytics_events' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.analytics_events', _p.policyname);
  END LOOP;
END $do$;
CREATE POLICY "Allow public insert analytics" ON public.analytics_events
  FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "store_tenant_select" ON public.analytics_events
  FOR SELECT TO authenticated USING (public.rls_store_select(store_id));

-- orders — public checkout insert must target a valid store
DO $do$ DECLARE _p record; BEGIN
  FOR _p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='orders' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.orders', _p.policyname);
  END LOOP;
END $do$;
CREATE POLICY "Public insert orders" ON public.orders
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    store_id IS NOT NULL
    AND owner_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.stores s
      WHERE s.id = store_id AND s.owner_id = owner_id
    )
  );
CREATE POLICY "store_tenant_select" ON public.orders
  FOR SELECT TO authenticated USING (public.rls_store_select(store_id));
CREATE POLICY "store_tenant_update" ON public.orders
  FOR UPDATE TO authenticated
  USING (public.rls_store_select(store_id))
  WITH CHECK (public.rls_store_write(store_id, owner_id));
CREATE POLICY "store_tenant_delete" ON public.orders
  FOR DELETE TO authenticated USING (public.rls_store_select(store_id));

-- order_items — public insert only for recent matching order in same store
DROP POLICY IF EXISTS "Public insert order_items" ON public.order_items;
DROP POLICY IF EXISTS "store_tenant_select" ON public.order_items;
DROP POLICY IF EXISTS "store_tenant_insert" ON public.order_items;
DROP POLICY IF EXISTS "store_tenant_update" ON public.order_items;
DROP POLICY IF EXISTS "store_tenant_delete" ON public.order_items;
CREATE POLICY "Public insert order_items" ON public.order_items
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    store_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_items.order_id
        AND o.store_id = order_items.store_id
        AND o.owner_id = order_items.owner_id
        AND o.created_at > now() - interval '15 minutes'
    )
  );
CREATE POLICY "store_tenant_select" ON public.order_items
  FOR SELECT TO authenticated USING (public.rls_store_select(store_id));
CREATE POLICY "store_tenant_update" ON public.order_items
  FOR UPDATE TO authenticated
  USING (public.rls_store_select(store_id))
  WITH CHECK (public.rls_store_write(store_id, owner_id));
CREATE POLICY "store_tenant_delete" ON public.order_items
  FOR DELETE TO authenticated USING (public.rls_store_select(store_id));

-- home_page_sections
DO $do$ DECLARE _p record; BEGIN
  FOR _p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='home_page_sections' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.home_page_sections', _p.policyname);
  END LOOP;
END $do$;
CREATE POLICY "Public read visible sections" ON public.home_page_sections
  FOR SELECT USING (is_visible = true OR public.rls_store_select(store_id));
CREATE POLICY "store_tenant_insert" ON public.home_page_sections
  FOR INSERT TO authenticated WITH CHECK (public.rls_store_write(store_id, owner_id));
CREATE POLICY "store_tenant_update" ON public.home_page_sections
  FOR UPDATE TO authenticated
  USING (public.rls_store_select(store_id))
  WITH CHECK (public.rls_store_write(store_id, owner_id));
CREATE POLICY "store_tenant_delete" ON public.home_page_sections
  FOR DELETE TO authenticated USING (public.rls_store_select(store_id));

-- store_page_layouts
DO $do$ DECLARE _p record; BEGIN
  FOR _p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='store_page_layouts' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.store_page_layouts', _p.policyname);
  END LOOP;
END $do$;
CREATE POLICY "public read published layouts" ON public.store_page_layouts
  FOR SELECT USING (is_published = true OR public.rls_store_select(store_id));
CREATE POLICY "store_tenant_write" ON public.store_page_layouts
  FOR ALL TO authenticated
  USING (public.rls_store_select(store_id))
  WITH CHECK (public.rls_store_write(store_id, owner_id));

-- landing_page_templates
DO $do$ DECLARE _p record; BEGIN
  FOR _p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='landing_page_templates' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.landing_page_templates', _p.policyname);
  END LOOP;
END $do$;
CREATE POLICY "Public read landing_page_templates" ON public.landing_page_templates
  FOR SELECT USING (is_default = true OR public.rls_store_select(store_id));
CREATE POLICY "store_tenant_write" ON public.landing_page_templates
  FOR ALL TO authenticated
  USING (public.rls_store_select(store_id))
  WITH CHECK (public.rls_store_write(store_id, owner_id));

-- order_status_history (was owner-scoped only)
DO $do$ DECLARE _p record; BEGIN
  FOR _p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='order_status_history' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.order_status_history', _p.policyname);
  END LOOP;
END $do$;
CREATE POLICY "store_tenant_select" ON public.order_status_history
  FOR SELECT TO authenticated USING (public.rls_store_select(store_id));
CREATE POLICY "store_tenant_insert" ON public.order_status_history
  FOR INSERT TO authenticated WITH CHECK (public.rls_store_write(store_id, owner_id));

-- ---------------------------------------------------------------------------
-- 6) stores + store_member_stores tenant boundaries
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Owner manage stores" ON public.stores;
CREATE POLICY "store_tenant_read" ON public.stores
  FOR SELECT TO authenticated
  USING (public.has_store_access(id) OR public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "store_owner_manage" ON public.stores
  FOR ALL TO authenticated
  USING (auth.uid() = owner_id OR public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (auth.uid() = owner_id OR public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Public read sms" ON public.store_member_stores;
DROP POLICY IF EXISTS "Admin write sms" ON public.store_member_stores;
CREATE POLICY "store_assignment_read" ON public.store_member_stores
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.store_members sm
      WHERE sm.id = store_member_stores.member_id
        AND (sm.owner_id = auth.uid() OR sm.member_user_id = auth.uid())
    )
  );
CREATE POLICY "store_owner_manage_assignments" ON public.store_member_stores
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.store_members sm
      WHERE sm.id = store_member_stores.member_id AND sm.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.store_members sm
      WHERE sm.id = store_member_stores.member_id AND sm.owner_id = auth.uid()
    )
  );

-- store_themes (has store_id, may lack owner_id in some rows — use store only)
DO $do$ DECLARE _p record; BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='store_themes') THEN
    FOR _p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='store_themes' LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.store_themes', _p.policyname);
    END LOOP;
    CREATE POLICY "Public read templates" ON public.store_themes
      FOR SELECT USING (is_template = true OR public.rls_store_select(store_id));
    CREATE POLICY "store_tenant_write" ON public.store_themes
      FOR ALL TO authenticated
      USING (public.rls_store_select(store_id))
      WITH CHECK (public.rls_store_write(store_id, owner_id));
  END IF;
END $do$;

-- ---------------------------------------------------------------------------
-- 7) Storage product-images — staff with store access may upload to owner/store path
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Owners upload product images" ON storage.objects;
DROP POLICY IF EXISTS "Owners update product images" ON storage.objects;
DROP POLICY IF EXISTS "Owners delete product images" ON storage.objects;

CREATE POLICY "Store team upload product images"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'product-images'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR EXISTS (
        SELECT 1 FROM public.stores s
        WHERE s.owner_id::text = (storage.foldername(name))[1]
          AND (storage.foldername(name))[2] = s.id::text
          AND public.has_store_access(s.id)
      )
    )
  );

CREATE POLICY "Store team update product images"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'product-images'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR EXISTS (
        SELECT 1 FROM public.stores s
        WHERE s.owner_id::text = (storage.foldername(name))[1]
          AND (storage.foldername(name))[2] = s.id::text
          AND public.has_store_access(s.id)
      )
    )
  );

CREATE POLICY "Store team delete product images"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'product-images'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR EXISTS (
        SELECT 1 FROM public.stores s
        WHERE s.owner_id::text = (storage.foldername(name))[1]
          AND (storage.foldername(name))[2] = s.id::text
          AND public.has_store_access(s.id)
      )
    )
  );

-- ---------------------------------------------------------------------------
-- 8) SECURITY DEFINER RPCs — enforce has_store_access on _store_id parameter
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.orders_status_counts(_store_id uuid)
RETURNS TABLE(status text, cnt bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT o.status::text, COUNT(*)::bigint
  FROM public.orders o
  WHERE o.store_id = _store_id
    AND o.is_deleted = false
    AND public.has_store_access(_store_id)
  GROUP BY o.status;
$$;

CREATE OR REPLACE FUNCTION public.orders_shipped_carrier_counts(_store_id uuid)
RETURNS TABLE(label text, cnt bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(o.carrier_status, '')::text AS label, COUNT(*)::bigint
  FROM public.orders o
  WHERE o.store_id = _store_id
    AND o.status = 'shipped'
    AND o.is_deleted = false
    AND public.has_store_access(_store_id)
  GROUP BY 1
  ORDER BY 2 DESC;
$$;

CREATE OR REPLACE FUNCTION public.orders_confirmation_counts(_store_id uuid)
RETURNS TABLE(confirmation_status text, cnt bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(o.confirmation_status, 'unconfirmed')::text, COUNT(*)::bigint
  FROM public.orders o
  WHERE o.store_id = _store_id
    AND o.is_deleted = false
    AND o.status = 'pending'
    AND (o.country_code IS NULL OR UPPER(o.country_code) = 'LY')
    AND public.has_store_access(_store_id)
  GROUP BY 1;
$$;

CREATE OR REPLACE FUNCTION public.order_status_dwell_report(_store_id uuid, _from date, _to date)
RETURNS TABLE(to_status text, transition_count bigint, avg_hours numeric, max_hours numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH transitions AS (
    SELECT
      h.to_value,
      EXTRACT(EPOCH FROM (
        LEAD(h.changed_at) OVER (PARTITION BY h.order_id, h.field_name ORDER BY h.changed_at)
        - h.changed_at
      )) / 3600.0 AS hours_in_status
    FROM public.order_status_history h
    WHERE h.field_name = 'status'
      AND h.store_id = _store_id
      AND public.has_store_access(_store_id)
      AND h.changed_at::date BETWEEN _from AND _to
  )
  SELECT
    to_value,
    COUNT(*)::bigint,
    ROUND(COALESCE(AVG(hours_in_status), 0)::numeric, 1),
    ROUND(COALESCE(MAX(hours_in_status), 0)::numeric, 1)
  FROM transitions
  WHERE hours_in_status IS NOT NULL AND hours_in_status >= 0
  GROUP BY to_value
  ORDER BY 2 DESC;
$$;

GRANT EXECUTE ON FUNCTION public.orders_status_counts(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.orders_shipped_carrier_counts(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.orders_confirmation_counts(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.order_status_dwell_report(uuid, date, date) TO authenticated;

-- Financial RPCs — require has_store_access (no NULL store aggregate across all stores)
CREATE OR REPLACE FUNCTION public.profit_loss_report(_store_id uuid, _from date, _to date)
RETURNS json LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _revenue numeric := 0;
  _cogs numeric := 0;
  _expenses numeric := 0;
  _purchases numeric := 0;
  _returns numeric := 0;
  _orders_count int := 0;
  _delivered_count int := 0;
BEGIN
  IF auth.uid() IS NULL THEN RETURN json_build_object('error','unauthorized'); END IF;
  IF _store_id IS NULL OR NOT public.has_store_access(_store_id) THEN
    RETURN json_build_object('error','forbidden');
  END IF;

  SELECT COALESCE(SUM(price),0), COUNT(*)
    INTO _revenue, _delivered_count
    FROM public.orders
    WHERE store_id = _store_id
      AND status IN ('delivered', 'settled')
      AND created_at::date BETWEEN _from AND _to;

  SELECT COALESCE(SUM(oi.quantity * COALESCE(oi.purchase_price_snapshot, 0)), 0)
    INTO _cogs
    FROM public.order_items oi
    JOIN public.orders o ON o.id = oi.order_id
    WHERE o.store_id = _store_id
      AND o.status IN ('delivered', 'settled')
      AND o.created_at::date BETWEEN _from AND _to;

  SELECT COALESCE(SUM(amount),0) INTO _expenses
    FROM public.expenses
    WHERE store_id = _store_id
      AND created_at::date BETWEEN _from AND _to;

  SELECT COALESCE(SUM(amount),0) INTO _purchases
    FROM public.purchases
    WHERE store_id = _store_id
      AND created_at::date BETWEEN _from AND _to;

  SELECT COALESCE(SUM(ABS(amount)),0) INTO _returns
    FROM public.safe_movements
    WHERE store_id = _store_id
      AND movement_type = 'return_refund'
      AND created_at::date BETWEEN _from AND _to;

  SELECT COUNT(*) INTO _orders_count
    FROM public.orders
    WHERE store_id = _store_id
      AND created_at::date BETWEEN _from AND _to;

  RETURN json_build_object(
    'revenue', _revenue,
    'cogs', _cogs,
    'gross_profit', _revenue - _cogs,
    'expenses', _expenses,
    'purchases', _purchases,
    'returns_refunded', _returns,
    'net_profit', _revenue - _cogs - _expenses - _returns,
    'orders_count', _orders_count,
    'delivered_count', _delivered_count
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.cash_flow_report(_store_id uuid, _from date, _to date)
RETURNS TABLE(movement_type text, total numeric, count_movements int)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(sm.movement_type, 'other')::text,
         COALESCE(SUM(sm.amount),0),
         COUNT(*)::int
  FROM public.safe_movements sm
  WHERE sm.store_id = _store_id
    AND public.has_store_access(_store_id)
    AND sm.created_at::date BETWEEN _from AND _to
  GROUP BY sm.movement_type
  ORDER BY 2 DESC;
$$;

GRANT EXECUTE ON FUNCTION public.profit_loss_report(uuid, date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cash_flow_report(uuid, date, date) TO authenticated;
