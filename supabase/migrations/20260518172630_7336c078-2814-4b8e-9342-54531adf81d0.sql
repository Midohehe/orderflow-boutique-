
-- Add a simple unified order code used everywhere (orders page, prep list, prep scanning)
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS order_code text;

-- Generator: 6-char uppercase alphanumeric (no confusing chars)
CREATE OR REPLACE FUNCTION public.generate_order_code()
RETURNS text
LANGUAGE plpgsql
SET search_path = public, extensions
AS $$
DECLARE
  _chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  _code text;
  _i int;
BEGIN
  LOOP
    _code := '';
    FOR _i IN 1..6 LOOP
      _code := _code || substr(_chars, 1 + floor(random() * length(_chars))::int, 1);
    END LOOP;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.orders WHERE order_code = _code);
  END LOOP;
  RETURN _code;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_order_code()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.order_code IS NULL OR NEW.order_code = '' THEN
    NEW.order_code := public.generate_order_code();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS orders_set_order_code ON public.orders;
CREATE TRIGGER orders_set_order_code
  BEFORE INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.set_order_code();

-- Backfill existing rows
UPDATE public.orders SET order_code = public.generate_order_code() WHERE order_code IS NULL OR order_code = '';

CREATE UNIQUE INDEX IF NOT EXISTS orders_order_code_unique ON public.orders(order_code);
