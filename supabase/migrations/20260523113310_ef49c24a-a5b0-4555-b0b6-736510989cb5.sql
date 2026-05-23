CREATE TABLE public.home_page_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid REFERENCES public.stores(id) ON DELETE CASCADE NOT NULL,
  owner_id uuid NOT NULL,
  section_type text NOT NULL,
  position integer NOT NULL DEFAULT 0,
  is_visible boolean NOT NULL DEFAULT true,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_home_sections_store ON public.home_page_sections(store_id, position);

ALTER TABLE public.home_page_sections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read visible sections"
  ON public.home_page_sections FOR SELECT
  USING (is_visible = true OR has_store_access(store_id));

CREATE POLICY "Store team can insert"
  ON public.home_page_sections FOR INSERT
  WITH CHECK (has_store_access(store_id));

CREATE POLICY "Store team can update"
  ON public.home_page_sections FOR UPDATE
  USING (has_store_access(store_id));

CREATE POLICY "Store team can delete"
  ON public.home_page_sections FOR DELETE
  USING (has_store_access(store_id));

CREATE TRIGGER set_home_sections_owner
  BEFORE INSERT ON public.home_page_sections
  FOR EACH ROW EXECUTE FUNCTION public.set_owner_id();

CREATE TRIGGER update_home_sections_updated_at
  BEFORE UPDATE ON public.home_page_sections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();