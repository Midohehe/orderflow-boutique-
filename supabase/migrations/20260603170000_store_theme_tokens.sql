-- Per-store visual theme tokens (colors, radius, font) for landing pages & storefront

ALTER TABLE public.store_settings
  ADD COLUMN IF NOT EXISTS theme_tokens jsonb NOT NULL DEFAULT '{
    "preset": "ocean",
    "primary": "217 91% 50%",
    "primaryForeground": "0 0% 100%",
    "accent": "217 91% 45%",
    "background": "220 20% 97%",
    "foreground": "222 47% 11%",
    "buttonRadius": "0.75rem",
    "fontFamily": "Cairo, system-ui, sans-serif"
  }'::jsonb;

COMMENT ON COLUMN public.store_settings.theme_tokens IS
  'CSS variable tokens for public store/landing pages (HSL components without hsl() wrapper).';
