-- Global shipping zones (store_id IS NULL) are admin-synced reference data shared by all stores.
-- Phase 5 replaced public read with rls_store_select(store_id), which hides rows where store_id IS NULL
-- from non-admin users — stores saw empty city dropdowns after admin sync.

DROP POLICY IF EXISTS "store_tenant_select" ON public.shipping_zones;

CREATE POLICY "store_tenant_select" ON public.shipping_zones
  FOR SELECT TO authenticated
  USING (
    store_id IS NULL
    OR public.rls_store_select(store_id)
  );

COMMENT ON POLICY "store_tenant_select" ON public.shipping_zones IS
  'All authenticated users read global carrier city/area cache; per-store rows stay tenant-scoped.';
