-- Customer-entered city/governorate (the "government" form field) is a distinct
-- value from the delivery zone stored in orders.city. Keep it in its own column
-- so both are recorded without one overriding the other.
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS governorate text;

COMMENT ON COLUMN public.orders.governorate IS
  'City/governorate entered by the customer in the order form (form field key "government"). Separate from city, which holds the delivery zone.';
