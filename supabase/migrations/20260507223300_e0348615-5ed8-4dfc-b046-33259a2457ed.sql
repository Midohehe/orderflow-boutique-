
CREATE TABLE public.carrier_status_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  status_code text NOT NULL,
  custom_label text NOT NULL,
  color text NOT NULL DEFAULT 'default',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(owner_id, status_code)
);

ALTER TABLE public.carrier_status_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner all carrier_status_mappings"
ON public.carrier_status_mappings
FOR ALL
USING ((auth.uid() = owner_id) OR has_role(auth.uid(), 'admin'::app_role))
WITH CHECK ((auth.uid() = owner_id) OR has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER set_carrier_status_mappings_owner
BEFORE INSERT ON public.carrier_status_mappings
FOR EACH ROW EXECUTE FUNCTION public.set_owner_id();

CREATE TRIGGER update_carrier_status_mappings_updated_at
BEFORE UPDATE ON public.carrier_status_mappings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed default mappings is done in app on first load.
