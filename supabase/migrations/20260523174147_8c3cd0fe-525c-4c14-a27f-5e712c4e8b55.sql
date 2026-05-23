CREATE TABLE public.landing_page_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  store_id uuid,
  name text NOT NULL,
  puck_data jsonb,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.landing_page_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner all landing_page_templates"
ON public.landing_page_templates FOR ALL
USING (is_member_of(owner_id) OR has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (is_member_of(owner_id) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Public read landing_page_templates"
ON public.landing_page_templates FOR SELECT
USING (true);

CREATE TRIGGER trg_landing_page_templates_updated_at
BEFORE UPDATE ON public.landing_page_templates
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_landing_page_templates_set_owner
BEFORE INSERT ON public.landing_page_templates
FOR EACH ROW EXECUTE FUNCTION public.set_owner_id();

ALTER TABLE public.landing_pages ADD COLUMN template_id uuid;