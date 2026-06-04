-- Lightweight counts for pending-tab confirmation filters (avoids loading all orders client-side)

CREATE OR REPLACE FUNCTION public.orders_confirmation_counts(_store_id uuid)
RETURNS TABLE(confirmation_status text, cnt bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COALESCE(o.confirmation_status, 'unconfirmed') AS confirmation_status,
    COUNT(*)::bigint AS cnt
  FROM public.orders o
  INNER JOIN public.stores s ON s.id = o.store_id
  WHERE o.store_id = _store_id
    AND o.is_deleted = false
    AND o.status = 'pending'
    AND (o.country_code IS NULL OR UPPER(o.country_code) = 'LY')
    AND (public.is_member_of(s.owner_id) OR public.has_role(auth.uid(), 'admin'::app_role))
  GROUP BY 1;
$$;

GRANT EXECUTE ON FUNCTION public.orders_confirmation_counts(uuid) TO authenticated;
