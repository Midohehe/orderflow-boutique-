-- Rename platform from legacy demo seed to current product branding.
UPDATE public.app_settings
SET system_name = 'منصة وصلة', updated_at = now()
WHERE system_name = 'عدسات ميار';

ALTER TABLE public.app_settings
  ALTER COLUMN system_name SET DEFAULT 'منصة وصلة';
