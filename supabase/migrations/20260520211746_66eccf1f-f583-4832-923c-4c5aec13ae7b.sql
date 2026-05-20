
CREATE TABLE public.facebook_app_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id text,
  app_secret text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

ALTER TABLE public.facebook_app_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin manage facebook_app_config"
ON public.facebook_app_config
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

INSERT INTO public.facebook_app_config (app_id, app_secret) VALUES (NULL, NULL);
