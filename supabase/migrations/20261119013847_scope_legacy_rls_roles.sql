-- Older policies defaulted to TO PUBLIC, which made Postgres evaluate
-- authenticated-only predicates for anon and internal platform roles.
-- Scope each policy to the roles that can actually satisfy or use it.

ALTER POLICY "Admin write app_settings" ON public.app_settings TO authenticated;
ALTER POLICY "Public read app_settings" ON public.app_settings TO anon, authenticated;

ALTER POLICY "Admin write catalog" ON public.form_field_catalog TO authenticated;
ALTER POLICY "Public read catalog" ON public.form_field_catalog TO anon, authenticated;

ALTER POLICY "Admin write group items" ON public.permission_group_items TO authenticated;
ALTER POLICY "Public read group items" ON public.permission_group_items TO anon, authenticated;

ALTER POLICY "Admin write perm groups" ON public.permission_groups TO authenticated;
ALTER POLICY "Public read perm groups" ON public.permission_groups TO anon, authenticated;

ALTER POLICY "Admin write permissions" ON public.permissions TO authenticated;
ALTER POLICY "Public read permissions" ON public.permissions TO anon, authenticated;

ALTER POLICY "Admin manage profiles" ON public.profiles TO authenticated;
ALTER POLICY "Owner read profiles" ON public.profiles TO authenticated;
ALTER POLICY "User update own profile" ON public.profiles TO authenticated;

ALTER POLICY "Admins manage cards" ON public.recharge_cards TO authenticated;
ALTER POLICY "Users read own redeemed cards" ON public.recharge_cards TO authenticated;

ALTER POLICY "Admin write shipping_error_aliases" ON public.shipping_error_aliases TO authenticated;
ALTER POLICY "Public read shipping_error_aliases" ON public.shipping_error_aliases TO anon, authenticated;

ALTER POLICY "Member read own perms" ON public.store_member_permissions TO authenticated;
ALTER POLICY "Owner manage member perms" ON public.store_member_permissions TO authenticated;

ALTER POLICY "Member read self" ON public.store_members TO authenticated;
ALTER POLICY "Owner manage store_members" ON public.store_members TO authenticated;

ALTER POLICY "Admins manage tx" ON public.wallet_transactions TO authenticated;
ALTER POLICY "Users read own tx" ON public.wallet_transactions TO authenticated;

ALTER POLICY "Admins manage wallets" ON public.wallets TO authenticated;
ALTER POLICY "Users read own wallet" ON public.wallets TO authenticated;

ALTER POLICY "Public read header_settings" ON public.header_settings TO anon, authenticated;
ALTER POLICY "Public read landing_page_templates" ON public.landing_page_templates TO anon, authenticated;
ALTER POLICY "Public read order_form_fields" ON public.order_form_fields TO anon, authenticated;
ALTER POLICY "Public read pixel_settings" ON public.pixel_settings TO anon, authenticated;
ALTER POLICY "public read published layouts" ON public.store_page_layouts TO anon, authenticated;
ALTER POLICY "Public read store_settings" ON public.store_settings TO anon, authenticated;
ALTER POLICY "Public read templates" ON public.store_themes TO anon, authenticated;
ALTER POLICY "Public read stores" ON public.stores TO anon, authenticated;
ALTER POLICY "Public read subscription plans" ON public.subscription_plans TO anon, authenticated;

-- This legacy policy is identical to store_assignment_read for authenticated
-- users. Its anon branch could never pass because auth.uid() is null.
DROP POLICY "Scoped read store_member_stores" ON public.store_member_stores;
