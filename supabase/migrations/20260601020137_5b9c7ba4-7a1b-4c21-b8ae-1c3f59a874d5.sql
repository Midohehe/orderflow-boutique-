
-- 1) Accounting periods table for period closing
CREATE TABLE public.accounting_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  store_id uuid REFERENCES public.stores(id) ON DELETE CASCADE,
  period_start date NOT NULL,
  period_end date NOT NULL,
  closed_at timestamptz NOT NULL DEFAULT now(),
  closed_by uuid,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT period_valid CHECK (period_end >= period_start)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.accounting_periods TO authenticated;
GRANT ALL ON public.accounting_periods TO service_role;

ALTER TABLE public.accounting_periods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members can view periods" ON public.accounting_periods
  FOR SELECT TO authenticated USING (public.has_store_or_legacy(owner_id, store_id));
CREATE POLICY "members can manage periods" ON public.accounting_periods
  FOR ALL TO authenticated
  USING (public.has_store_or_legacy(owner_id, store_id))
  WITH CHECK (public.has_store_or_legacy(owner_id, store_id));

CREATE INDEX idx_acct_periods_store ON public.accounting_periods(store_id, period_start, period_end);

-- 2) Block changes to safe_movements inside a closed period
CREATE OR REPLACE FUNCTION public.block_in_closed_period()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _d date;
  _store uuid;
  _owner uuid;
BEGIN
  IF has_role(auth.uid(), 'admin') THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  IF TG_OP = 'DELETE' THEN
    _d := (OLD.created_at)::date; _store := OLD.store_id; _owner := OLD.owner_id;
  ELSE
    _d := (COALESCE(NEW.created_at, now()))::date; _store := NEW.store_id; _owner := NEW.owner_id;
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.accounting_periods ap
    WHERE ap.owner_id = _owner
      AND (ap.store_id IS NULL OR ap.store_id = _store)
      AND _d BETWEEN ap.period_start AND ap.period_end
  ) THEN
    RAISE EXCEPTION 'الفترة المحاسبية مغلقة — لا يمكن التعديل على حركات قبل تاريخ %', _d;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_block_closed_safe_movements ON public.safe_movements;
CREATE TRIGGER trg_block_closed_safe_movements
  BEFORE INSERT OR UPDATE OR DELETE ON public.safe_movements
  FOR EACH ROW EXECUTE FUNCTION public.block_in_closed_period();

-- 3) Return refund: when order becomes returned_received, deduct from default safe
CREATE OR REPLACE FUNCTION public.handle_order_return_refund()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _safe_id uuid;
BEGIN
  IF NEW.status = 'returned_received' AND COALESCE(OLD.status,'') <> 'returned_received' THEN
    -- Only reverse if previously settled (money was deposited)
    IF COALESCE(OLD.settlement_received, false) = true THEN
      SELECT id INTO _safe_id FROM public.safes
        WHERE owner_id = NEW.owner_id
          AND (store_id IS NULL OR store_id = NEW.store_id)
        ORDER BY (store_id = NEW.store_id) DESC, created_at
        LIMIT 1;
      IF _safe_id IS NOT NULL THEN
        INSERT INTO public.safe_movements(safe_id, amount, movement_type, notes, owner_id, store_id, reference_id)
          VALUES (_safe_id, -COALESCE(NEW.price,0), 'return_refund',
                  'مرتجع طلب ' || COALESCE(NEW.order_code, substring(NEW.id::text,1,8)),
                  NEW.owner_id, NEW.store_id, NEW.id::text);
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_order_return_refund ON public.orders;
CREATE TRIGGER trg_order_return_refund
  AFTER UPDATE OF status ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.handle_order_return_refund();

-- 4) P&L view-like RPC
CREATE OR REPLACE FUNCTION public.profit_loss_report(_store_id uuid, _from date, _to date)
RETURNS json LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _owner uuid := get_effective_owner_id(auth.uid());
  _revenue numeric := 0;
  _cogs numeric := 0;
  _expenses numeric := 0;
  _purchases numeric := 0;
  _returns numeric := 0;
  _orders_count int := 0;
  _delivered_count int := 0;
BEGIN
  IF auth.uid() IS NULL THEN RETURN json_build_object('error','unauthorized'); END IF;

  SELECT COALESCE(SUM(price),0), COUNT(*)
    INTO _revenue, _delivered_count
    FROM public.orders
    WHERE is_member_of(owner_id)
      AND (_store_id IS NULL OR store_id = _store_id)
      AND status = 'delivered'
      AND created_at::date BETWEEN _from AND _to;

  SELECT COALESCE(SUM(oi.quantity * COALESCE(oi.purchase_price_snapshot, 0)), 0)
    INTO _cogs
    FROM public.order_items oi
    JOIN public.orders o ON o.id = oi.order_id
    WHERE is_member_of(o.owner_id)
      AND (_store_id IS NULL OR o.store_id = _store_id)
      AND o.status = 'delivered'
      AND o.created_at::date BETWEEN _from AND _to;

  SELECT COALESCE(SUM(amount),0) INTO _expenses
    FROM public.expenses
    WHERE is_member_of(owner_id)
      AND (_store_id IS NULL OR store_id = _store_id)
      AND created_at::date BETWEEN _from AND _to;

  SELECT COALESCE(SUM(amount),0) INTO _purchases
    FROM public.purchases
    WHERE is_member_of(owner_id)
      AND (_store_id IS NULL OR store_id = _store_id)
      AND created_at::date BETWEEN _from AND _to;

  SELECT COALESCE(SUM(ABS(amount)),0) INTO _returns
    FROM public.safe_movements
    WHERE is_member_of(owner_id)
      AND (_store_id IS NULL OR store_id = _store_id)
      AND movement_type = 'return_refund'
      AND created_at::date BETWEEN _from AND _to;

  SELECT COUNT(*) INTO _orders_count
    FROM public.orders
    WHERE is_member_of(owner_id)
      AND (_store_id IS NULL OR store_id = _store_id)
      AND created_at::date BETWEEN _from AND _to;

  RETURN json_build_object(
    'revenue', _revenue,
    'cogs', _cogs,
    'gross_profit', _revenue - _cogs,
    'expenses', _expenses,
    'purchases', _purchases,
    'returns_refunded', _returns,
    'net_profit', _revenue - _cogs - _expenses - _returns,
    'orders_count', _orders_count,
    'delivered_count', _delivered_count
  );
END;
$$;

-- 5) Cash flow grouped by movement_type
CREATE OR REPLACE FUNCTION public.cash_flow_report(_store_id uuid, _from date, _to date)
RETURNS TABLE(movement_type text, total numeric, count_movements int) 
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(sm.movement_type, 'other')::text,
         COALESCE(SUM(sm.amount),0),
         COUNT(*)::int
  FROM public.safe_movements sm
  WHERE is_member_of(sm.owner_id)
    AND (_store_id IS NULL OR sm.store_id = _store_id)
    AND sm.created_at::date BETWEEN _from AND _to
  GROUP BY sm.movement_type
  ORDER BY 2 DESC;
$$;
