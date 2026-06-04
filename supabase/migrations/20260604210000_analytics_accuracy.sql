-- Accurate landing analytics: session dedupe + aggregated dashboard RPC

ALTER TABLE public.analytics_events
  ADD COLUMN IF NOT EXISTS session_id text;

CREATE INDEX IF NOT EXISTS idx_analytics_store_type_created
  ON public.analytics_events (store_id, event_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_analytics_store_session
  ON public.analytics_events (store_id, session_id)
  WHERE session_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_orders_store_created_utm
  ON public.orders (store_id, created_at DESC)
  WHERE is_deleted = false;

CREATE OR REPLACE FUNCTION public.normalize_traffic_source(
  _source text,
  _fbclid text DEFAULT NULL
)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN COALESCE(NULLIF(trim(lower(_source)), ''), '') = '' AND _fbclid IS NOT NULL AND _fbclid <> '' THEN 'facebook'
    WHEN COALESCE(NULLIF(trim(lower(_source)), ''), '') = '' THEN 'direct'
    WHEN lower(trim(_source)) IN ('fb', 'facebook', 'meta', 'fbads') THEN 'facebook'
    WHEN lower(trim(_source)) IN ('ig', 'instagram', 'insta') THEN 'instagram'
    WHEN lower(trim(_source)) IN ('tiktok', 'tt') THEN 'tiktok'
    WHEN lower(trim(_source)) IN ('google', 'gads', 'adwords') THEN 'google'
    WHEN lower(trim(_source)) IN ('twitter', 'x') THEN 'twitter'
    WHEN lower(trim(_source)) IN ('snap', 'snapchat') THEN 'snapchat'
    ELSE lower(trim(_source))
  END;
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
    AND (country_code IS NULL OR country_code IN ('', 'LY', 'ly'));

  RETURN _result || jsonb_build_object('pending_orders', _pending_orders, 'days', _days);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_store_analytics(uuid, integer, text) TO authenticated;
