CREATE TABLE public.returns (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id uuid NOT NULL,
  external_id bigint NOT NULL,
  code text NOT NULL,
  return_date timestamp with time zone,
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
  received_at timestamp with time zone,
  shipments_synced_at timestamp with time zone,
  raw jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (owner_id, external_id)
);

ALTER TABLE public.returns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner all returns" ON public.returns
  FOR ALL USING ((auth.uid() = owner_id) OR has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK ((auth.uid() = owner_id) OR has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_returns_updated_at
  BEFORE UPDATE ON public.returns
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.return_shipments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id uuid NOT NULL,
  return_id uuid NOT NULL,
  shipment_code text NOT NULL,
  external_shipment_id bigint,
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
  shipment_date timestamp with time zone,
  delivered_or_returned_date timestamp with time zone,
  order_id uuid,
  raw jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.return_shipments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner all return_shipments" ON public.return_shipments
  FOR ALL USING ((auth.uid() = owner_id) OR has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK ((auth.uid() = owner_id) OR has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_return_shipments_return_id ON public.return_shipments(return_id);