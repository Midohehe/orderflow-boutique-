-- Make shipping_zones global (admin-managed, applies to all stores)
DROP TRIGGER IF EXISTS trg_owner_shipping_zones ON public.shipping_zones;
ALTER TABLE public.shipping_zones ALTER COLUMN owner_id DROP NOT NULL;

DROP POLICY IF EXISTS "Owner read zones" ON public.shipping_zones;
DROP POLICY IF EXISTS "Owner write zones" ON public.shipping_zones;
DROP POLICY IF EXISTS "Authenticated read zones" ON public.shipping_zones;
DROP POLICY IF EXISTS "Authenticated write zones" ON public.shipping_zones;
DROP POLICY IF EXISTS "Public can read shipping zones" ON public.shipping_zones;

CREATE POLICY "Public read shipping_zones" ON public.shipping_zones
  FOR SELECT USING (true);
CREATE POLICY "Admin write shipping_zones" ON public.shipping_zones
  FOR ALL USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Deduplicate existing rows (keep most recent per kind+external_id), preserve overrides
WITH ranked AS (
  SELECT id, kind, external_id,
    ROW_NUMBER() OVER (
      PARTITION BY kind, external_id
      ORDER BY (display_name IS NOT NULL) DESC, created_at DESC NULLS LAST
    ) rn
  FROM public.shipping_zones
)
DELETE FROM public.shipping_zones z USING ranked r
WHERE z.id = r.id AND r.rn > 1;

UPDATE public.shipping_zones SET owner_id = NULL;