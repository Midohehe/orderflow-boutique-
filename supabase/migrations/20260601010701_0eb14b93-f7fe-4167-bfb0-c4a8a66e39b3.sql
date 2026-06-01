
-- =====================================================================
-- 1) إعادة احتساب أرصدة الخزائن (تصحيح bug الإيداع المضاعف)
-- =====================================================================
UPDATE public.safes s
SET balance = COALESCE((
  SELECT SUM(amount) FROM public.safe_movements WHERE safe_id = s.id
), 0);

-- =====================================================================
-- 2) Snapshot لسعر الشراء على order_items + auto-fill
-- =====================================================================
ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS purchase_price_snapshot numeric;

CREATE OR REPLACE FUNCTION public.set_order_item_purchase_snapshot()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.purchase_price_snapshot IS NULL AND NEW.product_id IS NOT NULL THEN
    SELECT purchase_price INTO NEW.purchase_price_snapshot
    FROM public.products WHERE id = NEW.product_id LIMIT 1;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_order_item_purchase_snapshot ON public.order_items;
CREATE TRIGGER trg_set_order_item_purchase_snapshot
  BEFORE INSERT ON public.order_items
  FOR EACH ROW EXECUTE FUNCTION public.set_order_item_purchase_snapshot();

-- backfill للسجلات القديمة
UPDATE public.order_items oi
SET purchase_price_snapshot = p.purchase_price
FROM public.products p
WHERE oi.product_id = p.id
  AND oi.purchase_price_snapshot IS NULL;

-- =====================================================================
-- 3) cod_collected على الطلب (نعم/لا/جزئي - null = غير محدد)
-- =====================================================================
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS cod_collected boolean,
  ADD COLUMN IF NOT EXISTS cod_amount_collected numeric;

-- =====================================================================
-- 4) جدول pending_order_fees (لاسترجاع الرسوم التي فشل خصمها)
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.pending_order_fees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL,
  owner_id uuid NOT NULL,
  fee numeric NOT NULL,
  reason text,
  resolved boolean NOT NULL DEFAULT false,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.pending_order_fees TO authenticated;
GRANT ALL ON public.pending_order_fees TO service_role;
ALTER TABLE public.pending_order_fees ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pending_order_fees admin read" ON public.pending_order_fees
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "pending_order_fees admin update" ON public.pending_order_fees
  FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'));

-- تحديث deduct_order_fee ليُسجّل الفشل
CREATE OR REPLACE FUNCTION public.deduct_order_fee()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
    INSERT INTO public.wallets (user_id, balance) VALUES (NEW.owner_id, 0)
      ON CONFLICT (user_id) DO NOTHING;
    SELECT id, balance INTO _wallet_id, _new_balance
      FROM public.wallets WHERE user_id = NEW.owner_id FOR UPDATE;
    IF _wallet_id IS NULL THEN
      INSERT INTO public.pending_order_fees(order_id, owner_id, fee, reason)
        VALUES (NEW.id, NEW.owner_id, _fee, 'wallet_missing');
      RETURN NEW;
    END IF;

    UPDATE public.wallets SET balance = balance - _fee, updated_at = now()
      WHERE id = _wallet_id RETURNING balance INTO _new_balance;

    INSERT INTO public.wallet_transactions (wallet_id, user_id, amount, type, reference_id, notes)
      VALUES (_wallet_id, NEW.owner_id, -_fee, 'order_fee', NEW.id, 'رسوم طلب #' || substring(NEW.id::text, 1, 8));

    IF _new_balance < 0 THEN
      UPDATE public.orders SET locked_insufficient_balance = true WHERE id = NEW.id;
    END IF;
  EXCEPTION
    WHEN query_canceled OR lock_not_available OR deadlock_detected THEN
      INSERT INTO public.pending_order_fees(order_id, owner_id, fee, reason)
        VALUES (NEW.id, NEW.owner_id, _fee, 'lock_conflict: ' || SQLERRM);
      RETURN NEW;
    WHEN OTHERS THEN
      INSERT INTO public.pending_order_fees(order_id, owner_id, fee, reason)
        VALUES (NEW.id, NEW.owner_id, _fee, 'error: ' || SQLERRM);
      RETURN NEW;
  END;
  RETURN NEW;
END;
$$;

-- =====================================================================
-- 5) Audit log مالي + triggers
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.financial_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  owner_id uuid,
  table_name text NOT NULL,
  row_id text,
  action text NOT NULL, -- INSERT/UPDATE/DELETE
  old_value jsonb,
  new_value jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.financial_audit_log TO authenticated;
