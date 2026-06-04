-- Phase 0: confirmation reminder index + P&L includes settled orders

DROP INDEX IF EXISTS public.idx_orders_pending_reminder;

CREATE INDEX IF NOT EXISTS idx_orders_unconfirmed_reminder
  ON public.orders (last_confirm_prompt_at)
  WHERE confirmation_status = 'unconfirmed' AND needs_manual_review = false;

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
      AND status IN ('delivered', 'settled')
      AND created_at::date BETWEEN _from AND _to;

  SELECT COALESCE(SUM(oi.quantity * COALESCE(oi.purchase_price_snapshot, 0)), 0)
    INTO _cogs
    FROM public.order_items oi
    JOIN public.orders o ON o.id = oi.order_id
    WHERE is_member_of(o.owner_id)
      AND (_store_id IS NULL OR o.store_id = _store_id)
      AND o.status IN ('delivered', 'settled')
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
