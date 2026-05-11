ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS carrier_cancellation_reason_id text,
ADD COLUMN IF NOT EXISTS carrier_notes text;