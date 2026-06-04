-- Backfill order_items.store_id from parent order
UPDATE public.order_items oi
SET store_id = o.store_id
FROM public.orders o
WHERE oi.order_id = o.id
  AND oi.store_id IS NULL
  AND o.store_id IS NOT NULL;

-- Dashboard edit: allow authenticated insert when order belongs to same store
DROP POLICY IF EXISTS "store_tenant_insert" ON public.order_items;
CREATE POLICY "store_tenant_insert" ON public.order_items
  FOR INSERT TO authenticated
  WITH CHECK (
    public.rls_store_write(store_id, owner_id)
    AND EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_items.order_id
        AND o.store_id = order_items.store_id
        AND o.owner_id = order_items.owner_id
    )
  );
