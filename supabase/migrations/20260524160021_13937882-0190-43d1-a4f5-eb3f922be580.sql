ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_status_check
  CHECK (status = ANY (ARRAY['pending'::text, 'processing'::text, 'preparing'::text, 'prepared'::text, 'shipped'::text, 'delivered'::text, 'cancelled'::text, 'unpacked'::text, 'returned_received'::text, 'settled'::text]));