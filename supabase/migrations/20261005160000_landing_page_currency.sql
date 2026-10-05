-- Existing pages inherit store currency; historical orders keep their legacy behavior.
ALTER TABLE public.landing_pages ADD COLUMN currency_code text;
ALTER TABLE public.landing_pages ADD CONSTRAINT landing_pages_currency_code_check
  CHECK (currency_code IS NULL OR currency_code IN ('AED', 'SAR', 'EGP', 'KWD', 'BHD', 'QAR', 'OMR', 'JOD', 'LBP', 'IQD', 'SYP', 'YER', 'LYD', 'TND', 'DZD', 'MAD', 'SDG', 'USD', 'EUR', 'GBP', 'TRY', 'INR'));
COMMENT ON COLUMN public.landing_pages.currency_code IS 'NULL inherits store currency. Explicit currency denominates page prices without FX conversion.';

ALTER TABLE public.orders ADD COLUMN currency_code text;
ALTER TABLE public.orders ADD CONSTRAINT orders_currency_code_check
  CHECK (currency_code IS NULL OR currency_code IN ('AED', 'SAR', 'EGP', 'KWD', 'BHD', 'QAR', 'OMR', 'JOD', 'LBP', 'IQD', 'SYP', 'YER', 'LYD', 'TND', 'DZD', 'MAD', 'SDG', 'USD', 'EUR', 'GBP', 'TRY', 'INR'));
COMMENT ON COLUMN public.orders.currency_code IS 'Currency snapshot at public checkout; NULL for legacy orders.';
NOTIFY pgrst, 'reload schema';
