-- Fix Products table RLS policies
DROP POLICY IF EXISTS "Authenticated users can delete products" ON products;
DROP POLICY IF EXISTS "Authenticated users can insert products" ON products;
DROP POLICY IF EXISTS "Authenticated users can update products" ON products;

CREATE POLICY "Authenticated users can insert products" ON products 
FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update products" ON products 
FOR UPDATE USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete products" ON products 
FOR DELETE USING (auth.uid() IS NOT NULL);

-- Fix Orders table RLS policies - restrict read/write to authenticated users only
DROP POLICY IF EXISTS "Allow public read orders" ON orders;
DROP POLICY IF EXISTS "Allow public insert orders" ON orders;
DROP POLICY IF EXISTS "Allow public update orders" ON orders;
DROP POLICY IF EXISTS "Allow public delete orders" ON orders;

-- Allow public to insert orders (customers need to place orders without login)
CREATE POLICY "Public can insert orders" ON orders 
FOR INSERT WITH CHECK (true);

-- Only authenticated users (admins) can view orders
CREATE POLICY "Authenticated users can read orders" ON orders 
FOR SELECT USING (auth.uid() IS NOT NULL);

-- Only authenticated users (admins) can update orders
CREATE POLICY "Authenticated users can update orders" ON orders 
FOR UPDATE USING (auth.uid() IS NOT NULL);

-- Only authenticated users (admins) can delete orders
CREATE POLICY "Authenticated users can delete orders" ON orders 
FOR DELETE USING (auth.uid() IS NOT NULL);

-- Fix pixel_settings RLS
DROP POLICY IF EXISTS "Allow public write access" ON pixel_settings;

CREATE POLICY "Authenticated users can write pixel_settings" ON pixel_settings 
FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- Fix store_settings RLS
DROP POLICY IF EXISTS "Allow public write store_settings" ON store_settings;

CREATE POLICY "Authenticated users can write store_settings" ON store_settings 
FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- Fix order_form_fields RLS
DROP POLICY IF EXISTS "Allow public write order_form_fields" ON order_form_fields;

CREATE POLICY "Authenticated users can write order_form_fields" ON order_form_fields 
FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- Fix purchases RLS
DROP POLICY IF EXISTS "Allow public write purchases" ON purchases;

CREATE POLICY "Authenticated users can write purchases" ON purchases 
FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);