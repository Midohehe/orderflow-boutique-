-- Platform advertising configuration; existing app_settings RLS restricts writes to admins.
ALTER TABLE public.app_settings
  ADD COLUMN platform_facebook_pixel_id text
  CHECK (platform_facebook_pixel_id IS NULL OR platform_facebook_pixel_id ~ '^[0-9]{5,20}$');
