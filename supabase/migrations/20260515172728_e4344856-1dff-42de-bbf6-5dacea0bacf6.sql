-- =====================================================================
-- 1) Permissions catalog
-- =====================================================================
CREATE TABLE public.permissions (
  key TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  category TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read permissions" ON public.permissions FOR SELECT USING (true);
CREATE POLICY "Admin write permissions" ON public.permissions FOR ALL
  USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));

-- 2) Permission groups
CREATE TABLE public.permission_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.permission_groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read perm groups" ON public.permission_groups FOR SELECT USING (true);
CREATE POLICY "Admin write perm groups" ON public.permission_groups FOR ALL
  USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));

CREATE TABLE public.permission_group_items (
  group_id UUID NOT NULL REFERENCES public.permission_groups(id) ON DELETE CASCADE,
  permission_key TEXT NOT NULL REFERENCES public.permissions(key) ON DELETE CASCADE,
  PRIMARY KEY (group_id, permission_key)
);
ALTER TABLE public.permission_group_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read group items" ON public.permission_group_items FOR SELECT USING (true);
CREATE POLICY "Admin write group items" ON public.permission_group_items FOR ALL
  USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));

-- 3) Store members + per-member extra permissions
CREATE TABLE public.store_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL,
  member_user_id UUID NOT NULL UNIQUE,
  group_id UUID REFERENCES public.permission_groups(id) ON DELETE SET NULL,
  display_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_store_members_owner ON public.store_members(owner_id);
ALTER TABLE public.store_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner manage store_members" ON public.store_members FOR ALL
  USING (auth.uid() = owner_id OR has_role(auth.uid(),'admin'))
  WITH CHECK (auth.uid() = owner_id OR has_role(auth.uid(),'admin'));
CREATE POLICY "Member read self" ON public.store_members FOR SELECT
  USING (member_user_id = auth.uid());

CREATE TABLE public.store_member_permissions (
  member_id UUID NOT NULL REFERENCES public.store_members(id) ON DELETE CASCADE,
  permission_key TEXT NOT NULL REFERENCES public.permissions(key) ON DELETE CASCADE,
  PRIMARY KEY (member_id, permission_key)
);
ALTER TABLE public.store_member_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner manage member perms" ON public.store_member_permissions FOR ALL
  USING (EXISTS (SELECT 1 FROM public.store_members sm WHERE sm.id = member_id AND (sm.owner_id = auth.uid() OR has_role(auth.uid(),'admin'))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.store_members sm WHERE sm.id = member_id AND (sm.owner_id = auth.uid() OR has_role(auth.uid(),'admin'))));
CREATE POLICY "Member read own perms" ON public.store_member_permissions FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.store_members sm WHERE sm.id = member_id AND sm.member_user_id = auth.uid()));

-- =====================================================================
-- 4) Helper functions
-- =====================================================================
CREATE OR REPLACE FUNCTION public.get_effective_owner_id(_uid UUID)
RETURNS UUID LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(
    (SELECT owner_id FROM public.store_members WHERE member_user_id = _uid LIMIT 1),
    _uid
  );
$$;

CREATE OR REPLACE FUNCTION public.is_member_of(_owner_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _owner_id IS NOT NULL AND (
    auth.uid() = _owner_id
    OR EXISTS (SELECT 1 FROM public.store_members WHERE owner_id = _owner_id AND member_user_id = auth.uid())
  );
$$;

CREATE OR REPLACE FUNCTION public.has_permission(_key TEXT)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    has_role(auth.uid(), 'admin')
    OR NOT EXISTS (SELECT 1 FROM public.store_members WHERE member_user_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.store_members sm
      JOIN public.permission_group_items pgi ON pgi.group_id = sm.group_id
      WHERE sm.member_user_id = auth.uid() AND pgi.permission_key = _key
    )
    OR EXISTS (
      SELECT 1 FROM public.store_members sm
      JOIN public.store_member_permissions smp ON smp.member_id = sm.id
      WHERE sm.member_user_id = auth.uid() AND smp.permission_key = _key
    );
$$;

-- 5) Update set_owner_id to inherit parent owner for sub-users
CREATE OR REPLACE FUNCTION public.set_owner_id()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.owner_id IS NULL THEN
    NEW.owner_id := public.get_effective_owner_id(auth.uid());
  END IF;
  RETURN NEW;
END;
$$;

-- =====================================================================
-- 6) Update RLS policies on owner-scoped tables to use is_member_of
-- =====================================================================

-- analytics_events
DROP POLICY IF EXISTS "Owner read analytics" ON public.analytics_events;
CREATE POLICY "Owner read analytics" ON public.analytics_events FOR SELECT
  USING (public.is_member_of(owner_id) OR has_role(auth.uid(),'admin'));

