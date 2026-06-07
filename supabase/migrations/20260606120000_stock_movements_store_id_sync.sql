-- Re-backfill stock_movements.store_id and auto-fill on future inserts.

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

CREATE OR REPLACE FUNCTION public.sync_stock_movement_store_id()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.store_id IS NULL AND NEW.order_id IS NOT NULL THEN
    SELECT o.store_id INTO NEW.store_id
    FROM public.orders o
    WHERE o.id = NEW.order_id;
  END IF;

  IF NEW.store_id IS NULL AND NEW.product_id IS NOT NULL THEN
    SELECT p.store_id INTO NEW.store_id
    FROM public.products p
    WHERE p.id = NEW.product_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_stock_movements_store_id ON public.stock_movements;
CREATE TRIGGER trg_stock_movements_store_id
  BEFORE INSERT ON public.stock_movements
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_stock_movement_store_id();
