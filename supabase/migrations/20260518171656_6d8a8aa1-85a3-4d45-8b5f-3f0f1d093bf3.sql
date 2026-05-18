ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS prep_status text NOT NULL DEFAULT 'pending'
  CHECK (prep_status IN ('pending','preparing','prepared'));

-- Backfill from any orders that may have been set to preparing/prepared via main status
UPDATE public.orders SET prep_status = 'preparing' WHERE status = 'preparing' AND prep_status = 'pending';
UPDATE public.orders SET prep_status = 'prepared' WHERE status = 'prepared' AND prep_status = 'pending';
-- Reset their main status back to pending so they show in pending tab
UPDATE public.orders SET status = 'pending' WHERE status IN ('preparing','prepared');

CREATE INDEX IF NOT EXISTS idx_orders_prep_status ON public.orders(prep_status);