-- easyorders_products
DROP POLICY IF EXISTS "Owner all easyorders_products" ON public.easyorders_products;
CREATE POLICY "Owner all easyorders_products" ON public.easyorders_products FOR ALL
  USING (public.is_member_of(owner_id) OR has_role(auth.uid(),'admin'))
  WITH CHECK (public.is_member_of(owner_id) OR has_role(auth.uid(),'admin'));

-- expense_types
DROP POLICY IF EXISTS "Owner all expense_types" ON public.expense_types;
CREATE POLICY "Owner all expense_types" ON public.expense_types FOR ALL
  USING (public.is_member_of(owner_id) OR has_role(auth.uid(),'admin'))
  WITH CHECK (public.is_member_of(owner_id) OR has_role(auth.uid(),'admin'));

-- expenses
DROP POLICY IF EXISTS "Owner all expenses" ON public.expenses;
CREATE POLICY "Owner all expenses" ON public.expenses FOR ALL
  USING (public.is_member_of(owner_id) OR has_role(auth.uid(),'admin'))
  WITH CHECK (public.is_member_of(owner_id) OR has_role(auth.uid(),'admin'));

-- header_settings
DROP POLICY IF EXISTS "Owner write header_settings" ON public.header_settings;
CREATE POLICY "Owner write header_settings" ON public.header_settings FOR ALL
  USING (public.is_member_of(owner_id) OR has_role(auth.uid(),'admin'))
  WITH CHECK (public.is_member_of(owner_id) OR has_role(auth.uid(),'admin'));

-- order_confirmation_attempts
DROP POLICY IF EXISTS "Owner all order_confirmation_attempts" ON public.order_confirmation_attempts;
CREATE POLICY "Owner all order_confirmation_attempts" ON public.order_confirmation_attempts FOR ALL
  USING (public.is_member_of(owner_id) OR has_role(auth.uid(),'admin'))
  WITH CHECK (public.is_member_of(owner_id) OR has_role(auth.uid(),'admin'));

-- order_form_fields
DROP POLICY IF EXISTS "Owner write order_form_fields" ON public.order_form_fields;
CREATE POLICY "Owner write order_form_fields" ON public.order_form_fields FOR ALL
  USING (public.is_member_of(owner_id) OR has_role(auth.uid(),'admin'))
  WITH CHECK (public.is_member_of(owner_id) OR has_role(auth.uid(),'admin'));

-- order_items
DROP POLICY IF EXISTS "Owner read order_items" ON public.order_items;
DROP POLICY IF EXISTS "Owner update order_items" ON public.order_items;
DROP POLICY IF EXISTS "Owner delete order_items" ON public.order_items;
CREATE POLICY "Owner read order_items" ON public.order_items FOR SELECT
  USING (public.is_member_of(owner_id) OR has_role(auth.uid(),'admin'));
CREATE POLICY "Owner update order_items" ON public.order_items FOR UPDATE
  USING (public.is_member_of(owner_id) OR has_role(auth.uid(),'admin'));
CREATE POLICY "Owner delete order_items" ON public.order_items FOR DELETE
  USING (public.is_member_of(owner_id) OR has_role(auth.uid(),'admin'));

-- orders
DROP POLICY IF EXISTS "Owner read orders" ON public.orders;
DROP POLICY IF EXISTS "Owner update orders" ON public.orders;
DROP POLICY IF EXISTS "Owner delete orders" ON public.orders;
CREATE POLICY "Owner read orders" ON public.orders FOR SELECT
  USING (public.is_member_of(owner_id) OR has_role(auth.uid(),'admin'));
CREATE POLICY "Owner update orders" ON public.orders FOR UPDATE
  USING (public.is_member_of(owner_id) OR has_role(auth.uid(),'admin'));
CREATE POLICY "Owner delete orders" ON public.orders FOR DELETE
  USING (public.is_member_of(owner_id) OR has_role(auth.uid(),'admin'));

-- pixel_settings
DROP POLICY IF EXISTS "Owner write pixel_settings" ON public.pixel_settings;
CREATE POLICY "Owner write pixel_settings" ON public.pixel_settings FOR ALL
  USING (public.is_member_of(owner_id) OR has_role(auth.uid(),'admin'))
  WITH CHECK (public.is_member_of(owner_id) OR has_role(auth.uid(),'admin'));

-- products (insert check + update/delete)
DROP POLICY IF EXISTS "Owner insert products" ON public.products;
DROP POLICY IF EXISTS "Owner update products" ON public.products;
DROP POLICY IF EXISTS "Owner delete products" ON public.products;
CREATE POLICY "Owner insert products" ON public.products FOR INSERT
  WITH CHECK (public.is_member_of(owner_id));
CREATE POLICY "Owner update products" ON public.products FOR UPDATE
  USING (public.is_member_of(owner_id) OR has_role(auth.uid(),'admin'));
