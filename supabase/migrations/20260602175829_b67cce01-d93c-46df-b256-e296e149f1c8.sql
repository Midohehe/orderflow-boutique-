-- Indexes to speed up Orders page queries (per-store filtering by status / carrier_status)
CREATE INDEX IF NOT EXISTS idx_orders_store_status
  ON public.orders (store_id, status)
  WHERE is_deleted = false;

CREATE INDEX IF NOT EXISTS idx_orders_store_carrier_status
  ON public.orders (store_id, carrier_status)
  WHERE is_deleted = false AND status = 'shipped';

CREATE INDEX IF NOT EXISTS idx_orders_store_created_at
  ON public.orders (store_id, created_at DESC);

-- RPC: accurate carrier-status label counts for the "جاري التوصيل" dropdown,
-- computed server-side so the dropdown stays correct even when we paginate.
CREATE OR REPLACE FUNCTION public.orders_shipped_carrier_counts(_store_id uuid)
RETURNS TABLE(label text, cnt bigint)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(NULLIF(o.carrier_status, ''), 'بدون حالة') AS label,
         COUNT(*)::bigint AS cnt
  FROM public.orders o
  WHERE o.store_id = _store_id
    AND o.status = 'shipped'
    AND COALESCE(o.is_deleted, false) = false
    AND has_store_access(_store_id)
  GROUP BY 1
  ORDER BY 2 DESC;
$$;

GRANT EXECUTE ON FUNCTION public.orders_shipped_carrier_counts(uuid) TO authenticated;

-- RPC: per-tab order counts for the active store (server-side, single round-trip).
CREATE OR REPLACE FUNCTION public.orders_status_counts(_store_id uuid)
RETURNS TABLE(status text, cnt bigint)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(o.status, 'pending') AS status,
         COUNT(*)::bigint AS cnt
  FROM public.orders o
  WHERE o.store_id = _store_id
    AND COALESCE(o.is_deleted, false) = false
    AND has_store_access(_store_id)
  GROUP BY 1;
$$;

GRANT EXECUTE ON FUNCTION public.orders_status_counts(uuid) TO authenticated;