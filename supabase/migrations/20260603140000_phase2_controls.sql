-- Phase 2: shipping/finance controls

-- 1) Auto-deliver on carrier DTR* codes (per store, default on)
ALTER TABLE public.shipping_settings
  ADD COLUMN IF NOT EXISTS auto_mark_delivered boolean NOT NULL DEFAULT true;

-- 2) Optional allow negative safe balance per safe
ALTER TABLE public.safes
  ADD COLUMN IF NOT EXISTS allow_negative_balance boolean NOT NULL DEFAULT false;

-- 3) Prevent safe overdraft unless explicitly allowed
CREATE OR REPLACE FUNCTION public.validate_safe_movement_balance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _current numeric;
  _allow boolean;
  _projected numeric;
BEGIN
  SELECT balance, allow_negative_balance INTO _current, _allow
  FROM public.safes WHERE id = NEW.safe_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'الخزينة غير موجودة';
  END IF;

  IF TG_OP = 'INSERT' THEN
    _projected := COALESCE(_current, 0) + NEW.amount;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.safe_id = OLD.safe_id THEN
      _projected := COALESCE(_current, 0) + (NEW.amount - OLD.amount);
    ELSE
      -- Old safe restored by sync trigger; validate new safe only
      _projected := COALESCE(_current, 0) + NEW.amount;
    END IF;
  ELSE
    RETURN NEW;
  END IF;

  IF NOT _allow AND _projected < 0 THEN
    RAISE EXCEPTION 'رصيد الخزينة غير كافٍ (الرصيد الحالي: %، المطلوب: %)', COALESCE(_current, 0), ABS(NEW.amount);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_safe_movement_balance ON public.safe_movements;
CREATE TRIGGER trg_validate_safe_movement_balance
  BEFORE INSERT OR UPDATE ON public.safe_movements
  FOR EACH ROW EXECUTE FUNCTION public.validate_safe_movement_balance();

-- 4) Order status transition guard
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

  -- Terminal states cannot change (except settled -> delivered for reversal)
  IF OLD.status IN ('unpacked', 'returned_received') THEN
    RAISE EXCEPTION 'لا يمكن تغيير حالة الطلب من %', OLD.status;
  END IF;

  allowed := CASE
    WHEN OLD.status = 'pending' AND NEW.status IN ('shipped', 'cancelled', 'delivered', 'processing') THEN true
    WHEN OLD.status = 'processing' AND NEW.status IN ('pending', 'shipped', 'cancelled') THEN true
    WHEN OLD.status = 'shipped' AND NEW.status IN ('delivered', 'cancelled', 'unpacked', 'returned_received') THEN true
    WHEN OLD.status = 'delivered' AND NEW.status IN ('settled', 'returned_received', 'cancelled') THEN true
    WHEN OLD.status = 'settled' AND NEW.status = 'delivered' THEN true
    WHEN OLD.status = 'cancelled' AND NEW.status = 'pending' THEN true
    ELSE false
  END;

  IF NOT allowed THEN
    RAISE EXCEPTION 'انتقال حالة غير مسموح: % → %', OLD.status, NEW.status;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_order_status ON public.orders;
CREATE TRIGGER trg_validate_order_status
  BEFORE UPDATE OF status ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.validate_order_status_transition();

-- 5) Internal settlement: only delivered, unsettled orders
CREATE OR REPLACE FUNCTION public.settle_orders_into_safe(
  _order_ids uuid[],
  _safe_id uuid,
  _amount numeric,
  _notes text DEFAULT NULL
) RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _owner uuid := get_effective_owner_id(auth.uid());
  _safe_owner uuid;
  _updated int;
  _invalid int;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'unauthorized');
  END IF;
  IF _order_ids IS NULL OR array_length(_order_ids, 1) IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'no_orders');
  END IF;

  SELECT owner_id INTO _safe_owner FROM public.safes WHERE id = _safe_id;
  IF _safe_owner IS NULL OR NOT is_member_of(_safe_owner) THEN
    RETURN json_build_object('success', false, 'error', 'invalid_safe');
  END IF;

  SELECT COUNT(*) INTO _invalid
  FROM public.orders
  WHERE id = ANY(_order_ids)
    AND is_member_of(owner_id)
    AND (status <> 'delivered' OR settlement_received = true);

  IF _invalid > 0 THEN
    RETURN json_build_object(
      'success', false,
      'error', 'يجب أن تكون الطلبات بحالة «تم الاستلام» وغير مسددة مسبقاً'
    );
  END IF;

  UPDATE public.orders
    SET status = 'settled',
        settlement_received = true,
        settlement_received_at = now(),
        updated_at = now()
    WHERE id = ANY(_order_ids)
      AND is_member_of(owner_id)
      AND status = 'delivered'
      AND settlement_received = false;
  GET DIAGNOSTICS _updated = ROW_COUNT;

  IF _updated = 0 THEN
    RETURN json_build_object('success', false, 'error', 'لم يتم تحديث أي طلب');
  END IF;

  INSERT INTO public.safe_movements (safe_id, amount, movement_type, notes, owner_id, store_id)
  SELECT _safe_id, _amount, 'deposit',
         COALESCE(_notes, 'تسوية ' || _updated || ' طلب'),
         _safe_owner,
         (SELECT store_id FROM public.safes WHERE id = _safe_id);

  RETURN json_build_object('success', true, 'updated', _updated);
END;
$$;
