-- Match the same carrier labels as the counts, before LIMIT/OFFSET.
CREATE FUNCTION public.orders_shipped_filtered_page(_store_id uuid, _filter text,
  _search text DEFAULT NULL, _product_name text DEFAULT NULL, _offset integer DEFAULT 0,
  _limit integer DEFAULT 50) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE result jsonb; owner uuid; search_pattern text;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_store_access(_store_id) THEN RAISE EXCEPTION 'Access denied'; END IF;
  SELECT owner_id INTO owner FROM public.stores WHERE id=_store_id;
  search_pattern := '%' || replace(replace(replace(coalesce(_search,''), E'\\', E'\\\\'), '%', E'\\%'), '_', E'\\_') || '%';
  WITH mappings AS MATERIALIZED (SELECT * FROM public._merged_carrier_mappings(_store_id,owner)),
  candidates AS MATERIALIZED (
    SELECT o.*,public._order_extract_carrier_code(o.carrier_status,o.carrier_status_raw) AS filter_code
    FROM public.orders o WHERE o.store_id=_store_id AND o.status='shipped' AND NOT o.is_deleted
      AND (_product_name IS NULL OR o.product_name=_product_name)
      AND (nullif(btrim(_search),'') IS NULL OR o.order_code ILIKE search_pattern OR o.shipping_reference ILIKE search_pattern
        OR o.phone ILIKE search_pattern OR o.customer_name ILIKE search_pattern)
  ), labelled AS (
    SELECT o.*,public._order_carrier_display_label(o.carrier_status,o.carrier_status_raw,o.filter_code,m.custom_label) AS filter_label
    FROM candidates o LEFT JOIN mappings m ON m.status_code=o.filter_code
  ), filtered AS MATERIALIZED (
    SELECT * FROM labelled o WHERE
      _filter='all' OR (_filter='__none__' AND nullif(btrim(o.carrier_status),'') IS NULL)
      OR (_filter='__all_delivered__' AND (o.filter_code IN ('DTR','DTRC','DTRUC')
        OR o.filter_label IN ('تم التسليم','تم التسليم والتحصيل','تم التسليم دون تحصيل')
        OR EXISTS(SELECT 1 FROM mappings m WHERE m.status_code IN ('DTR','DTRC','DTRUC') AND m.custom_label=o.filter_label)))
      OR (left(_filter,6)='label:' AND o.filter_label=substring(_filter FROM 7))
      OR (left(_filter,6)<>'label:' AND o.filter_code=_filter)
  ), page AS (SELECT * FROM filtered ORDER BY created_at DESC,id DESC
    OFFSET greatest(_offset,0) LIMIT least(greatest(_limit,1),500))
  SELECT jsonb_build_object('rows',coalesce((SELECT jsonb_agg(to_jsonb(p)-'filter_code'-'filter_label' ORDER BY p.created_at DESC,p.id DESC) FROM page p),'[]'::jsonb),
    'total',(SELECT count(*) FROM filtered)) INTO result;
  RETURN result;
END;
$$;
REVOKE ALL ON FUNCTION public.orders_shipped_filtered_page(uuid,text,text,text,integer,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.orders_shipped_filtered_page(uuid,text,text,text,integer,integer) TO authenticated;
NOTIFY pgrst,'reload schema';
