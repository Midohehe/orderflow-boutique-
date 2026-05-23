
CREATE TABLE public.store_themes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  store_id uuid,
  name text NOT NULL,
  description text,
  thumbnail_url text,
  puck_data jsonb NOT NULL DEFAULT '{"content":[],"root":{"props":{}}}'::jsonb,
  custom_html text,
  custom_css text,
  is_template boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.store_themes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner all store_themes" ON public.store_themes
  FOR ALL USING (is_member_of(owner_id) OR has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (is_member_of(owner_id) OR has_role(auth.uid(),'admin'::app_role));

CREATE POLICY "Public read templates" ON public.store_themes
  FOR SELECT USING (is_template = true);

CREATE TRIGGER trg_store_themes_updated
  BEFORE UPDATE ON public.store_themes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_store_themes_store ON public.store_themes(store_id);
