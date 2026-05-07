
-- =====================================================
-- 1. ROLES
-- =====================================================
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "Users read own roles" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin manage roles" ON public.user_roles
  FOR ALL USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- =====================================================
-- 2. PROFILES (username + subscription)
-- =====================================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT NOT NULL UNIQUE,
  full_name TEXT,
  subscription_starts_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  subscription_ends_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read profiles" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "User update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Admin manage profiles" ON public.profiles
  FOR ALL USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.is_subscription_active(_user_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = _user_id
      AND is_active = true
      AND (subscription_ends_at IS NULL OR subscription_ends_at > now())
  ) OR public.has_role(_user_id, 'admin')
$$;

-- =====================================================
-- 3. ASSIGN CURRENT USER AS ADMIN + create profile
-- =====================================================
INSERT INTO public.user_roles (user_id, role)
VALUES ('8d7d67e4-7813-459c-8061-bd1b6dc0a6bd', 'admin');

INSERT INTO public.profiles (user_id, username, full_name, subscription_ends_at)
VALUES ('8d7d67e4-7813-459c-8061-bd1b6dc0a6bd', 'admin', 'Admin', NULL);

-- =====================================================
-- 4. ADD owner_id TO ALL TABLES
-- =====================================================
ALTER TABLE public.products       ADD COLUMN owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.orders         ADD COLUMN owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.purchases      ADD COLUMN owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.shipping_settings ADD COLUMN owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.shipping_zones ADD COLUMN owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.header_settings ADD COLUMN owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.store_settings  ADD COLUMN owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.pixel_settings  ADD COLUMN owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.order_form_fields ADD COLUMN owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.analytics_events ADD COLUMN owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- backfill all existing data to current admin
UPDATE public.products       SET owner_id = '8d7d67e4-7813-459c-8061-bd1b6dc0a6bd' WHERE owner_id IS NULL;
UPDATE public.orders         SET owner_id = '8d7d67e4-7813-459c-8061-bd1b6dc0a6bd' WHERE owner_id IS NULL;
UPDATE public.purchases      SET owner_id = '8d7d67e4-7813-459c-8061-bd1b6dc0a6bd' WHERE owner_id IS NULL;
UPDATE public.shipping_settings SET owner_id = '8d7d67e4-7813-459c-8061-bd1b6dc0a6bd' WHERE owner_id IS NULL;
UPDATE public.shipping_zones SET owner_id = '8d7d67e4-7813-459c-8061-bd1b6dc0a6bd' WHERE owner_id IS NULL;
UPDATE public.header_settings SET owner_id = '8d7d67e4-7813-459c-8061-bd1b6dc0a6bd' WHERE owner_id IS NULL;
UPDATE public.store_settings  SET owner_id = '8d7d67e4-7813-459c-8061-bd1b6dc0a6bd' WHERE owner_id IS NULL;
UPDATE public.pixel_settings  SET owner_id = '8d7d67e4-7813-459c-8061-bd1b6dc0a6bd' WHERE owner_id IS NULL;
UPDATE public.order_form_fields SET owner_id = '8d7d67e4-7813-459c-8061-bd1b6dc0a6bd' WHERE owner_id IS NULL;
UPDATE public.analytics_events SET owner_id = '8d7d67e4-7813-459c-8061-bd1b6dc0a6bd' WHERE owner_id IS NULL;

-- enforce NOT NULL going forward (analytics can stay nullable for legacy public events)
ALTER TABLE public.products       ALTER COLUMN owner_id SET NOT NULL;
ALTER TABLE public.orders         ALTER COLUMN owner_id SET NOT NULL;
ALTER TABLE public.purchases      ALTER COLUMN owner_id SET NOT NULL;
ALTER TABLE public.shipping_settings ALTER COLUMN owner_id SET NOT NULL;
ALTER TABLE public.shipping_zones ALTER COLUMN owner_id SET NOT NULL;
ALTER TABLE public.header_settings ALTER COLUMN owner_id SET NOT NULL;
ALTER TABLE public.store_settings  ALTER COLUMN owner_id SET NOT NULL;
ALTER TABLE public.pixel_settings  ALTER COLUMN owner_id SET NOT NULL;
ALTER TABLE public.order_form_fields ALTER COLUMN owner_id SET NOT NULL;

CREATE INDEX idx_products_owner ON public.products(owner_id);
CREATE INDEX idx_orders_owner ON public.orders(owner_id);
CREATE INDEX idx_purchases_owner ON public.purchases(owner_id);
CREATE INDEX idx_shipping_zones_owner ON public.shipping_zones(owner_id);
CREATE INDEX idx_analytics_owner ON public.analytics_events(owner_id);

-- =====================================================
-- 5. REPLACE RLS POLICIES (per-owner + admin)
-- =====================================================

-- PRODUCTS
DROP POLICY IF EXISTS "Products are viewable by everyone" ON public.products;
DROP POLICY IF EXISTS "Authenticated users can insert products" ON public.products;
DROP POLICY IF EXISTS "Authenticated users can update products" ON public.products;
DROP POLICY IF EXISTS "Authenticated users can delete products" ON public.products;
CREATE POLICY "Public read products" ON public.products FOR SELECT USING (true);
CREATE POLICY "Owner insert products" ON public.products FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Owner update products" ON public.products FOR UPDATE USING (auth.uid() = owner_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Owner delete products" ON public.products FOR DELETE USING (auth.uid() = owner_id OR public.has_role(auth.uid(), 'admin'));

