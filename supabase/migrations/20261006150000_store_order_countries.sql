-- Keep country attribution intact. Review routing is a separate workflow flag.
ALTER TABLE public.stores ADD COLUMN operating_countries text[] NOT NULL DEFAULT ARRAY['LY']::text[]
  CHECK (cardinality(operating_countries) BETWEEN 1 AND 249 AND array_position(operating_countries,NULL) IS NULL
    AND array_to_string(operating_countries,',') ~ '^[A-Z]{2}(,[A-Z]{2})*$');
ALTER TABLE public.orders ADD COLUMN country_review_required boolean NOT NULL DEFAULT false;
UPDATE public.orders SET country_review_required=true
  WHERE status='pending' AND nullif(trim(country_code),'') IS NOT NULL AND upper(trim(country_code))<>'LY';

CREATE FUNCTION public.route_order_country() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE allowed text[];
BEGIN
  IF TG_OP='UPDATE' AND NEW.store_id IS NOT DISTINCT FROM OLD.store_id
    AND NEW.country_code IS NOT DISTINCT FROM OLD.country_code THEN RETURN NEW; END IF;
  -- Serialize settings saves and newly arriving orders so neither misses the other.
  SELECT operating_countries INTO allowed FROM public.stores WHERE id=NEW.store_id FOR SHARE;
  NEW.country_review_required := nullif(trim(NEW.country_code),'') IS NOT NULL
    AND NOT (upper(trim(NEW.country_code))=ANY(coalesce(allowed,ARRAY['LY']::text[])));
  RETURN NEW;
END; $$;
CREATE TRIGGER route_order_country BEFORE INSERT OR UPDATE OF store_id,country_code ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.route_order_country();

CREATE FUNCTION public.save_store_order_countries(_store_id uuid, _countries text[])
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE store_owner uuid; normalized text[]; moved integer;
BEGIN
  SELECT owner_id INTO store_owner FROM public.stores WHERE id=_store_id FOR UPDATE;
  IF auth.uid() IS NULL OR NOT FOUND OR (auth.uid()<>store_owner AND NOT public.has_role(auth.uid(),'admin'::app_role)) THEN
    RAISE EXCEPTION 'إعداد دول المتجر متاح للمالك والسوبر أدمن فقط' USING ERRCODE='42501';
  END IF;
  IF _countries IS NULL OR cardinality(_countries) NOT BETWEEN 1 AND 249
    OR EXISTS(SELECT 1 FROM unnest(_countries) c WHERE c IS NULL OR upper(trim(c)) !~ '^[A-Z]{2}$') THEN
    RAISE EXCEPTION 'اختر دولة واحدة على الأقل من قائمة الدول';
  END IF;
  SELECT array_agg(DISTINCT upper(trim(c)) ORDER BY upper(trim(c))) INTO normalized FROM unnest(_countries) c;
  IF NOT (normalized <@ string_to_array('AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW',' ')) THEN
    RAISE EXCEPTION 'اختر الدول من القائمة المعتمدة';
  END IF;
  UPDATE public.stores SET operating_countries=normalized WHERE id=_store_id;
  -- Enabling a country accepts existing waiting orders too. Disabling it only
  -- affects future arrivals; it never hides orders already accepted for work.
  UPDATE public.orders SET country_review_required=false
    WHERE store_id=_store_id AND status='pending' AND NOT is_deleted AND country_review_required
      AND upper(trim(country_code))=ANY(normalized);
  GET DIAGNOSTICS moved=ROW_COUNT;
  RETURN moved;
END; $$;

CREATE FUNCTION public.accept_country_orders(_store_id uuid, _order_ids uuid[])
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE ids uuid[]; found_count integer; moved integer;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_store_access(_store_id) THEN
    RAISE EXCEPTION 'ليس لديك صلاحية الوصول إلى هذا المتجر' USING ERRCODE='42501';
  END IF;
  IF _order_ids IS NULL OR cardinality(_order_ids) NOT BETWEEN 1 AND 500 OR array_position(_order_ids,NULL) IS NOT NULL THEN
    RAISE EXCEPTION 'حدد من طلب واحد إلى 500 طلب';
  END IF;
  SELECT array_agg(DISTINCT id) INTO ids FROM unnest(_order_ids) id;
  PERFORM 1 FROM public.orders WHERE store_id=_store_id AND id=ANY(ids) ORDER BY id FOR UPDATE;
  GET DIAGNOSTICS found_count=ROW_COUNT;
  IF found_count<>cardinality(ids) THEN RAISE EXCEPTION 'بعض الطلبات لا تتبع المتجر المحدد'; END IF;
  IF EXISTS (SELECT 1 FROM public.orders o WHERE o.id=ANY(ids) AND (
    o.status<>'pending' OR o.is_deleted OR coalesce(o.shipped_to_company,false)
    OR o.shipping_provider IS NOT NULL OR o.shipping_id IS NOT NULL OR o.shipping_reference IS NOT NULL
    OR EXISTS(SELECT 1 FROM public.courier_orders c WHERE c.order_id=o.id AND c.state IN ('assigned','delivered'))
  )) THEN RAISE EXCEPTION 'بعض الطلبات تغيّرت حالتها أو أُسندت للشحن؛ حدّث القائمة وأعد التحديد'; END IF;
  UPDATE public.orders SET country_review_required=false WHERE id=ANY(ids) AND country_review_required;
  GET DIAGNOSTICS moved=ROW_COUNT;
  RETURN moved;
