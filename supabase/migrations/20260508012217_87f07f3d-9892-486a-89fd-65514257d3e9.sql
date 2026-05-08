
-- Settlements (financial settlements from shipping company)
CREATE TABLE public.settlements (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id uuid NOT NULL,
  external_id bigint NOT NULL,
  code text NOT NULL,
  settlement_date timestamptz,
  payment_amount numeric NOT NULL DEFAULT 0,
  due_fees numeric NOT NULL DEFAULT 0,
  delivered_amount numeric NOT NULL DEFAULT 0,
  pieces_count integer NOT NULL DEFAULT 0,
  shipment_count integer NOT NULL DEFAULT 0,
  customer_name text,
  safe_name text,
  transaction_type text,
  notes text,
  approved boolean NOT NULL DEFAULT false,
  received boolean NOT NULL DEFAULT false,
  received_at timestamptz,
  raw jsonb,
  shipments_synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(owner_id, external_id)
);

ALTER TABLE public.settlements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner all settlements" ON public.settlements
FOR ALL TO public
USING ((auth.uid() = owner_id) OR has_role(auth.uid(), 'admin'::app_role))
WITH CHECK ((auth.uid() = owner_id) OR has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_settlements_updated_at
BEFORE UPDATE ON public.settlements
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Settlement shipments (rows inside a settlement)
CREATE TABLE public.settlement_shipments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id uuid NOT NULL,
  settlement_id uuid NOT NULL REFERENCES public.settlements(id) ON DELETE CASCADE,
  external_shipment_id bigint,
  shipment_code text NOT NULL,
  ref_number text,
  recipient_name text,
  recipient_phone text,
  zone_name text,
  area_name text,
  status_code text,
  status_name text,
  delivered_amount numeric NOT NULL DEFAULT 0,
  collected_fees numeric NOT NULL DEFAULT 0,
  paid_amount numeric NOT NULL DEFAULT 0,
  pieces_count integer NOT NULL DEFAULT 0,
  weight numeric NOT NULL DEFAULT 0,
  shipment_date timestamptz,
  delivered_or_returned_date timestamptz,
  order_id uuid,
  raw jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(settlement_id, shipment_code)
);

ALTER TABLE public.settlement_shipments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner all settlement_shipments" ON public.settlement_shipments
FOR ALL TO public
USING ((auth.uid() = owner_id) OR has_role(auth.uid(), 'admin'::app_role))
WITH CHECK ((auth.uid() = owner_id) OR has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_settlement_shipments_settlement ON public.settlement_shipments(settlement_id);
CREATE INDEX idx_settlement_shipments_order ON public.settlement_shipments(order_id);
CREATE INDEX idx_settlement_shipments_code ON public.settlement_shipments(shipment_code);

-- Mark order as received (settlement collected)
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS settlement_received boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS settlement_received_at timestamptz;
