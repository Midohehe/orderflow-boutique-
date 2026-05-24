-- Backfill purchase movements
UPDATE public.safe_movements m
SET reference_id = p.id
FROM public.purchases p
WHERE m.movement_type = 'purchase'
  AND m.reference_id IS NULL
  AND m.safe_id = p.safe_id
  AND m.owner_id = p.owner_id
  AND m.amount = -p.amount
  AND abs(extract(epoch from (m.created_at - p.created_at))) < 5;

-- Backfill expense movements
UPDATE public.safe_movements m
SET reference_id = e.id
FROM public.expenses e
WHERE m.movement_type = 'expense'
  AND m.reference_id IS NULL
  AND m.safe_id = e.safe_id
  AND m.owner_id = e.owner_id
  AND m.amount = -e.amount
  AND abs(extract(epoch from (m.created_at - e.created_at))) < 5;