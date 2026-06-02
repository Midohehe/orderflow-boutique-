CREATE OR REPLACE FUNCTION public.orders_shipped_carrier_counts(_store_id uuid)
 RETURNS TABLE(label text, cnt bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT COALESCE(NULLIF(o.carrier_status, ''), 'بدون حالة') AS label,
         COUNT(*)::bigint AS cnt
  FROM public.orders o
  WHERE o.store_id = _store_id
    AND COALESCE(o.is_deleted, false) = false
    AND (
      o.status = 'shipped'
      OR o.shipping_reference IS NOT NULL
      OR o.carrier_status IS NOT NULL
    )
    AND has_store_access(_store_id)
  GROUP BY 1
  ORDER BY 2 DESC;
$function$;