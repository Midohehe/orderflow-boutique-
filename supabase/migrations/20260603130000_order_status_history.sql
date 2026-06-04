-- Phase 1: order status history for SLA / dwell-time analytics

CREATE TABLE IF NOT EXISTS public.order_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL,
  store_id uuid REFERENCES public.stores(id) ON DELETE SET NULL,
  field_name text NOT NULL CHECK (field_name IN ('status', 'confirmation_status', 'prep_status')),
  from_value text,
  to_value text NOT NULL,
  changed_at timestamptz NOT NULL DEFAULT now(),
  source text NOT NULL DEFAULT 'system'
);

CREATE INDEX IF NOT EXISTS idx_order_status_history_order
  ON public.order_status_history (order_id, changed_at DESC);

CREATE INDEX IF NOT EXISTS idx_order_status_history_store_field
  ON public.order_status_history (store_id, field_name, changed_at DESC);

ALTER TABLE public.order_status_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "order_status_history_select"
  ON public.order_status_history FOR SELECT
  USING (is_member_of(owner_id) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "order_status_history_insert"
  ON public.order_status_history FOR INSERT
  WITH CHECK (is_member_of(owner_id) OR has_role(auth.uid(), 'admin'::app_role));

CREATE OR REPLACE FUNCTION public.log_order_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      INSERT INTO public.order_status_history (order_id, owner_id, store_id, field_name, from_value, to_value, source)
      VALUES (NEW.id, NEW.owner_id, NEW.store_id, 'status', OLD.status, NEW.status, 'db_trigger');
    END IF;
    IF NEW.confirmation_status IS DISTINCT FROM OLD.confirmation_status THEN
      INSERT INTO public.order_status_history (order_id, owner_id, store_id, field_name, from_value, to_value, source)
      VALUES (NEW.id, NEW.owner_id, NEW.store_id, 'confirmation_status', OLD.confirmation_status, NEW.confirmation_status, 'db_trigger');
    END IF;
    IF NEW.prep_status IS DISTINCT FROM OLD.prep_status THEN
      INSERT INTO public.order_status_history (order_id, owner_id, store_id, field_name, from_value, to_value, source)
      VALUES (NEW.id, NEW.owner_id, NEW.store_id, 'prep_status', OLD.prep_status, NEW.prep_status, 'db_trigger');
    END IF;
  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO public.order_status_history (order_id, owner_id, store_id, field_name, from_value, to_value, source)
    VALUES (NEW.id, NEW.owner_id, NEW.store_id, 'status', NULL, NEW.status, 'db_trigger');
    IF NEW.confirmation_status IS NOT NULL THEN
      INSERT INTO public.order_status_history (order_id, owner_id, store_id, field_name, from_value, to_value, source)
      VALUES (NEW.id, NEW.owner_id, NEW.store_id, 'confirmation_status', NULL, NEW.confirmation_status, 'db_trigger');
    END IF;
    IF NEW.prep_status IS NOT NULL THEN
      INSERT INTO public.order_status_history (order_id, owner_id, store_id, field_name, from_value, to_value, source)
      VALUES (NEW.id, NEW.owner_id, NEW.store_id, 'prep_status', NULL, NEW.prep_status, 'db_trigger');
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_order_status_change ON public.orders;
CREATE TRIGGER trg_log_order_status_change
  AFTER INSERT OR UPDATE OF status, confirmation_status, prep_status ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.log_order_status_change();

-- Average dwell time per status (for shipping KPI dashboard)
CREATE OR REPLACE FUNCTION public.order_status_dwell_report(_store_id uuid, _from date, _to date)
RETURNS TABLE(
  to_status text,
  transition_count bigint,
  avg_hours numeric,
  max_hours numeric
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH transitions AS (
    SELECT
      h.to_value,
      EXTRACT(EPOCH FROM (
        LEAD(h.changed_at) OVER (PARTITION BY h.order_id, h.field_name ORDER BY h.changed_at)
        - h.changed_at
      )) / 3600.0 AS hours_in_status
    FROM public.order_status_history h
    WHERE h.field_name = 'status'
      AND is_member_of(h.owner_id)
      AND (_store_id IS NULL OR h.store_id = _store_id)
      AND h.changed_at::date BETWEEN _from AND _to
  )
  SELECT
    to_value,
    COUNT(*)::bigint,
    ROUND(COALESCE(AVG(hours_in_status), 0)::numeric, 1),
    ROUND(COALESCE(MAX(hours_in_status), 0)::numeric, 1)
  FROM transitions
  WHERE hours_in_status IS NOT NULL AND hours_in_status >= 0
  GROUP BY to_value
  ORDER BY 2 DESC;
$$;
