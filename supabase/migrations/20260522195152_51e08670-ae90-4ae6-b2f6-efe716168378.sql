-- Ad Wallets system
CREATE TABLE public.ad_wallets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  store_id uuid,
  name text NOT NULL,
  platform text NOT NULL DEFAULT 'facebook',
  currency text NOT NULL DEFAULT 'USD',
  balance numeric NOT NULL DEFAULT 0,
  avg_cost_rate numeric NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.ad_wallets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner all ad_wallets" ON public.ad_wallets FOR ALL
  USING (is_member_of(owner_id) OR has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (is_member_of(owner_id) OR has_role(auth.uid(),'admin'::app_role));
CREATE TRIGGER set_owner_id_ad_wallets BEFORE INSERT ON public.ad_wallets
  FOR EACH ROW EXECUTE FUNCTION public.set_owner_id();
CREATE TRIGGER update_ad_wallets_updated_at BEFORE UPDATE ON public.ad_wallets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.ad_wallet_topups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  store_id uuid,
  wallet_id uuid NOT NULL REFERENCES public.ad_wallets(id) ON DELETE CASCADE,
  safe_id uuid NOT NULL,
  amount_foreign numeric NOT NULL,
  exchange_rate numeric NOT NULL,
  amount_local numeric NOT NULL,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.ad_wallet_topups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner all ad_wallet_topups" ON public.ad_wallet_topups FOR ALL
  USING (is_member_of(owner_id) OR has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (is_member_of(owner_id) OR has_role(auth.uid(),'admin'::app_role));
CREATE TRIGGER set_owner_id_ad_wallet_topups BEFORE INSERT ON public.ad_wallet_topups
  FOR EACH ROW EXECUTE FUNCTION public.set_owner_id();

CREATE TABLE public.ad_spends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  store_id uuid,
  wallet_id uuid NOT NULL REFERENCES public.ad_wallets(id) ON DELETE CASCADE,
  product_id uuid,
  campaign_name text,
  fb_campaign_id text,
  amount_foreign numeric NOT NULL,
  cost_rate numeric NOT NULL,
  amount_local numeric NOT NULL,
  spend_date date NOT NULL DEFAULT (now()::date),
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.ad_spends ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner all ad_spends" ON public.ad_spends FOR ALL
  USING (is_member_of(owner_id) OR has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (is_member_of(owner_id) OR has_role(auth.uid(),'admin'::app_role));
CREATE TRIGGER set_owner_id_ad_spends BEFORE INSERT ON public.ad_spends
  FOR EACH ROW EXECUTE FUNCTION public.set_owner_id();

CREATE INDEX idx_ad_wallets_store ON public.ad_wallets(store_id);
CREATE INDEX idx_ad_topups_wallet ON public.ad_wallet_topups(wallet_id);
CREATE INDEX idx_ad_spends_wallet ON public.ad_spends(wallet_id);
CREATE INDEX idx_ad_spends_product ON public.ad_spends(product_id);
CREATE INDEX idx_ad_spends_store ON public.ad_spends(store_id);