-- Keep the public 15-minute order-item attachment rule for anon only. For
-- authenticated users, combine the previous three permissive INSERT checks
-- into one logically equivalent policy.
ALTER POLICY "Public insert order_items"
  ON public.order_items TO anon;

DROP POLICY owner_or_store_insert ON public.order_items;
DROP POLICY store_tenant_insert ON public.order_items;

CREATE POLICY authenticated_insert_order_items
  ON public.order_items FOR INSERT TO authenticated
  WITH CHECK (
    (
      store_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.orders o
        WHERE o.id = order_items.order_id
          AND o.store_id = order_items.store_id
          AND o.owner_id = order_items.owner_id
          AND o.created_at > now() - interval '15 minutes'
      )
    )
    OR public.has_store_or_legacy(owner_id, store_id)
    OR (
      public.rls_store_write(store_id, owner_id)
      AND EXISTS (
        SELECT 1 FROM public.orders o
        WHERE o.id = order_items.order_id
          AND o.store_id = order_items.store_id
          AND o.owner_id = order_items.owner_id
      )
    )
  );

-- Merge the old owner/legacy and store-tenant branches for each command.
DROP POLICY owner_or_store_select ON public.order_items;
DROP POLICY store_tenant_select ON public.order_items;
CREATE POLICY authenticated_select_order_items
  ON public.order_items FOR SELECT TO authenticated
  USING (
    public.has_store_or_legacy(owner_id, store_id)
    OR public.rls_store_select(store_id)
  );

DROP POLICY owner_or_store_delete ON public.order_items;
DROP POLICY store_tenant_delete ON public.order_items;
CREATE POLICY authenticated_delete_order_items
  ON public.order_items FOR DELETE TO authenticated
  USING (
    public.has_store_or_legacy(owner_id, store_id)
    OR public.rls_store_select(store_id)
  );

DROP POLICY owner_or_store_update ON public.order_items;
DROP POLICY store_tenant_update ON public.order_items;
CREATE POLICY authenticated_update_order_items
  ON public.order_items FOR UPDATE TO authenticated
  USING (
    public.has_store_or_legacy(owner_id, store_id)
    OR public.rls_store_select(store_id)
  )
  WITH CHECK (
    public.has_store_or_legacy(owner_id, store_id)
    OR public.rls_store_write(store_id, owner_id)
  );

-- The unrestricted analytics INSERT policy already applies to authenticated
-- users, so the narrower branch was redundant and never changed the result.
DROP POLICY store_tenant_insert ON public.offer_analytics_events;

-- These helpers are referenced only by authenticated RLS policies. Remove
-- anonymous direct RPC access while retaining signed-in and server usage.
REVOKE EXECUTE ON FUNCTION public.has_store_or_legacy(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_store_or_legacy(uuid, uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.offer_belongs_to_accessible_store(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.offer_belongs_to_accessible_store(uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.offer_writable(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.offer_writable(uuid) TO authenticated, service_role;
