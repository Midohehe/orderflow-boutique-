CREATE OR REPLACE FUNCTION public.deduct_order_fee()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _fee numeric;
  _enabled boolean;
  _wallet_id uuid;
  _new_balance numeric;
BEGIN
  SELECT order_fee, wallet_enabled INTO _fee, _enabled FROM public.app_settings LIMIT 1;

  IF NOT COALESCE(_enabled, false) OR COALESCE(_fee, 0) <= 0 OR NEW.owner_id IS NULL THEN
    RETURN NEW;
  END IF;

  BEGIN
    PERFORM set_config('lock_timeout', '1000', true);

    INSERT INTO public.wallets (user_id, balance)
    VALUES (NEW.owner_id, 0)
    ON CONFLICT (user_id) DO NOTHING;

    SELECT id, balance
    INTO _wallet_id, _new_balance
    FROM public.wallets
    WHERE user_id = NEW.owner_id
    FOR UPDATE;

    IF _wallet_id IS NULL THEN
      RETURN NEW;
    END IF;

    UPDATE public.wallets
    SET balance = balance - _fee,
        updated_at = now()
    WHERE id = _wallet_id
    RETURNING balance INTO _new_balance;

    INSERT INTO public.wallet_transactions (wallet_id, user_id, amount, type, reference_id, notes)
    VALUES (_wallet_id, NEW.owner_id, -_fee, 'order_fee', NEW.id, 'رسوم طلب #' || substring(NEW.id::text, 1, 8));

    IF _new_balance < 0 THEN
      UPDATE public.orders
      SET locked_insufficient_balance = true
      WHERE id = NEW.id;
    END IF;
  EXCEPTION
    WHEN query_canceled OR lock_not_available OR deadlock_detected THEN
      RAISE WARNING 'deduct_order_fee skipped for order % بسبب تعليق مؤقت: %', NEW.id, SQLERRM;
      RETURN NEW;
    WHEN OTHERS THEN
      RAISE WARNING 'deduct_order_fee skipped for order % بسبب خطأ غير متوقع: %', NEW.id, SQLERRM;
      RETURN NEW;
  END;

  RETURN NEW;
END;
$$;