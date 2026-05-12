ALTER TABLE public.carrier_status_mappings
ADD COLUMN IF NOT EXISTS category TEXT;

COMMENT ON COLUMN public.carrier_status_mappings.category IS 'Used for delivery-rate metrics. One of: delivered, returned, in_progress, or NULL (excluded).';