-- ORDERS
DROP POLICY IF EXISTS "Authenticated users can read orders" ON public.orders;
DROP POLICY IF EXISTS "Authenticated users can update orders" ON public.orders;
DROP POLICY IF EXISTS "Authenticated users can delete orders" ON public.orders;
CREATE POLICY "Public insert orders" ON public.orders FOR INSERT WITH CHECK (true);
CREATE POLICY "Owner read orders" ON public.orders FOR SELECT USING (auth.uid() = owner_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Owner update orders" ON public.orders FOR UPDATE USING (auth.uid() = owner_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Owner delete orders" ON public.orders FOR DELETE USING (auth.uid() = owner_id OR public.has_role(auth.uid(), 'admin'));

-- PURCHASES
DROP POLICY IF EXISTS "Authenticated users can write purchases" ON public.purchases;
CREATE POLICY "Owner read purchases" ON public.purchases FOR SELECT USING (auth.uid() = owner_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Owner write purchases" ON public.purchases FOR ALL USING (auth.uid() = owner_id OR public.has_role(auth.uid(), 'admin')) WITH CHECK (auth.uid() = owner_id OR public.has_role(auth.uid(), 'admin'));

-- SHIPPING SETTINGS
DROP POLICY IF EXISTS "Authenticated read shipping_settings" ON public.shipping_settings;
DROP POLICY IF EXISTS "Authenticated write shipping_settings" ON public.shipping_settings;
CREATE POLICY "Owner all shipping_settings" ON public.shipping_settings FOR ALL USING (auth.uid() = owner_id OR public.has_role(auth.uid(), 'admin')) WITH CHECK (auth.uid() = owner_id OR public.has_role(auth.uid(), 'admin'));

-- SHIPPING ZONES
DROP POLICY IF EXISTS "Authenticated read zones" ON public.shipping_zones;
DROP POLICY IF EXISTS "Authenticated write zones" ON public.shipping_zones;
DROP POLICY IF EXISTS "Public can read shipping zones" ON public.shipping_zones;
CREATE POLICY "Owner read zones" ON public.shipping_zones FOR SELECT USING (auth.uid() = owner_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Owner write zones" ON public.shipping_zones FOR ALL USING (auth.uid() = owner_id OR public.has_role(auth.uid(), 'admin')) WITH CHECK (auth.uid() = owner_id OR public.has_role(auth.uid(), 'admin'));

-- HEADER SETTINGS
DROP POLICY IF EXISTS "Allow public read header_settings" ON public.header_settings;
DROP POLICY IF EXISTS "Authenticated users can write header_settings" ON public.header_settings;
CREATE POLICY "Public read header_settings" ON public.header_settings FOR SELECT USING (true);
CREATE POLICY "Owner write header_settings" ON public.header_settings FOR ALL USING (auth.uid() = owner_id OR public.has_role(auth.uid(), 'admin')) WITH CHECK (auth.uid() = owner_id OR public.has_role(auth.uid(), 'admin'));

-- STORE SETTINGS
DROP POLICY IF EXISTS "Allow public read store_settings" ON public.store_settings;
DROP POLICY IF EXISTS "Authenticated users can write store_settings" ON public.store_settings;
CREATE POLICY "Public read store_settings" ON public.store_settings FOR SELECT USING (true);
CREATE POLICY "Owner write store_settings" ON public.store_settings FOR ALL USING (auth.uid() = owner_id OR public.has_role(auth.uid(), 'admin')) WITH CHECK (auth.uid() = owner_id OR public.has_role(auth.uid(), 'admin'));

-- PIXEL SETTINGS
DROP POLICY IF EXISTS "Allow public read access" ON public.pixel_settings;
DROP POLICY IF EXISTS "Authenticated users can write pixel_settings" ON public.pixel_settings;
CREATE POLICY "Public read pixel_settings" ON public.pixel_settings FOR SELECT USING (true);
CREATE POLICY "Owner write pixel_settings" ON public.pixel_settings FOR ALL USING (auth.uid() = owner_id OR public.has_role(auth.uid(), 'admin')) WITH CHECK (auth.uid() = owner_id OR public.has_role(auth.uid(), 'admin'));

-- ORDER FORM FIELDS
DROP POLICY IF EXISTS "Allow public read order_form_fields" ON public.order_form_fields;
DROP POLICY IF EXISTS "Authenticated users can write order_form_fields" ON public.order_form_fields;
CREATE POLICY "Public read order_form_fields" ON public.order_form_fields FOR SELECT USING (true);
CREATE POLICY "Owner write order_form_fields" ON public.order_form_fields FOR ALL USING (auth.uid() = owner_id OR public.has_role(auth.uid(), 'admin')) WITH CHECK (auth.uid() = owner_id OR public.has_role(auth.uid(), 'admin'));

-- ANALYTICS (already has public insert; add owner-scoped read)
DROP POLICY IF EXISTS "Authenticated users can read analytics" ON public.analytics_events;
CREATE POLICY "Owner read analytics" ON public.analytics_events FOR SELECT USING (auth.uid() = owner_id OR public.has_role(auth.uid(), 'admin'));
