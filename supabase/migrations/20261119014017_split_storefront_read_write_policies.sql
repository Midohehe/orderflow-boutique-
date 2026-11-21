-- These storefront tables already have a SELECT policy that covers public
-- rows plus the current store's private rows. The legacy FOR ALL policy made
-- Postgres evaluate the tenant predicate again on every read. Keep the same
-- write checks while removing that duplicate SELECT work.
DO $migration$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'header_settings',
    'landing_page_templates',
    'order_form_fields',
    'pixel_settings',
    'store_page_layouts',
    'store_settings',
    'store_themes'
  ]
  LOOP
    EXECUTE format('DROP POLICY store_tenant_write ON public.%I', table_name);

    EXECUTE format(
      'CREATE POLICY store_tenant_insert ON public.%I FOR INSERT TO authenticated WITH CHECK (public.rls_store_write(store_id, owner_id))',
      table_name
    );
    EXECUTE format(
      'CREATE POLICY store_tenant_update ON public.%I FOR UPDATE TO authenticated USING (public.rls_store_select(store_id)) WITH CHECK (public.rls_store_write(store_id, owner_id))',
      table_name
    );
    EXECUTE format(
      'CREATE POLICY store_tenant_delete ON public.%I FOR DELETE TO authenticated USING (public.rls_store_select(store_id))',
      table_name
    );
  END LOOP;
END
$migration$;

-- Delivery prices are public-readable. Preserve the stricter write predicate
-- and remove two redundant authenticated SELECT branches.
DROP POLICY store_delivery_prices_select ON public.store_delivery_prices;
DROP POLICY store_delivery_prices_write ON public.store_delivery_prices;

CREATE POLICY store_delivery_prices_insert
  ON public.store_delivery_prices FOR INSERT TO authenticated
  WITH CHECK (public.rls_store_write(store_id, owner_id));
CREATE POLICY store_delivery_prices_update
  ON public.store_delivery_prices FOR UPDATE TO authenticated
  USING (public.rls_store_write(store_id, owner_id))
  WITH CHECK (public.rls_store_write(store_id, owner_id));
CREATE POLICY store_delivery_prices_delete
  ON public.store_delivery_prices FOR DELETE TO authenticated
  USING (public.rls_store_write(store_id, owner_id));

-- Stores are already public-readable. Keep owner/admin writes without running
-- the owner and tenant-read predicates for every storefront lookup.
DROP POLICY store_tenant_read ON public.stores;
DROP POLICY store_owner_manage ON public.stores;

CREATE POLICY store_owner_insert
  ON public.stores FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) = owner_id
    OR public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
  );
CREATE POLICY store_owner_update
  ON public.stores FOR UPDATE TO authenticated
  USING (
    (SELECT auth.uid()) = owner_id
    OR public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
  )
  WITH CHECK (
    (SELECT auth.uid()) = owner_id
    OR public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
  );
CREATE POLICY store_owner_delete
  ON public.stores FOR DELETE TO authenticated
  USING (
    (SELECT auth.uid()) = owner_id
    OR public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
  );
