
-- إضافة store_id للجداول الناقصة + backfill
ALTER TABLE public.sticker_settings   ADD COLUMN IF NOT EXISTS store_id uuid;
ALTER TABLE public.store_settings     ADD COLUMN IF NOT EXISTS store_id uuid;
ALTER TABLE public.thank_you_settings ADD COLUMN IF NOT EXISTS store_id uuid;
ALTER TABLE public.whatsapp_settings  ADD COLUMN IF NOT EXISTS store_id uuid;
ALTER TABLE public.stock_movements    ADD COLUMN IF NOT EXISTS store_id uuid;

UPDATE public.sticker_settings t SET store_id = s.id FROM public.stores s
  WHERE t.store_id IS NULL AND s.owner_id = t.owner_id AND s.is_default = true;
UPDATE public.store_settings t SET store_id = s.id FROM public.stores s
  WHERE t.store_id IS NULL AND s.owner_id = t.owner_id AND s.is_default = true;
UPDATE public.thank_you_settings t SET store_id = s.id FROM public.stores s
  WHERE t.store_id IS NULL AND s.owner_id = t.owner_id AND s.is_default = true;
UPDATE public.whatsapp_settings t SET store_id = s.id FROM public.stores s
  WHERE t.store_id IS NULL AND s.owner_id = t.owner_id AND s.is_default = true;
UPDATE public.stock_movements t SET store_id = s.id FROM public.stores s
  WHERE t.store_id IS NULL AND s.owner_id = t.owner_id AND s.is_default = true;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sticker_settings_owner_id_key') THEN
    ALTER TABLE public.sticker_settings DROP CONSTRAINT sticker_settings_owner_id_key;
  END IF;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS sticker_settings_owner_store_uniq ON public.sticker_settings(owner_id, store_id);