END; $$;

CREATE OR REPLACE FUNCTION public.orders_page_counts(_store_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE result jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_store_access(_store_id) THEN
    RAISE EXCEPTION 'Access denied' USING ERRCODE='42501';
  END IF;
  WITH scoped AS MATERIALIZED (
    SELECT status,confirmation_status,is_deleted,country_review_required,
      coalesce(nullif(upper(trim(country_code)),''),'unknown') AS country
    FROM public.orders WHERE store_id=_store_id
  ), statuses AS (
    SELECT status,count(*) AS cnt FROM scoped
    WHERE NOT is_deleted AND (status<>'pending' OR NOT country_review_required) GROUP BY status
  ), confirmations AS (
    SELECT coalesce(confirmation_status,'unconfirmed') AS status,count(*) AS cnt
    FROM scoped WHERE NOT is_deleted AND status='pending' AND NOT country_review_required GROUP BY 1
  ), countries AS (
    SELECT country,count(*) AS cnt FROM scoped
    WHERE NOT is_deleted AND status='pending' AND NOT country_review_required GROUP BY country
  )
  SELECT jsonb_build_object(
    'statusCounts',jsonb_build_object('pending',0,'with_courier',0)||coalesce((SELECT jsonb_object_agg(status,cnt) FROM statuses),'{}'::jsonb),
    'confirmationCounts',coalesce((SELECT jsonb_object_agg(status,cnt) FROM confirmations),'{}'::jsonb),
    'pendingCountryCounts',coalesce((SELECT jsonb_object_agg(country,cnt) FROM countries),'{}'::jsonb),
    'foreignCount',(SELECT count(*) FROM scoped WHERE NOT is_deleted AND status='pending' AND country_review_required),
    'deletedCount',(SELECT count(*) FROM scoped WHERE is_deleted)
  ) INTO result;
  RETURN result;
END; $$;
REVOKE ALL ON FUNCTION public.save_store_order_countries(uuid,text[]),public.accept_country_orders(uuid,uuid[]),public.orders_page_counts(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.save_store_order_countries(uuid,text[]),public.accept_country_orders(uuid,uuid[]),public.orders_page_counts(uuid) TO authenticated;
-- Keep dashboard and legacy confirmation counters aligned with the Orders page.
CREATE OR REPLACE FUNCTION public.orders_confirmation_counts(_store_id uuid)
RETURNS TABLE(confirmation_status text,cnt bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT coalesce(o.confirmation_status,'unconfirmed')::text,count(*)::bigint
 FROM public.orders o WHERE o.store_id=_store_id AND NOT o.is_deleted
   AND o.status='pending' AND NOT o.country_review_required AND public.has_store_access(_store_id)
 GROUP BY 1;
$$;

CREATE OR REPLACE FUNCTION public.get_store_analytics(
  _store_id uuid,
  _days integer DEFAULT 7,
  _product_slug text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _owner_id uuid;
  _since timestamptz;
  _result jsonb;
  _pending_orders bigint;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  SELECT owner_id INTO _owner_id FROM public.stores WHERE id = _store_id;
  IF _owner_id IS NULL OR NOT (is_member_of(_owner_id) OR has_role(auth.uid(), 'admin'::app_role)) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  _days := GREATEST(1, LEAST(COALESCE(_days, 7), 90));
  _since := date_trunc('day', now()) - ((_days - 1) * interval '1 day');

  WITH visit_events AS (
    SELECT
      ae.id,
      ae.session_id,
      ae.created_at,
      public.normalize_traffic_source(ae.utm_source, ae.fbclid) AS source
    FROM public.analytics_events ae
    WHERE ae.store_id = _store_id
      AND ae.event_type = 'page_view'
      AND ae.created_at >= _since
      AND (_product_slug IS NULL OR ae.product_slug = _product_slug)
  ),
  checkout_events AS (
    SELECT
      ae.id,
      ae.session_id,
      ae.created_at,
      public.normalize_traffic_source(ae.utm_source, ae.fbclid) AS source
    FROM public.analytics_events ae
    WHERE ae.store_id = _store_id
      AND ae.event_type = 'checkout_start'
      AND ae.created_at >= _since
      AND (_product_slug IS NULL OR ae.product_slug = _product_slug)
  ),
  order_rows AS (
    SELECT
      o.id,
      o.created_at,
      public.normalize_traffic_source(o.utm_source, o.fbclid) AS source
    FROM public.orders o
    WHERE o.store_id = _store_id
      AND o.is_deleted = false
      AND o.created_at >= _since
      AND (
        _product_slug IS NULL
        OR o.landing_slug = _product_slug
        OR EXISTS (
          SELECT 1 FROM public.products p
          WHERE p.id = o.product_id AND p.slug = _product_slug
        )
      )
  ),
  visit_stats AS (
    SELECT
      COUNT(*)::bigint AS raw_views,
      COUNT(DISTINCT COALESCE(session_id, id::text))::bigint AS unique_visits
    FROM visit_events
  ),
  checkout_stats AS (
    SELECT COUNT(DISTINCT COALESCE(session_id, id::text))::bigint AS checkout_starts
    FROM checkout_events
  ),
  order_stats AS (
    SELECT COUNT(*)::bigint AS total_orders FROM order_rows
  ),
  summary AS (
    SELECT jsonb_build_object(
      'unique_visits', vs.unique_visits,
      'raw_page_views', vs.raw_views,
      'checkout_starts', cs.checkout_starts,
      'orders', os.total_orders,
      'conversion_rate',
        CASE WHEN vs.unique_visits > 0
          THEN round((os.total_orders::numeric / vs.unique_visits) * 100, 2)
          ELSE 0
        END,
      'checkout_rate',
        CASE WHEN vs.unique_visits > 0
          THEN round((cs.checkout_starts::numeric / vs.unique_visits) * 100, 2)
          ELSE 0
        END
    ) AS data
    FROM visit_stats vs, checkout_stats cs, order_stats os
  ),
  daily AS (
    SELECT COALESCE(jsonb_agg(row ORDER BY row->>'date'), '[]'::jsonb) AS data
    FROM (
      SELECT jsonb_build_object(
        'date', d.day::date,
        'visits', COALESCE(v.cnt, 0),
        'checkouts', COALESCE(c.cnt, 0),
        'orders', COALESCE(o.cnt, 0)
      ) AS row
      FROM generate_series(date_trunc('day', _since), date_trunc('day', now()), interval '1 day') AS d(day)
      LEFT JOIN (
        SELECT date_trunc('day', created_at) AS day, COUNT(DISTINCT COALESCE(session_id, id::text)) AS cnt
        FROM visit_events GROUP BY 1
      ) v ON v.day = d.day
      LEFT JOIN (
        SELECT date_trunc('day', created_at) AS day, COUNT(DISTINCT COALESCE(session_id, id::text)) AS cnt
        FROM checkout_events GROUP BY 1
      ) c ON c.day = d.day
      LEFT JOIN (
        SELECT date_trunc('day', created_at) AS day, COUNT(*) AS cnt
        FROM order_rows GROUP BY 1
      ) o ON o.day = d.day
    ) q
  ),
  sources AS (
    SELECT COALESCE(jsonb_agg(row ORDER BY (row->>'visits')::bigint DESC), '[]'::jsonb) AS data
    FROM (
      SELECT jsonb_build_object(
        'source', s.source,
        'visits', s.visits,
        'checkouts', s.checkouts,
        'orders', s.orders,
        'conversion_rate',
          CASE WHEN s.visits > 0 THEN round((s.orders::numeric / s.visits) * 100, 2) ELSE 0 END,
        'last_visit', s.last_visit
      ) AS row
      FROM (
        SELECT
          src.source,
          COALESCE(v.visits, 0) AS visits,
          COALESCE(c.checkouts, 0) AS checkouts,
          COALESCE(o.orders, 0) AS orders,
          v.last_visit
        FROM (
          SELECT DISTINCT source FROM (
            SELECT source FROM visit_events
            UNION SELECT source FROM checkout_events
            UNION SELECT source FROM order_rows
          ) u
        ) src
        LEFT JOIN (
          SELECT source,
            COUNT(DISTINCT COALESCE(session_id, id::text)) AS visits,
            MAX(created_at) AS last_visit
          FROM visit_events GROUP BY source
        ) v ON v.source = src.source
        LEFT JOIN (
          SELECT source, COUNT(DISTINCT COALESCE(session_id, id::text)) AS checkouts
          FROM checkout_events GROUP BY source
        ) c ON c.source = src.source
        LEFT JOIN (
          SELECT source, COUNT(*) AS orders FROM order_rows GROUP BY source
        ) o ON o.source = src.source
      ) s
      WHERE s.visits > 0 OR s.checkouts > 0 OR s.orders > 0
    ) q
  )
  SELECT jsonb_build_object(
    'summary', (SELECT data FROM summary),
    'daily', (SELECT data FROM daily),
    'sources', (SELECT data FROM sources)
  )
  INTO _result;

  SELECT COUNT(*)::bigint INTO _pending_orders
  FROM public.orders
  WHERE store_id = _store_id
    AND status = 'pending'
    AND is_deleted = false
    AND NOT country_review_required;

  RETURN _result || jsonb_build_object('pending_orders', _pending_orders, 'days', _days);
END;
$$;
REVOKE ALL ON FUNCTION public.orders_confirmation_counts(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.orders_confirmation_counts(uuid),public.get_store_analytics(uuid,integer,text) TO authenticated;
NOTIFY pgrst,'reload schema';
