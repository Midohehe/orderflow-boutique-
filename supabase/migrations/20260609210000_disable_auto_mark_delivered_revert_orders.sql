-- Stop auto-marking orders as delivered when carrier reports DTR*.
-- Allow reverting mistaken auto-delivered orders back to shipped.

ALTER TABLE public.shipping_settings
  ALTER COLUMN auto_mark_delivered SET DEFAULT false;

UPDATE public.shipping_settings
SET auto_mark_delivered = false
WHERE auto_mark_delivered = true;

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
    WHEN OLD.status = 'shipped' AND NEW.status IN ('delivered', 'cancelled', 'unpacked', 'returned_received') THEN true
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

-- Revert orders auto-marked delivered by carrier sync (not yet financially settled)
UPDATE public.orders
SET status = 'shipped',
    updated_at = now()
WHERE status = 'delivered'
  AND settlement_received = false
  AND is_deleted = false
  AND shipping_reference IS NOT NULL;
