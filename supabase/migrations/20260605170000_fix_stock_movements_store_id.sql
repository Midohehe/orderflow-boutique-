-- Backfill stock_movements.store_id and keep future rows scoped to a store.

UPDATE public.stock_movements sm
SET store_id = o.store_id
FROM public.orders o
WHERE sm.order_id = o.id
  AND sm.store_id IS NULL
  AND o.store_id IS NOT NULL;

UPDATE public.stock_movements sm
SET store_id = p.store_id
FROM public.products p
WHERE sm.product_id = p.id
  AND sm.store_id IS NULL
  AND p.store_id IS NOT NULL;

UPDATE public.stock_movements sm
SET store_id = s.id
FROM public.stores s
WHERE sm.store_id IS NULL
  AND s.owner_id = sm.owner_id
  AND s.is_default = true;
