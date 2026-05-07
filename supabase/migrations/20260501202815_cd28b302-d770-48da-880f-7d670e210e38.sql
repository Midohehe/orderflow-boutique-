CREATE TABLE IF NOT EXISTS public.header_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  logo_text text NOT NULL DEFAULT 'عدسات ميار',
  logo_image text,
  tagline text DEFAULT '',
  phone text DEFAULT '',
  email text DEFAULT '',
  instagram_url text DEFAULT '',
  facebook_url text DEFAULT '',
  whatsapp_url text DEFAULT '',
  tiktok_url text DEFAULT '',
  show_search boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.header_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read header_settings"
ON public.header_settings FOR SELECT
USING (true);

CREATE POLICY "Authenticated users can write header_settings"
ON public.header_settings FOR ALL
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

CREATE TRIGGER update_header_settings_updated_at
BEFORE UPDATE ON public.header_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.header_settings (logo_text, tagline) VALUES ('عدسات ميار', 'عدسات لاصقة ملونة بأعلى جودة');