CREATE POLICY "Owner delete products" ON public.products FOR DELETE
  USING (public.is_member_of(owner_id) OR has_role(auth.uid(),'admin'));

-- purchases
DROP POLICY IF EXISTS "Owner all purchases" ON public.purchases;
CREATE POLICY "Owner all purchases" ON public.purchases FOR ALL
  USING (public.is_member_of(owner_id) OR has_role(auth.uid(),'admin'))
  WITH CHECK (public.is_member_of(owner_id) OR has_role(auth.uid(),'admin'));

-- return_shipments
DROP POLICY IF EXISTS "Owner all return_shipments" ON public.return_shipments;
CREATE POLICY "Owner all return_shipments" ON public.return_shipments FOR ALL
  USING (public.is_member_of(owner_id) OR has_role(auth.uid(),'admin'))
  WITH CHECK (public.is_member_of(owner_id) OR has_role(auth.uid(),'admin'));

-- returns
DROP POLICY IF EXISTS "Owner all returns" ON public.returns;
CREATE POLICY "Owner all returns" ON public.returns FOR ALL
  USING (public.is_member_of(owner_id) OR has_role(auth.uid(),'admin'))
  WITH CHECK (public.is_member_of(owner_id) OR has_role(auth.uid(),'admin'));

-- safe_movements
DROP POLICY IF EXISTS "Owner all safe_movements" ON public.safe_movements;
CREATE POLICY "Owner all safe_movements" ON public.safe_movements FOR ALL
  USING (public.is_member_of(owner_id) OR has_role(auth.uid(),'admin'))
  WITH CHECK (public.is_member_of(owner_id) OR has_role(auth.uid(),'admin'));

-- safes
DROP POLICY IF EXISTS "Owner all safes" ON public.safes;
CREATE POLICY "Owner all safes" ON public.safes FOR ALL
  USING (public.is_member_of(owner_id) OR has_role(auth.uid(),'admin'))
  WITH CHECK (public.is_member_of(owner_id) OR has_role(auth.uid(),'admin'));

-- settlement_shipments
DROP POLICY IF EXISTS "Owner all settlement_shipments" ON public.settlement_shipments;
CREATE POLICY "Owner all settlement_shipments" ON public.settlement_shipments FOR ALL
  USING (public.is_member_of(owner_id) OR has_role(auth.uid(),'admin'))
  WITH CHECK (public.is_member_of(owner_id) OR has_role(auth.uid(),'admin'));

-- settlements
DROP POLICY IF EXISTS "Owner all settlements" ON public.settlements;
CREATE POLICY "Owner all settlements" ON public.settlements FOR ALL
  USING (public.is_member_of(owner_id) OR has_role(auth.uid(),'admin'))
  WITH CHECK (public.is_member_of(owner_id) OR has_role(auth.uid(),'admin'));

-- shipping_settings
DROP POLICY IF EXISTS "Owner all shipping_settings" ON public.shipping_settings;
CREATE POLICY "Owner all shipping_settings" ON public.shipping_settings FOR ALL
  USING (public.is_member_of(owner_id) OR has_role(auth.uid(),'admin'))
  WITH CHECK (public.is_member_of(owner_id) OR has_role(auth.uid(),'admin'));

-- shipping_warehouse_products
DROP POLICY IF EXISTS "Owner all swp" ON public.shipping_warehouse_products;
CREATE POLICY "Owner all swp" ON public.shipping_warehouse_products FOR ALL
  USING (public.is_member_of(owner_id) OR has_role(auth.uid(),'admin'))
  WITH CHECK (public.is_member_of(owner_id) OR has_role(auth.uid(),'admin'));

-- shipping_zones
DROP POLICY IF EXISTS "Owner read zones" ON public.shipping_zones;
DROP POLICY IF EXISTS "Owner write zones" ON public.shipping_zones;
CREATE POLICY "Owner read zones" ON public.shipping_zones FOR SELECT
  USING (public.is_member_of(owner_id) OR has_role(auth.uid(),'admin'));
CREATE POLICY "Owner write zones" ON public.shipping_zones FOR ALL
  USING (public.is_member_of(owner_id) OR has_role(auth.uid(),'admin'))
  WITH CHECK (public.is_member_of(owner_id) OR has_role(auth.uid(),'admin'));

-- sticker_settings
DROP POLICY IF EXISTS "Owner all sticker_settings" ON public.sticker_settings;
CREATE POLICY "Owner all sticker_settings" ON public.sticker_settings FOR ALL
  USING (public.is_member_of(owner_id) OR has_role(auth.uid(),'admin'))
  WITH CHECK (public.is_member_of(owner_id) OR has_role(auth.uid(),'admin'));

