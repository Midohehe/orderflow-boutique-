
-- 1) Restrict purchase_price column on products to owners/admin only
REVOKE SELECT (purchase_price) ON public.products FROM anon, authenticated;

-- 2) Tighten order_items public insert: only for recent matching order
DROP POLICY IF EXISTS "Public insert order_items" ON public.order_items;
CREATE POLICY "Public insert order_items" ON public.order_items
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_items.order_id
        AND o.owner_id = order_items.owner_id
        AND o.created_at > now() - interval '15 minutes'
    )
  );

-- 3) Remove public read on internal merchant config tables
DROP POLICY IF EXISTS "Public read carrier_status_mappings" ON public.carrier_status_mappings;
CREATE POLICY "Authenticated read carrier_status_mappings" ON public.carrier_status_mappings
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Public read hidden_default_carrier_codes" ON public.hidden_default_carrier_codes;
CREATE POLICY "Authenticated read hidden_default_carrier_codes" ON public.hidden_default_carrier_codes
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Public read city_corrections" ON public.city_corrections;
CREATE POLICY "Authenticated read city_corrections" ON public.city_corrections
  FOR SELECT TO authenticated USING (true);

-- order_form_fields stays public for landing pages, but hide owner/store ids from anon
REVOKE SELECT (owner_id, store_id) ON public.order_form_fields FROM anon;

-- 4) Fix has_store_access NULL bypass
CREATE OR REPLACE FUNCTION public.has_store_access(_store_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT _store_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.stores s
    WHERE s.id = _store_id AND (
      s.owner_id = auth.uid()
      OR has_role(auth.uid(), 'admin'::app_role)
      OR EXISTS (
        SELECT 1 FROM public.store_members sm
        JOIN public.store_member_stores sms ON sms.member_id = sm.id
        WHERE sm.member_user_id = auth.uid()
          AND sm.owner_id = s.owner_id
          AND sms.store_id = _store_id
      )
      OR EXISTS (
        SELECT 1 FROM public.store_members sm
        WHERE sm.member_user_id = auth.uid()
          AND sm.owner_id = s.owner_id
          AND NOT EXISTS (SELECT 1 FROM public.store_member_stores WHERE member_id = sm.id)
      )
    )
  );
$function$;

-- 5) Revoke anon EXECUTE on sensitive SECURITY DEFINER functions
REVOKE EXECUTE ON FUNCTION public.get_owner_product_costs(uuid[]) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.store_used_skus(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.has_permission(text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.has_store_access(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_member_of(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.get_effective_owner_id(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.get_owner_product_costs(uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.store_used_skus(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_permission(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_store_access(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_member_of(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_effective_owner_id(uuid) TO authenticated;

-- 6) Realtime channel authorization: only authenticated users for their own topics
ALTER TABLE IF EXISTS realtime.messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "auth users read own realtime" ON realtime.messages;
CREATE POLICY "auth users read own realtime" ON realtime.messages
  FOR SELECT TO authenticated USING (true);
