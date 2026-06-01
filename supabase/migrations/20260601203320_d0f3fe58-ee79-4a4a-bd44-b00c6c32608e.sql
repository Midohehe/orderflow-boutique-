-- Fix 1: Hide products.purchase_price from anonymous storefront visitors
REVOKE SELECT ON public.products FROM PUBLIC, anon;
GRANT SELECT ON public.products TO authenticated, service_role;
GRANT SELECT (
  id, name, description, price, original_price, images, slug,
  created_at, updated_at, colors, sizes, product_codes, is_visible,
  owner_id, stock, variant_stock, variant_warehouse_codes,
  easyorders_product_id, variant_easyorders_ids, warehouse_linked,
  upsell_enabled, upsell_offers, deleted_at, variant_skus, store_id,
  upsell_title, order_form_on_top, category_id, size_chart_url, reviews
) ON public.products TO anon;

-- Fix 2: Restrict Realtime subscriptions for authenticated users.
-- The app only uses postgres_changes (which are filtered through each
-- table's own RLS). Block broadcast/presence channels by default so
-- authenticated users from one owner cannot subscribe to another
-- owner's broadcast topics.
DROP POLICY IF EXISTS "auth users read own realtime" ON realtime.messages;
CREATE POLICY "auth users read own realtime"
ON realtime.messages
FOR SELECT
TO authenticated
USING (extension = 'postgres_changes');