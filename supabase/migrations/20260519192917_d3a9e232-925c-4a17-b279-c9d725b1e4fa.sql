
-- Orders: lists by owner/store filtered by status
CREATE INDEX IF NOT EXISTS idx_orders_owner_status_created ON public.orders (owner_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_store_status ON public.orders (store_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_owner_created ON public.orders (owner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_phone ON public.orders (phone);
CREATE INDEX IF NOT EXISTS idx_orders_order_code ON public.orders (order_code);
CREATE INDEX IF NOT EXISTS idx_orders_shipping_id ON public.orders (shipping_id) WHERE shipping_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_confirmation_status ON public.orders (owner_id, confirmation_status);

-- Order items
CREATE INDEX IF NOT EXISTS idx_order_items_order ON public.order_items (order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_owner ON public.order_items (owner_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product ON public.order_items (product_id);

-- Products
CREATE INDEX IF NOT EXISTS idx_products_slug ON public.products (slug);
CREATE INDEX IF NOT EXISTS idx_products_owner_visible ON public.products (owner_id, is_visible) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_products_store ON public.products (store_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_products_category ON public.products (category_id) WHERE deleted_at IS NULL;

-- Landing pages
CREATE INDEX IF NOT EXISTS idx_landing_pages_slug_visible ON public.landing_pages (slug, is_visible);
CREATE INDEX IF NOT EXISTS idx_landing_pages_owner ON public.landing_pages (owner_id);

-- Analytics
CREATE INDEX IF NOT EXISTS idx_analytics_owner_created ON public.analytics_events (owner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_slug_created ON public.analytics_events (product_slug, created_at DESC);

-- Profiles & stores
CREATE INDEX IF NOT EXISTS idx_profiles_username ON public.profiles (lower(username));
CREATE INDEX IF NOT EXISTS idx_stores_owner ON public.stores (owner_id);
CREATE INDEX IF NOT EXISTS idx_stores_slug ON public.stores (lower(slug));

-- Store members (used by get_effective_owner_id on every request)
CREATE INDEX IF NOT EXISTS idx_store_members_member ON public.store_members (member_user_id);
CREATE INDEX IF NOT EXISTS idx_store_members_owner ON public.store_members (owner_id);

-- Settlements / returns / shipments
CREATE INDEX IF NOT EXISTS idx_settlement_shipments_settlement ON public.settlement_shipments (settlement_id);
CREATE INDEX IF NOT EXISTS idx_settlement_shipments_order ON public.settlement_shipments (order_id);
CREATE INDEX IF NOT EXISTS idx_return_shipments_return ON public.return_shipments (return_id);
CREATE INDEX IF NOT EXISTS idx_return_shipments_order ON public.return_shipments (order_id);
CREATE INDEX IF NOT EXISTS idx_settlements_owner ON public.settlements (owner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_returns_owner ON public.returns (owner_id, created_at DESC);

-- Safe movements / expenses / purchases
CREATE INDEX IF NOT EXISTS idx_safe_movements_safe ON public.safe_movements (safe_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_owner ON public.expenses (owner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_purchases_owner ON public.purchases (owner_id, created_at DESC);

-- City corrections lookup
CREATE INDEX IF NOT EXISTS idx_city_corrections_input ON public.city_corrections (owner_id, lower(input_text));
