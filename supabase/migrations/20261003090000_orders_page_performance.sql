-- Authorize once per request, then aggregate the tab counters in one database call.
CREATE OR REPLACE FUNCTION public.orders_page_counts(_store_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE result jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_store_access(_store_id) THEN
    RAISE EXCEPTION 'Access denied' USING ERRCODE = '42501';
  END IF;
  WITH scoped AS MATERIALIZED (
    SELECT status, confirmation_status, is_deleted,
      (country_code IS NULL OR country_code IN ('LY', 'ly')) AS domestic
    FROM public.orders WHERE store_id = _store_id
  ), statuses AS (
    SELECT status, count(*) AS cnt FROM scoped
    WHERE is_deleted = false AND (status <> 'pending' OR domestic)
    GROUP BY status
  ), confirmations AS (
    SELECT coalesce(confirmation_status, 'unconfirmed') AS status, count(*) AS cnt
    FROM scoped WHERE is_deleted = false AND status = 'pending' AND domestic
    GROUP BY 1
  )
  SELECT jsonb_build_object(
    'statusCounts', jsonb_build_object('pending', 0, 'with_courier', 0) || coalesce((SELECT jsonb_object_agg(status, cnt) FROM statuses), '{}'::jsonb),
    'confirmationCounts', coalesce((SELECT jsonb_object_agg(status, cnt) FROM confirmations), '{}'::jsonb),
    'deletedCount', (SELECT count(*) FROM scoped WHERE is_deleted = true)
  ) INTO result;
  RETURN result;
END;
$$;
REVOKE ALL ON FUNCTION public.orders_page_counts(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.orders_page_counts(uuid) TO authenticated;

-- Resolve the store's carrier mappings once, instead of once for every shipment.
CREATE OR REPLACE FUNCTION public.orders_shipped_carrier_counts(_store_id uuid, _owner_id uuid DEFAULT NULL)
RETURNS TABLE(label text, cnt bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _owner uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_store_access(_store_id) THEN RETURN; END IF;
  _owner := COALESCE(_owner_id, (SELECT s.owner_id FROM public.stores s WHERE s.id = _store_id LIMIT 1));
  RETURN QUERY
  WITH mappings AS MATERIALIZED (
    SELECT * FROM public._merged_carrier_mappings(_store_id, _owner)
  )
  SELECT public._order_carrier_display_label(o.carrier_status, o.carrier_status_raw,
      public._order_extract_carrier_code(o.carrier_status, o.carrier_status_raw), m.custom_label),
    count(*)::bigint
  FROM public.orders o
  LEFT JOIN mappings m ON m.status_code = public._order_extract_carrier_code(o.carrier_status, o.carrier_status_raw)
  WHERE o.store_id = _store_id AND o.status = 'shipped' AND o.is_deleted = false
  GROUP BY 1 ORDER BY 2 DESC;
END;
$$;
