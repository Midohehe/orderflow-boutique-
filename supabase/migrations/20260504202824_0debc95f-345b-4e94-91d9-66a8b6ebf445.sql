
-- Cache of cities/areas fetched from shipping company
CREATE TABLE IF NOT EXISTS public.shipping_zones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id integer NOT NULL,
  parent_external_id integer,
  name text NOT NULL,
  kind text NOT NULL DEFAULT 'zone', -- 'zone' (city) or 'area'
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (external_id, kind)
);

ALTER TABLE public.shipping_zones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read zones" ON public.shipping_zones FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated write zones" ON public.shipping_zones FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_shipping_zones_parent ON public.shipping_zones(parent_external_id);
CREATE INDEX IF NOT EXISTS idx_shipping_zones_kind ON public.shipping_zones(kind);

-- Add matched zone/area columns to orders
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS matched_zone_id integer,
  ADD COLUMN IF NOT EXISTS matched_area_id integer,
  ADD COLUMN IF NOT EXISTS matched_zone_name text,
  ADD COLUMN IF NOT EXISTS matched_area_name text;
