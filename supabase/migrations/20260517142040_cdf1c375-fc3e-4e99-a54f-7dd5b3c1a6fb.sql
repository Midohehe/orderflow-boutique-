CREATE TABLE public.shipping_error_aliases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pattern text NOT NULL,
  match_type text NOT NULL DEFAULT 'contains',
  short_label text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.shipping_error_aliases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read shipping_error_aliases"
ON public.shipping_error_aliases FOR SELECT
USING (true);

CREATE POLICY "Admin write shipping_error_aliases"
ON public.shipping_error_aliases FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_shipping_error_aliases_updated_at
BEFORE UPDATE ON public.shipping_error_aliases
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();