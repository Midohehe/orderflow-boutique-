-- Faster confirmation delivery counts: settled/delivered orders count even without carrier category.

CREATE OR REPLACE FUNCTION public.orders_delivery_stats_summary(
  _store_id uuid,
  _owner_id uuid DEFAULT NULL,
  _product_name text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _owner uuid;
  _result json;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_store_access(_store_id) THEN
    RETURN NULL;
  END IF;

  _owner := COALESCE(
    _owner_id,
    (SELECT s.owner_id FROM public.stores s WHERE s.id = _store_id LIMIT 1)
  );

  WITH sent AS (
    SELECT
      o.status,
      o.confirmation_status,
      public._order_carrier_category(
        o.status, o.carrier_status, o.carrier_status_raw, _store_id, _owner
      ) AS carrier_cat
    FROM public.orders o
    LEFT JOIN public.products p
      ON p.id = o.product_id
     AND p.store_id = o.store_id
     AND p.deleted_at IS NULL
    WHERE o.store_id = _store_id
      AND o.is_deleted = false
      AND o.status <> 'cancelled'
      AND (
        o.shipping_reference IS NOT NULL
        OR o.status IN ('shipped', 'delivered', 'settled', 'returned_received', 'unpacked')
      )
      AND (
        _product_name IS NULL
        OR COALESCE(p.name, o.product_name) = _product_name
      )
  )
  SELECT json_build_object(
    'confirmed_total', COALESCE(SUM(CASE WHEN confirmation_status = 'confirmed' THEN 1 ELSE 0 END), 0),
    'confirmed_delivered', COALESCE(SUM(
      CASE
        WHEN confirmation_status = 'confirmed'
          AND (carrier_cat = 'delivered' OR status IN ('delivered', 'settled'))
        THEN 1
        ELSE 0
      END
    ), 0),
    'other_total', COALESCE(SUM(CASE WHEN confirmation_status IS DISTINCT FROM 'confirmed' THEN 1 ELSE 0 END), 0),
    'other_delivered', COALESCE(SUM(
      CASE
        WHEN confirmation_status IS DISTINCT FROM 'confirmed'
          AND (carrier_cat = 'delivered' OR status IN ('delivered', 'settled'))
        THEN 1
        ELSE 0
      END
    ), 0),
    'carrier_delivered', COALESCE(SUM(CASE WHEN carrier_cat = 'delivered' THEN 1 ELSE 0 END), 0),
    'carrier_returned', COALESCE(SUM(CASE WHEN carrier_cat = 'returned' THEN 1 ELSE 0 END), 0),
    'carrier_in_progress', COALESCE(SUM(CASE WHEN carrier_cat = 'in_progress' THEN 1 ELSE 0 END), 0),
    'carrier_uncategorized', COALESCE(SUM(CASE WHEN carrier_cat IS NULL THEN 1 ELSE 0 END), 0)
  )
  INTO _result
  FROM sent;

  RETURN _result;
END;
$$;