CREATE UNIQUE INDEX IF NOT EXISTS store_settings_owner_store_uniq ON public.store_settings(owner_id, store_id);
CREATE UNIQUE INDEX IF NOT EXISTS thank_you_settings_owner_store_uniq ON public.thank_you_settings(owner_id, store_id);
CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_settings_owner_store_uniq ON public.whatsapp_settings(owner_id, store_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_store ON public.stock_movements(store_id);

-- دالة وصول هجينة
CREATE OR REPLACE FUNCTION public.has_store_or_legacy(_owner_id uuid, _store_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    has_role(auth.uid(), 'admin'::app_role)
    OR (_store_id IS NULL AND is_member_of(_owner_id))
    OR (_store_id IS NOT NULL AND has_store_access(_store_id));
$$;
GRANT EXECUTE ON FUNCTION public.has_store_or_legacy(uuid, uuid) TO authenticated;

-- إغلاق backdoor
CREATE OR REPLACE FUNCTION public.has_store_access(_store_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _store_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.stores s
    WHERE s.id = _store_id AND (
      s.owner_id = auth.uid()
      OR has_role(auth.uid(), 'admin'::app_role)
      OR EXISTS (
        SELECT 1 FROM public.store_members sm
        JOIN public.store_member_stores sms ON sms.member_id = sm.id
        WHERE sm.member_user_id = auth.uid() AND sm.owner_id = s.owner_id AND sms.store_id = _store_id
      )
    )
  );
$$;

-- backfill: امنح كل موظف بدون متاجر محددة وصولاً لكل متاجر الـ owner
INSERT INTO public.store_member_stores (member_id, store_id)
SELECT sm.id, st.id FROM public.store_members sm
JOIN public.stores st ON st.owner_id = sm.owner_id
WHERE NOT EXISTS (SELECT 1 FROM public.store_member_stores x WHERE x.member_id = sm.id)
ON CONFLICT DO NOTHING;

-- إعادة كتابة RLS — مع التحقق من وجود owner_id
DO $$
DECLARE _t text;
DECLARE _tables text[] := ARRAY[
  'orders','order_items','products','analytics_events','landing_pages',
  'expenses','expense_types','safes','safe_movements','purchases',
  'returns','return_shipments','settlements','settlement_shipments',
  'pixel_settings','header_settings','order_form_fields',
  'shipping_settings','shipping_zones','shipping_warehouse_products',
  'stock_movements','prep_lists','prep_list_orders',
  'fb_campaigns','fb_ads','fb_insights_daily','store_facebook_connections',
  'confirmation_settings','confirmation_templates','cancellation_reasons',
  'easyorders_products','whatsapp_settings','whatsapp_conversations','whatsapp_messages',
  'sticker_settings','store_settings','thank_you_settings',
  'city_corrections','hidden_default_cities','product_categories',
  'carrier_status_mappings','hidden_default_carrier_codes'
];
DECLARE _p record;
DECLARE _has_owner boolean;
DECLARE _has_store boolean;
BEGIN
  FOREACH _t IN ARRAY _tables LOOP
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=_t) THEN
      CONTINUE;
    END IF;
    SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=_t AND column_name='owner_id') INTO _has_owner;
    IF NOT _has_owner THEN CONTINUE; END IF;
    SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=_t AND column_name='store_id') INTO _has_store;

    FOR _p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename=_t LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', _p.policyname, _t);
    END LOOP;

    IF _has_store THEN
      EXECUTE format($f$
        CREATE POLICY "owner_or_store_select" ON public.%I FOR SELECT TO authenticated
          USING (public.has_store_or_legacy(owner_id, store_id));
        CREATE POLICY "owner_or_store_insert" ON public.%I FOR INSERT TO authenticated
          WITH CHECK (public.has_store_or_legacy(owner_id, store_id));
        CREATE POLICY "owner_or_store_update" ON public.%I FOR UPDATE TO authenticated
          USING (public.has_store_or_legacy(owner_id, store_id))
          WITH CHECK (public.has_store_or_legacy(owner_id, store_id));
        CREATE POLICY "owner_or_store_delete" ON public.%I FOR DELETE TO authenticated
          USING (public.has_store_or_legacy(owner_id, store_id));
      $f$, _t, _t, _t, _t);
    ELSE
      EXECUTE format($f$
        CREATE POLICY "owner_all" ON public.%I FOR ALL TO authenticated
          USING (public.is_member_of(owner_id) OR public.has_role(auth.uid(), 'admin'::app_role))
          WITH CHECK (public.is_member_of(owner_id) OR public.has_role(auth.uid(), 'admin'::app_role));
      $f$, _t);
    END IF;
  END LOOP;
END $$;

-- استعادة إدراج analytics_events للزوار
DROP POLICY IF EXISTS "owner_or_store_insert" ON public.analytics_events;
CREATE POLICY "Allow public insert analytics" ON public.analytics_events
  FOR INSERT TO anon, authenticated WITH CHECK (true);

-- استعادة قراءة عامة للمنتجات والصفحات (مطلوب للـ landing pages)
DROP POLICY IF EXISTS "owner_or_store_select" ON public.products;
CREATE POLICY "Public read products" ON public.products FOR SELECT USING (true);
CREATE POLICY "Owner write products insert" ON public.products FOR INSERT TO authenticated
  WITH CHECK (public.has_store_or_legacy(owner_id, store_id));
CREATE POLICY "Owner write products update" ON public.products FOR UPDATE TO authenticated
  USING (public.has_store_or_legacy(owner_id, store_id))
  WITH CHECK (public.has_store_or_legacy(owner_id, store_id));
CREATE POLICY "Owner write products delete" ON public.products FOR DELETE TO authenticated
  USING (public.has_store_or_legacy(owner_id, store_id));

DROP POLICY IF EXISTS "owner_or_store_select" ON public.landing_pages;
CREATE POLICY "Public read landing_pages" ON public.landing_pages FOR SELECT USING (true);

-- قيد فريد جديد لـ easyorders_products يشمل المتجر
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='easyorders_products_owner_external_uniq') THEN
    DROP INDEX public.easyorders_products_owner_external_uniq;
  END IF;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS easyorders_products_owner_store_external_uniq
  ON public.easyorders_products(owner_id, store_id, external_id);
