-- Keep foreign-key joins and cascades from degrading into sequential scans.
-- The largest affected table is orders (~6.5k rows), so ordinary index builds
-- are short while remaining compatible with transactional migrations.
CREATE INDEX IF NOT EXISTS idx_cod_network_shipments_requested_by
  ON public.cod_network_shipments (requested_by);
CREATE INDEX IF NOT EXISTS idx_cod_network_sku_links_product_id
  ON public.cod_network_sku_links (product_id);
CREATE INDEX IF NOT EXISTS idx_courier_batches_courier_id
  ON public.courier_batches (courier_id);
CREATE INDEX IF NOT EXISTS idx_courier_batches_store_id
  ON public.courier_batches (store_id);
CREATE INDEX IF NOT EXISTS idx_courier_orders_batch_id
  ON public.courier_orders (batch_id);
CREATE INDEX IF NOT EXISTS idx_courier_orders_courier_store
  ON public.courier_orders (courier_id, store_id);
CREATE INDEX IF NOT EXISTS idx_courier_orders_receipt_id
  ON public.courier_orders (receipt_id);
CREATE INDEX IF NOT EXISTS idx_courier_receipts_courier_store
  ON public.courier_receipts (courier_id, store_id);
CREATE INDEX IF NOT EXISTS idx_courier_receipts_safe_id
  ON public.courier_receipts (safe_id);
CREATE INDEX IF NOT EXISTS idx_courier_receipts_store_id
  ON public.courier_receipts (store_id);
CREATE INDEX IF NOT EXISTS idx_courier_status_history_order_id
  ON public.courier_status_history (order_id);
CREATE INDEX IF NOT EXISTS idx_couriers_store_id
  ON public.couriers (store_id);
CREATE INDEX IF NOT EXISTS idx_expenses_expense_type_id
  ON public.expenses (expense_type_id);
CREATE INDEX IF NOT EXISTS idx_expenses_safe_id
  ON public.expenses (safe_id);
CREATE INDEX IF NOT EXISTS idx_header_settings_owner_id
  ON public.header_settings (owner_id);
CREATE INDEX IF NOT EXISTS idx_missed_orders_owner_id
  ON public.missed_orders (owner_id);
CREATE INDEX IF NOT EXISTS idx_missed_orders_product_id
  ON public.missed_orders (product_id);
CREATE INDEX IF NOT EXISTS idx_offer_flows_owner_id
  ON public.offer_flows (owner_id);
CREATE INDEX IF NOT EXISTS idx_offer_products_product_id
  ON public.offer_products (product_id);
CREATE INDEX IF NOT EXISTS idx_offer_rule_groups_offer_id
  ON public.offer_rule_groups (offer_id);
CREATE INDEX IF NOT EXISTS idx_offer_rule_groups_parent_group_id
  ON public.offer_rule_groups (parent_group_id);
CREATE INDEX IF NOT EXISTS idx_offer_rules_group_id
  ON public.offer_rules (group_id);
CREATE INDEX IF NOT EXISTS idx_offers_owner_id
  ON public.offers (owner_id);
CREATE INDEX IF NOT EXISTS idx_order_form_fields_owner_id
  ON public.order_form_fields (owner_id);
CREATE INDEX IF NOT EXISTS idx_orders_product_id
  ON public.orders (product_id);
CREATE INDEX IF NOT EXISTS idx_permission_group_items_permission_key
  ON public.permission_group_items (permission_key);
CREATE INDEX IF NOT EXISTS idx_pixel_settings_owner_id
  ON public.pixel_settings (owner_id);
CREATE INDEX IF NOT EXISTS idx_platform_signup_page_updated_by
  ON public.platform_signup_page (updated_by);
CREATE INDEX IF NOT EXISTS idx_profiles_plan_id
  ON public.profiles (plan_id);
CREATE INDEX IF NOT EXISTS idx_purchases_safe_id
  ON public.purchases (safe_id);
CREATE INDEX IF NOT EXISTS idx_settlements_safe_id
  ON public.settlements (safe_id);
CREATE INDEX IF NOT EXISTS idx_store_member_permissions_permission_key
  ON public.store_member_permissions (permission_key);
CREATE INDEX IF NOT EXISTS idx_store_member_stores_store_id
  ON public.store_member_stores (store_id);
CREATE INDEX IF NOT EXISTS idx_store_members_group_id
  ON public.store_members (group_id);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_wallet_id
  ON public.wallet_transactions (wallet_id);

-- Evaluate auth.uid() once per statement instead of once per candidate row.
ALTER POLICY courier_account_read ON public.courier_accounts
  USING (
    user_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1
      FROM public.couriers c
      WHERE c.id = courier_accounts.courier_id
        AND public.has_store_access(c.store_id)
    )
  );

ALTER POLICY "Super admins can read signup drafts" ON public.platform_signup_page
  USING (public.has_role((SELECT auth.uid()), 'admin'::public.app_role));

ALTER POLICY store_delivery_prices_select ON public.store_delivery_prices
  USING (
    public.rls_store_select(store_id)
    OR public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
  );

-- Trigger functions and private reporting helpers must not be exposed as RPCs.
-- Revoking EXECUTE does not prevent an existing trigger from firing.
REVOKE EXECUTE ON FUNCTION public.assert_store_owner_match() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.block_in_closed_period() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.deduct_order_fee() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_merchant_plan_limits() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_order_return_refund() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_financial_change() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_order_status_change() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.prevent_old_safe_movement_delete() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.protect_cod_network_items() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.protect_cod_network_order() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.protect_turbo_product_export() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.route_order_country() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_order_item_purchase_snapshot() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_safe_balance() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.touch_offer_stats_from_event() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_stores_seed_defaults() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.validate_order_status_transition() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.validate_safe_movement_balance() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._merged_carrier_mappings(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._order_carrier_category(text, text, jsonb, uuid, uuid) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public._merged_carrier_mappings(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public._order_carrier_category(text, text, jsonb, uuid, uuid) TO service_role;