-- stock_movements
DROP POLICY IF EXISTS "Owner all stock_movements" ON public.stock_movements;
CREATE POLICY "Owner all stock_movements" ON public.stock_movements FOR ALL
  USING (public.is_member_of(owner_id) OR has_role(auth.uid(),'admin'))
  WITH CHECK (public.is_member_of(owner_id) OR has_role(auth.uid(),'admin'));

-- store_settings
DROP POLICY IF EXISTS "Owner write store_settings" ON public.store_settings;
CREATE POLICY "Owner write store_settings" ON public.store_settings FOR ALL
  USING (public.is_member_of(owner_id) OR has_role(auth.uid(),'admin'))
  WITH CHECK (public.is_member_of(owner_id) OR has_role(auth.uid(),'admin'));

-- whatsapp_conversations
DROP POLICY IF EXISTS "Owner all whatsapp_conversations" ON public.whatsapp_conversations;
CREATE POLICY "Owner all whatsapp_conversations" ON public.whatsapp_conversations FOR ALL
  USING (public.is_member_of(owner_id) OR has_role(auth.uid(),'admin'))
  WITH CHECK (public.is_member_of(owner_id) OR has_role(auth.uid(),'admin'));

-- whatsapp_messages
DROP POLICY IF EXISTS "Owner all whatsapp_messages" ON public.whatsapp_messages;
CREATE POLICY "Owner all whatsapp_messages" ON public.whatsapp_messages FOR ALL
  USING (public.is_member_of(owner_id) OR has_role(auth.uid(),'admin'))
  WITH CHECK (public.is_member_of(owner_id) OR has_role(auth.uid(),'admin'));

-- whatsapp_settings
DROP POLICY IF EXISTS "Owner all whatsapp_settings" ON public.whatsapp_settings;
CREATE POLICY "Owner all whatsapp_settings" ON public.whatsapp_settings FOR ALL
  USING (public.is_member_of(owner_id) OR has_role(auth.uid(),'admin'))
  WITH CHECK (public.is_member_of(owner_id) OR has_role(auth.uid(),'admin'));

-- =====================================================================
-- 7) Seed default permission catalog
-- =====================================================================
INSERT INTO public.permissions (key, label, category) VALUES
  -- المنتجات
  ('products.view', 'عرض المنتجات', 'المنتجات'),
  ('products.add', 'إضافة منتج', 'المنتجات'),
  ('products.edit', 'تعديل منتج', 'المنتجات'),
  ('products.edit_price', 'تعديل سعر البيع', 'المنتجات'),
  ('products.edit_purchase_price', 'تعديل سعر الشراء', 'المنتجات'),
  ('products.delete', 'حذف منتج', 'المنتجات'),
  -- المخزون
  ('stock.view', 'عرض المخزون', 'المخزون'),
  ('stock.add', 'إضافة كميات', 'المخزون'),
  ('stock.remove', 'سحب كميات', 'المخزون'),
  -- الخزائن
  ('safes.view', 'عرض الخزائن', 'الخزائن'),
  ('safes.create', 'إنشاء خزينة', 'الخزائن'),
  ('safes.deposit', 'إيداع في خزينة', 'الخزائن'),
  ('safes.withdraw', 'سحب من خزينة', 'الخزائن'),
  ('safes.transfer', 'تحويل بين الخزائن', 'الخزائن'),
  -- الطلبيات
  ('orders.view', 'عرض الطلبيات', 'الطلبيات'),
  ('orders.edit', 'تعديل طلب', 'الطلبيات'),
  ('orders.delete', 'حذف طلب', 'الطلبيات'),
  ('orders.confirm', 'تأكيد طلب', 'الطلبيات'),
  ('orders.ship', 'شحن طلب', 'الطلبيات'),
  -- المصروفات والمشتريات
  ('expenses.view', 'عرض المصروفات', 'المالية'),
  ('expenses.add', 'إضافة مصروف', 'المالية'),
  ('purchases.view', 'عرض المشتريات', 'المالية'),
  ('purchases.add', 'إضافة مشترى', 'المالية'),
  -- الإعدادات
  ('settings.pixel', 'إعدادات البيكسل', 'الإعدادات'),
  ('settings.order_form', 'نموذج الطلب', 'الإعدادات'),
  ('settings.header', 'هيدر المتجر', 'الإعدادات'),
  ('settings.thank_you', 'صفحة الشكر', 'الإعدادات'),
  ('settings.currency', 'العملة', 'الإعدادات'),
  ('settings.shipping', 'إعدادات الشحن', 'الإعدادات'),
  ('settings.whatsapp', 'إعدادات WhatsApp', 'الإعدادات'),
  ('settings.sticker', 'تصميم ستيكر الشحن', 'الإعدادات'),
  -- المستخدمون الفرعيون
  ('members.manage', 'إدارة المستخدمين الفرعيين', 'المستخدمون')
ON CONFLICT (key) DO NOTHING;