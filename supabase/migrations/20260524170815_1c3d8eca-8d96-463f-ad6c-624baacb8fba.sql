-- Remove stale reversal "adjustment" rows for settlements that were
-- subsequently re-confirmed. The trigger sync_safe_balance will rebalance
-- the safes automatically on DELETE.
DELETE FROM public.safe_movements m
USING public.settlements s
WHERE m.reference_id = s.id
  AND m.movement_type = 'adjustment'
  AND m.amount < 0
  AND m.notes LIKE 'تراجع عن استلام تسوية%'
  AND s.received = true;