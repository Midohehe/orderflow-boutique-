-- Carrier financial settlement confirms delivery; orders may stay "shipped"
-- when auto_mark_delivered is off (DTR no longer auto-flips to delivered).

CREATE OR REPLACE FUNCTION public.validate_order_status_transition()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  allowed boolean := false;
BEGIN
  IF TG_OP = 'INSERT' THEN
    RETURN NEW;
  END IF;

  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  IF OLD.status IN ('unpacked', 'returned_received') THEN
    RAISE EXCEPTION 'لا يمكن تغيير حالة الطلب من %', OLD.status;
  END IF;

  allowed := CASE
    WHEN OLD.status = 'pending' AND NEW.status IN ('shipped', 'cancelled', 'delivered', 'processing') THEN true
    WHEN OLD.status = 'processing' AND NEW.status IN ('pending', 'shipped', 'cancelled') THEN true
    WHEN OLD.status = 'shipped' AND NEW.status IN ('delivered', 'cancelled', 'unpacked', 'returned_received', 'settled') THEN true
    WHEN OLD.status = 'delivered' AND NEW.status IN ('settled', 'returned_received', 'cancelled', 'shipped') THEN true
    WHEN OLD.status = 'settled' AND NEW.status IN ('delivered', 'shipped') THEN true
    WHEN OLD.status = 'cancelled' AND NEW.status = 'pending' THEN true
    ELSE false
  END;

  IF NOT allowed THEN
    RAISE EXCEPTION 'انتقال حالة غير مسموح: % → %', OLD.status, NEW.status;
  END IF;

  RETURN NEW;
END;
$$;
