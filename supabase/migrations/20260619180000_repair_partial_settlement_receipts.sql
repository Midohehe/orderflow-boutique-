-- Repair partial settlement receipts: received=true but no deposit/orders update.

DO $$
DECLARE
  rec record;
  deposit_ref uuid;
  store uuid;
BEGIN
  FOR rec IN
    SELECT id, code, owner_id, safe_id, payment_amount, received_at
    FROM public.settlements
    WHERE code IN ('CSHP-7-002423', 'CSHP-7-002237')
      AND received = true
      AND deposit_ref_id IS NULL
  LOOP
    SELECT store_id INTO store FROM public.safes WHERE id = rec.safe_id;

    UPDATE public.orders o
    SET status = 'settled',
        settlement_received = true,
        settlement_received_at = rec.received_at,
        updated_at = now()
    FROM public.settlement_shipments ss
    WHERE ss.settlement_id = rec.id
      AND ss.order_id = o.id
      AND o.status IN ('shipped', 'delivered')
      AND o.settlement_received = false;

    UPDATE public.orders o
    SET settlement_received = true,
        settlement_received_at = rec.received_at,
        updated_at = now()
    FROM public.settlement_shipments ss
    WHERE ss.settlement_id = rec.id
      AND ss.order_id = o.id
      AND o.status NOT IN ('shipped', 'delivered', 'settled')
      AND o.settlement_received = false;

    deposit_ref := gen_random_uuid();

    INSERT INTO public.safe_movements (
      safe_id, amount, movement_type, reference_id, notes, owner_id, store_id
    ) VALUES (
      rec.safe_id,
      rec.payment_amount,
      'deposit',
      deposit_ref,
      'إيداع قيمة تسوية ' || rec.code,
      rec.owner_id,
      store
    );

    UPDATE public.settlements
    SET deposit_ref_id = deposit_ref
    WHERE id = rec.id;
  END LOOP;
END $$;
