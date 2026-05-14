
CREATE TABLE IF NOT EXISTS public.sticker_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL UNIQUE,
  page_width_mm integer NOT NULL DEFAULT 100,
  page_height_mm integer NOT NULL DEFAULT 150,
  font_size integer NOT NULL DEFAULT 12,
  header_text text NOT NULL DEFAULT '',
  footer_text text NOT NULL DEFAULT '',
  show_barcode boolean NOT NULL DEFAULT true,
  show_logo boolean NOT NULL DEFAULT false,
  fields jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.sticker_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner all sticker_settings"
  ON public.sticker_settings
  FOR ALL
  USING ((auth.uid() = owner_id) OR has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK ((auth.uid() = owner_id) OR has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER set_sticker_settings_updated_at
  BEFORE UPDATE ON public.sticker_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
