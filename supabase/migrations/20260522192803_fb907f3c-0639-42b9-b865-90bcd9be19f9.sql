
-- 1) Dedupe shipping_settings (keep latest per owner_id+store_id)
DELETE FROM public.shipping_settings a
USING public.shipping_settings b
WHERE a.owner_id = b.owner_id
  AND a.store_id IS NOT DISTINCT FROM b.store_id
  AND a.updated_at < b.updated_at;

-- 2) Unique constraint
CREATE UNIQUE INDEX IF NOT EXISTS shipping_settings_owner_store_uniq
  ON public.shipping_settings (owner_id, COALESCE(store_id, '00000000-0000-0000-0000-000000000000'::uuid));

-- 3) Backfill settlements.store_id from linked settlement_shipments -> orders
UPDATE public.settlements s
SET store_id = sub.store_id
FROM (
  SELECT ss.settlement_id, MAX(o.store_id::text)::uuid AS store_id
  FROM public.settlement_shipments ss
  JOIN public.orders o ON o.id = ss.order_id
  WHERE o.store_id IS NOT NULL
  GROUP BY ss.settlement_id
) sub
WHERE s.id = sub.settlement_id AND s.store_id IS NULL;

-- 4) Fallback: backfill settlements.store_id from active shipping_settings of the owner
UPDATE public.settlements s
SET store_id = ss.store_id
FROM public.shipping_settings ss
WHERE s.store_id IS NULL
  AND ss.owner_id = s.owner_id
  AND ss.store_id IS NOT NULL
  AND ss.enabled = true;
