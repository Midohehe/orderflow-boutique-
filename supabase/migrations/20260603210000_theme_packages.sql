-- Advanced theme packages: custom CSS + package tracking on store_settings

ALTER TABLE public.store_settings
  ADD COLUMN IF NOT EXISTS theme_custom_css text,
  ADD COLUMN IF NOT EXISTS theme_package_id text,
  ADD COLUMN IF NOT EXISTS theme_config jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.store_settings.theme_custom_css IS 'Scoped CSS injected on public store/landing pages';
COMMENT ON COLUMN public.store_settings.theme_package_id IS 'Last applied built-in or imported theme package id';
COMMENT ON COLUMN public.store_settings.theme_config IS 'Extended theme options: fonts, buttonStyle, headerStyle, etc.';
