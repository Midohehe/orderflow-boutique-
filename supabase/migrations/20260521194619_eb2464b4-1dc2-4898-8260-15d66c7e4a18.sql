
-- UTM + FB attribution columns on orders
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS utm_source text,
  ADD COLUMN IF NOT EXISTS utm_medium text,
  ADD COLUMN IF NOT EXISTS utm_campaign text,
  ADD COLUMN IF NOT EXISTS utm_content text,
  ADD COLUMN IF NOT EXISTS utm_term text,
  ADD COLUMN IF NOT EXISTS fb_campaign_id text,
  ADD COLUMN IF NOT EXISTS fb_adset_id text,
  ADD COLUMN IF NOT EXISTS fb_ad_id text,
  ADD COLUMN IF NOT EXISTS fbclid text,
  ADD COLUMN IF NOT EXISTS landing_slug text;

CREATE INDEX IF NOT EXISTS idx_orders_fb_campaign ON public.orders(fb_campaign_id) WHERE fb_campaign_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_fb_ad ON public.orders(fb_ad_id) WHERE fb_ad_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_utm_campaign ON public.orders(utm_campaign) WHERE utm_campaign IS NOT NULL;

-- Extend analytics_events similarly
ALTER TABLE public.analytics_events
  ADD COLUMN IF NOT EXISTS utm_medium text,
  ADD COLUMN IF NOT EXISTS utm_campaign text,
  ADD COLUMN IF NOT EXISTS utm_content text,
  ADD COLUMN IF NOT EXISTS utm_term text,
  ADD COLUMN IF NOT EXISTS fb_campaign_id text,
  ADD COLUMN IF NOT EXISTS fb_ad_id text,
  ADD COLUMN IF NOT EXISTS fbclid text;

-- Campaigns
CREATE TABLE IF NOT EXISTS public.fb_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL,
  owner_id uuid NOT NULL,
  fb_campaign_id text NOT NULL,
  name text,
  status text,
  objective text,
  daily_budget numeric,
  lifetime_budget numeric,
  start_time timestamptz,
  stop_time timestamptz,
  created_time timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, fb_campaign_id)
);
CREATE INDEX IF NOT EXISTS idx_fbc_store ON public.fb_campaigns(store_id);
CREATE INDEX IF NOT EXISTS idx_fbc_owner ON public.fb_campaigns(owner_id);

ALTER TABLE public.fb_campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner all fb_campaigns" ON public.fb_campaigns
  FOR ALL TO authenticated
  USING (is_member_of(owner_id) OR has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (is_member_of(owner_id) OR has_role(auth.uid(), 'admin'::app_role));

-- Ads (and adsets implicitly via fb_adset_id)
CREATE TABLE IF NOT EXISTS public.fb_ads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL,
  owner_id uuid NOT NULL,
  fb_ad_id text NOT NULL,
  fb_adset_id text,
  fb_adset_name text,
  fb_campaign_id text,
  name text,
  status text,
  creative_thumbnail_url text,
  landing_url text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, fb_ad_id)
);
CREATE INDEX IF NOT EXISTS idx_fba_store ON public.fb_ads(store_id);
CREATE INDEX IF NOT EXISTS idx_fba_campaign ON public.fb_ads(fb_campaign_id);
CREATE INDEX IF NOT EXISTS idx_fba_owner ON public.fb_ads(owner_id);

ALTER TABLE public.fb_ads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner all fb_ads" ON public.fb_ads
  FOR ALL TO authenticated
  USING (is_member_of(owner_id) OR has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (is_member_of(owner_id) OR has_role(auth.uid(), 'admin'::app_role));

-- Daily insights at ad-level (rollup-able to adset/campaign)
CREATE TABLE IF NOT EXISTS public.fb_insights_daily (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL,
  owner_id uuid NOT NULL,
  date date NOT NULL,
  fb_campaign_id text,
  fb_adset_id text,
  fb_ad_id text,
  spend numeric NOT NULL DEFAULT 0,
  impressions bigint NOT NULL DEFAULT 0,
  clicks bigint NOT NULL DEFAULT 0,
  reach bigint NOT NULL DEFAULT 0,
  ctr numeric,
  cpc numeric,
  cpm numeric,
  actions jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, date, fb_ad_id)
);
CREATE INDEX IF NOT EXISTS idx_fbi_store_date ON public.fb_insights_daily(store_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_fbi_campaign ON public.fb_insights_daily(fb_campaign_id);
CREATE INDEX IF NOT EXISTS idx_fbi_ad ON public.fb_insights_daily(fb_ad_id);

ALTER TABLE public.fb_insights_daily ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner all fb_insights_daily" ON public.fb_insights_daily
  FOR ALL TO authenticated
  USING (is_member_of(owner_id) OR has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (is_member_of(owner_id) OR has_role(auth.uid(), 'admin'::app_role));

-- Sync log
CREATE TABLE IF NOT EXISTS public.fb_sync_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL,
  owner_id uuid NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  status text NOT NULL DEFAULT 'running',
  campaigns_synced integer DEFAULT 0,
  ads_synced integer DEFAULT 0,
  insights_synced integer DEFAULT 0,
  error_message text
);
ALTER TABLE public.fb_sync_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner all fb_sync_log" ON public.fb_sync_log
  FOR ALL TO authenticated
  USING (is_member_of(owner_id) OR has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (is_member_of(owner_id) OR has_role(auth.uid(), 'admin'::app_role));
