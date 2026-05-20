
CREATE TABLE public.store_facebook_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL UNIQUE,
  owner_id uuid NOT NULL,
  fb_user_id text,
  fb_user_name text,
  access_token text NOT NULL,
  token_expires_at timestamptz,
  ad_account_id text,
  ad_account_name text,
  scopes text,
  connected_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.store_facebook_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner all store_facebook_connections"
ON public.store_facebook_connections
FOR ALL
USING (is_member_of(owner_id) OR has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (is_member_of(owner_id) OR has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_sfc_owner ON public.store_facebook_connections(owner_id);
