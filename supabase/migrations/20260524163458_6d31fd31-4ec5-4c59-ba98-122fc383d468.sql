-- 1) Delete duplicate safe_movements keeping earliest
WITH ranked AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY safe_id, movement_type, reference_id
           ORDER BY created_at ASC, id ASC
         ) AS rn
  FROM public.safe_movements
  WHERE reference_id IS NOT NULL
)
DELETE FROM public.safe_movements sm
USING ranked r
WHERE sm.id = r.id AND r.rn > 1;

-- 2) Unique constraint to prevent duplicates (only when reference_id present)
CREATE UNIQUE INDEX IF NOT EXISTS uniq_safe_movements_ref
  ON public.safe_movements (safe_id, movement_type, reference_id)
  WHERE reference_id IS NOT NULL;

-- 3) Function & triggers to keep safes.balance in sync with movements
CREATE OR REPLACE FUNCTION public.sync_safe_balance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.safes
      SET balance = balance + NEW.amount, updated_at = now()
      WHERE id = NEW.safe_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.safes
      SET balance = balance - OLD.amount, updated_at = now()
      WHERE id = OLD.safe_id;
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.safe_id = OLD.safe_id THEN
      UPDATE public.safes
        SET balance = balance + (NEW.amount - OLD.amount), updated_at = now()
        WHERE id = NEW.safe_id;
    ELSE
      UPDATE public.safes SET balance = balance - OLD.amount, updated_at = now()
        WHERE id = OLD.safe_id;
      UPDATE public.safes SET balance = balance + NEW.amount, updated_at = now()
        WHERE id = NEW.safe_id;
    END IF;
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS safe_movements_sync_balance ON public.safe_movements;
CREATE TRIGGER safe_movements_sync_balance
AFTER INSERT OR UPDATE OR DELETE ON public.safe_movements
FOR EACH ROW EXECUTE FUNCTION public.sync_safe_balance();

-- 4) Recompute current balances from movements (one-time sync)
UPDATE public.safes s
SET balance = COALESCE(t.total, 0), updated_at = now()
FROM (
  SELECT safe_id, SUM(amount) AS total
  FROM public.safe_movements
  GROUP BY safe_id
) t
WHERE s.id = t.safe_id;

UPDATE public.safes
SET balance = 0, updated_at = now()
WHERE id NOT IN (SELECT DISTINCT safe_id FROM public.safe_movements);
