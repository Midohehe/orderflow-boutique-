CREATE TABLE public.hidden_default_cities (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id uuid NOT NULL,
  city text NOT NULL,
  area text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (owner_id, city, area)
);

ALTER TABLE public.hidden_default_cities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner read hidden_default_cities" ON public.hidden_default_cities
  FOR SELECT USING ((auth.uid() = owner_id) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Owner insert hidden_default_cities" ON public.hidden_default_cities
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Owner delete hidden_default_cities" ON public.hidden_default_cities
  FOR DELETE TO authenticated USING ((auth.uid() = owner_id) OR has_role(auth.uid(), 'admin'::app_role));