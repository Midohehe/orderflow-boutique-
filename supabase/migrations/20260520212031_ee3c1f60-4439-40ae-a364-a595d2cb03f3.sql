
CREATE TABLE public.facebook_oauth_states (
  token text PRIMARY KEY,
  store_id uuid NOT NULL,
  owner_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.facebook_oauth_states ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin only facebook_oauth_states"
ON public.facebook_oauth_states
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
