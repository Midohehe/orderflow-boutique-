
-- Tokens table: per-user webhook tokens for WhatChimp
CREATE TABLE public.whatsapp_webhook_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  token text NOT NULL UNIQUE,
  label text,
  provider text NOT NULL DEFAULT 'whatchimp',
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz
);

CREATE INDEX idx_whatsapp_webhook_tokens_owner ON public.whatsapp_webhook_tokens(owner_id);
CREATE INDEX idx_whatsapp_webhook_tokens_token ON public.whatsapp_webhook_tokens(token);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_webhook_tokens TO authenticated;
GRANT ALL ON public.whatsapp_webhook_tokens TO service_role;

ALTER TABLE public.whatsapp_webhook_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner manage own tokens"
  ON public.whatsapp_webhook_tokens
  FOR ALL
  TO authenticated
  USING (is_member_of(owner_id) OR has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (is_member_of(owner_id) OR has_role(auth.uid(), 'admin'::app_role));

-- Token <-> stores mapping (admin can attach extra stores to a token)
CREATE TABLE public.whatsapp_token_stores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_id uuid NOT NULL REFERENCES public.whatsapp_webhook_tokens(id) ON DELETE CASCADE,
  store_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(token_id, store_id)
);

CREATE INDEX idx_whatsapp_token_stores_token ON public.whatsapp_token_stores(token_id);
CREATE INDEX idx_whatsapp_token_stores_store ON public.whatsapp_token_stores(store_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_token_stores TO authenticated;
GRANT ALL ON public.whatsapp_token_stores TO service_role;

ALTER TABLE public.whatsapp_token_stores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Token owner or admin manage links"
  ON public.whatsapp_token_stores
  FOR ALL
  TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.whatsapp_webhook_tokens t
      WHERE t.id = whatsapp_token_stores.token_id
        AND is_member_of(t.owner_id)
    )
  )
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.whatsapp_webhook_tokens t
      WHERE t.id = whatsapp_token_stores.token_id
        AND is_member_of(t.owner_id)
    )
  );
