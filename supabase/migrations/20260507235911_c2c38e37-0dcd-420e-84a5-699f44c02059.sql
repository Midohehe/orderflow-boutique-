CREATE TABLE public.hidden_default_carrier_codes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id uuid NOT NULL,
  status_code text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (owner_id, status_code)
);

ALTER TABLE public.hidden_default_carrier_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner read hidden_default_carrier_codes"
ON public.hidden_default_carrier_codes
FOR SELECT
USING ((auth.uid() = owner_id) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Owner insert hidden_default_carrier_codes"
ON public.hidden_default_carrier_codes
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Owner delete hidden_default_carrier_codes"
ON public.hidden_default_carrier_codes
FOR DELETE
TO authenticated
USING ((auth.uid() = owner_id) OR has_role(auth.uid(), 'admin'::app_role));