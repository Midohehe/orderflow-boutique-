
CREATE TABLE IF NOT EXISTS public.city_corrections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  city text NOT NULL,
  area text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS city_corrections_owner_idx ON public.city_corrections(owner_id);
ALTER TABLE public.city_corrections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read city_corrections" ON public.city_corrections FOR SELECT USING (true);
CREATE POLICY "Owner write city_corrections" ON public.city_corrections FOR ALL
  USING ((auth.uid() = owner_id) OR has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK ((auth.uid() = owner_id) OR has_role(auth.uid(), 'admin'::app_role));