GRANT ALL ON public.financial_audit_log TO service_role;
ALTER TABLE public.financial_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit_log owner read" ON public.financial_audit_log
  FOR SELECT TO authenticated USING (is_member_of(owner_id) OR has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_audit_owner_created ON public.financial_audit_log(owner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_table_row ON public.financial_audit_log(table_name, row_id);

CREATE OR REPLACE FUNCTION public.log_financial_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _row_id text;
  _owner uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    _row_id := COALESCE((to_jsonb(OLD)->>'id'), '');
    _owner := (to_jsonb(OLD)->>'owner_id')::uuid;
    INSERT INTO public.financial_audit_log(user_id, owner_id, table_name, row_id, action, old_value)
      VALUES (auth.uid(), _owner, TG_TABLE_NAME, _row_id, 'DELETE', to_jsonb(OLD));
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    _row_id := COALESCE((to_jsonb(NEW)->>'id'), '');
    _owner := (to_jsonb(NEW)->>'owner_id')::uuid;
    INSERT INTO public.financial_audit_log(user_id, owner_id, table_name, row_id, action, old_value, new_value)
      VALUES (auth.uid(), _owner, TG_TABLE_NAME, _row_id, 'UPDATE', to_jsonb(OLD), to_jsonb(NEW));
    RETURN NEW;
  ELSE
    _row_id := COALESCE((to_jsonb(NEW)->>'id'), '');
    _owner := (to_jsonb(NEW)->>'owner_id')::uuid;
    INSERT INTO public.financial_audit_log(user_id, owner_id, table_name, row_id, action, new_value)
      VALUES (auth.uid(), _owner, TG_TABLE_NAME, _row_id, 'INSERT', to_jsonb(NEW));
    RETURN NEW;
  END IF;
END;
$$;

DO $$
DECLARE _t text;
BEGIN
  FOREACH _t IN ARRAY ARRAY['expenses','purchases','safe_movements','safes','settlements','wallet_transactions'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_audit_%I ON public.%I', _t, _t);
    EXECUTE format(
      'CREATE TRIGGER trg_audit_%I AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.log_financial_change()',
      _t, _t
    );
  END LOOP;
END $$;

-- =====================================================================
-- 6) منع حذف safe_movements بعد 24 ساعة
-- =====================================================================
CREATE OR REPLACE FUNCTION public.prevent_old_safe_movement_delete()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT has_role(auth.uid(), 'admin') THEN
    IF OLD.created_at < now() - interval '24 hours' THEN
      RAISE EXCEPTION 'لا يمكن حذف حركة خزينة مرّ عليها أكثر من 24 ساعة. أضف قيداً معاكساً بدلاً من الحذف.';
    END IF;
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_old_safe_movement_delete ON public.safe_movements;
CREATE TRIGGER trg_prevent_old_safe_movement_delete
  BEFORE DELETE ON public.safe_movements
  FOR EACH ROW EXECUTE FUNCTION public.prevent_old_safe_movement_delete();

-- =====================================================================
-- 7) دالة تسوية ذرية (Atomic settle)
-- =====================================================================
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
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'unauthorized');
  END IF;
  IF _order_ids IS NULL OR array_length(_order_ids,1) IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'no_orders');
  END IF;

  SELECT owner_id INTO _safe_owner FROM public.safes WHERE id = _safe_id;
  IF _safe_owner IS NULL OR NOT is_member_of(_safe_owner) THEN
    RETURN json_build_object('success', false, 'error', 'invalid_safe');
  END IF;

  -- تحديث حالة الطلبات
  UPDATE public.orders
    SET status = 'settled',
        settlement_received = true,
        settlement_received_at = now(),
        updated_at = now()
    WHERE id = ANY(_order_ids)
      AND is_member_of(owner_id);
  GET DIAGNOSTICS _updated = ROW_COUNT;

  IF _updated = 0 THEN
    RAISE EXCEPTION 'لم يتم تحديث أي طلب — تحقق من الصلاحيات';
  END IF;

  -- إيداع المبلغ في الخزينة (trigger sync_safe_balance يضبط الرصيد)
  INSERT INTO public.safe_movements (safe_id, amount, movement_type, notes, owner_id, store_id)
  SELECT _safe_id, _amount, 'settlement',
         COALESCE(_notes, 'تسوية ' || _updated || ' طلب'),
         _safe_owner,
         (SELECT store_id FROM public.safes WHERE id = _safe_id);

  RETURN json_build_object('success', true, 'updated', _updated);
END;
$$;

GRANT EXECUTE ON FUNCTION public.settle_orders_into_safe(uuid[], uuid, numeric, text) TO authenticated;
