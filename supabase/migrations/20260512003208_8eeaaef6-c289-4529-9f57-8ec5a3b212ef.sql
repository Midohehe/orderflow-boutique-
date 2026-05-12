ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS confirmation_status text NOT NULL DEFAULT 'unconfirmed',
  ADD COLUMN IF NOT EXISTS confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS confirmed_by uuid,
  ADD COLUMN IF NOT EXISTS confirmation_notes text,
  ADD COLUMN IF NOT EXISTS confirmation_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS postponed_until timestamptz;

CREATE INDEX IF NOT EXISTS idx_orders_confirmation_status ON public.orders(confirmation_status);
CREATE INDEX IF NOT EXISTS idx_orders_owner_confirmation ON public.orders(owner_id, confirmation_status);

CREATE TABLE IF NOT EXISTS public.order_confirmation_attempts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id uuid NOT NULL,
  owner_id uuid NOT NULL,
  result text NOT NULL,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_oca_order ON public.order_confirmation_attempts(order_id);
CREATE INDEX IF NOT EXISTS idx_oca_owner ON public.order_confirmation_attempts(owner_id);

ALTER TABLE public.order_confirmation_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner all order_confirmation_attempts"
  ON public.order_confirmation_attempts
  FOR ALL
  USING ((auth.uid() = owner_id) OR has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK ((auth.uid() = owner_id) OR has_role(auth.uid(), 'admin'::app_role));