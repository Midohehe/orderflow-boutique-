ALTER TABLE public.home_page_sections ADD COLUMN IF NOT EXISTS puck_data jsonb;

CREATE TABLE IF NOT EXISTS public.store_page_layouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL,
  page_key text NOT NULL DEFAULT 'home',
  puck_data jsonb NOT NULL DEFAULT '{"content":[],"root":{"props":{}}}'::jsonb,
  is_published boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(store_id, page_key)
);

ALTER TABLE public.store_page_layouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owners manage their layouts"
ON public.store_page_layouts FOR ALL
USING (has_store_access(store_id) OR has_role(auth.uid(),'admin'))
WITH CHECK (has_store_access(store_id) OR has_role(auth.uid(),'admin'));

CREATE POLICY "public can read published layouts"
ON public.store_page_layouts FOR SELECT
USING (is_published = true);

CREATE TRIGGER set_owner_layouts BEFORE INSERT ON public.store_page_layouts
FOR EACH ROW EXECUTE FUNCTION public.set_owner_id();

CREATE TRIGGER updated_at_layouts BEFORE UPDATE ON public.store_page_layouts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();