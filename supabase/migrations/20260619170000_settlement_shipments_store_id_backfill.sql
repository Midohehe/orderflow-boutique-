-- settlement_shipments rows were inserted without store_id after phase5 strict RLS,
-- so rls_store_select(store_id) hid them from the dashboard (service role could write, clients could not read).

UPDATE public.settlement_shipments ss
SET store_id = s.store_id
FROM public.settlements s
WHERE ss.settlement_id = s.id
  AND ss.store_id IS NULL
  AND s.store_id IS NOT NULL;

UPDATE public.settlement_shipments ss
SET store_id = o.store_id
FROM public.orders o
WHERE ss.order_id = o.id
  AND ss.store_id IS NULL
  AND o.store_id IS NOT NULL;

UPDATE public.settlement_shipments ss
SET store_id = s.id
FROM public.stores s
WHERE ss.store_id IS NULL
  AND ss.owner_id IS NOT NULL
  AND s.owner_id = ss.owner_id
  AND s.is_default = true;

UPDATE public.return_shipments rs
SET store_id = r.store_id
FROM public.returns r
WHERE rs.return_id = r.id
  AND rs.store_id IS NULL
  AND r.store_id IS NOT NULL;

UPDATE public.return_shipments rs
SET store_id = o.store_id
FROM public.orders o
WHERE rs.order_id = o.id
  AND rs.store_id IS NULL
  AND o.store_id IS NOT NULL;
