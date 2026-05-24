-- Track unique reference codes for each settlement deposit and reversal cycle
ALTER TABLE public.settlements
  ADD COLUMN IF NOT EXISTS deposit_ref_id uuid,
  ADD COLUMN IF NOT EXISTS reversal_ref_id uuid;

-- Backfill existing received settlements so their deposit movement remains traceable
UPDATE public.settlements
  SET deposit_ref_id = id
  WHERE received = true AND deposit_ref_id IS NULL;