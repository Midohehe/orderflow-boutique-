-- Backfill store_id on warehouse products (required by phase5 RLS: rls_store_select(store_id))
UPDATE public.shipping_warehouse_products swp
SET store_id = COALESCE(
  (
    SELECT ss.store_id
    FROM public.shipping_settings ss
    WHERE ss.owner_id = swp.owner_id
      AND ss.store_id IS NOT NULL
    ORDER BY ss.updated_at DESC
    LIMIT 1
  ),
  (
    SELECT s.id
    FROM public.stores s
    WHERE s.owner_id = swp.owner_id
      AND s.is_default = true
    LIMIT 1
  ),
  (
    SELECT s.id
    FROM public.stores s
    WHERE s.owner_id = swp.owner_id
    ORDER BY s.created_at ASC
    LIMIT 1
  )
)
WHERE swp.store_id IS NULL;

-- Prefer store-scoped uniqueness (multi-store)
ALTER TABLE public.shipping_warehouse_products
  DROP CONSTRAINT IF EXISTS shipping_warehouse_products_owner_id_external_id_key;

DROP INDEX IF EXISTS public.shipping_warehouse_products_store_external_uidx;

ALTER TABLE public.shipping_warehouse_products
  ADD CONSTRAINT shipping_warehouse_products_store_external_key
  UNIQUE (store_id, external_id);
