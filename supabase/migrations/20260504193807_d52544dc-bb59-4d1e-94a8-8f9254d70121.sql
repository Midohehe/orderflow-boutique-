CREATE TABLE public.shipping_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email text NOT NULL DEFAULT '',
  password text NOT NULL DEFAULT '',
  endpoint text NOT NULL DEFAULT 'https://turboex.ly:8001/graphql',
  enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.shipping_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read shipping_settings" ON public.shipping_settings
FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated write shipping_settings" ON public.shipping_settings
FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

CREATE TRIGGER update_shipping_settings_updated_at
BEFORE UPDATE ON public.shipping_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS shipped_to_company boolean NOT NULL DEFAULT false;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS shipping_reference text;