-- Existing assignments retain their agreed collection amounts (NULL means legacy).
ALTER TABLE public.courier_orders ADD COLUMN shipping_mode text CHECK(shipping_mode IN ('included','excluded'));
CREATE OR REPLACE FUNCTION public.assign_courier_orders_with_shipping(_courier_id uuid,_order_ids uuid[],_shipping_mode text) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE c public.couriers; o public.orders; n integer := 0; expected integer; batch uuid;
BEGIN
 IF _shipping_mode IS NULL OR _shipping_mode NOT IN ('included','excluded') THEN RAISE EXCEPTION 'اختر شامل أو غير شامل مصاريف الشحن'; END IF;
 SELECT * INTO c FROM couriers WHERE id=_courier_id FOR UPDATE;
 IF auth.uid() IS NULL OR c.id IS NULL OR NOT has_store_access(c.store_id) OR NOT c.active THEN RAISE EXCEPTION 'المندوب غير متاح أو ليست لديك صلاحية'; END IF;
 SELECT count(DISTINCT x) INTO expected FROM unnest(_order_ids) x;
 IF expected=0 OR expected>500 THEN RAISE EXCEPTION 'اختر من 1 إلى 500 طلب'; END IF;
 INSERT INTO courier_batches(courier_id,store_id) VALUES(c.id,c.store_id) RETURNING id INTO batch;
 FOR o IN SELECT * FROM orders WHERE id=ANY(_order_ids) ORDER BY id FOR UPDATE LOOP
   IF o.store_id IS DISTINCT FROM c.store_id OR coalesce(o.is_deleted,false) OR coalesce(o.locked_insufficient_balance,false)
     OR coalesce(o.shipped_to_company,false) OR coalesce(o.settlement_received,false)
     OR o.status NOT IN ('pending','processing','shipped','delivered')
     OR EXISTS(SELECT 1 FROM courier_orders WHERE order_id=o.id)
   THEN RAISE EXCEPTION 'بعض الطلبات غير مؤهلة أو مرتبطة بمندوب/شركة أو تمت تسويتها'; END IF;
   UPDATE orders SET shipping_fee=CASE WHEN _shipping_mode='excluded' THEN c.delivery_fee ELSE 0 END, shipping_included=(_shipping_mode='included') WHERE id=o.id;
   INSERT INTO courier_orders(order_id,store_id,courier_id,cod_amount,delivery_fee,state,batch_id,sub_status,shipping_mode)
    VALUES(o.id,c.store_id,c.id,coalesce(o.price,0)+CASE WHEN _shipping_mode='excluded' THEN c.delivery_fee ELSE 0 END,c.delivery_fee,CASE WHEN o.status='delivered' THEN 'delivered' ELSE 'assigned' END,batch,CASE WHEN o.status='delivered' THEN 'delivered_by_courier' ELSE 'follow_up' END,_shipping_mode);
   IF o.status IN ('pending','processing','shipped') THEN UPDATE orders SET status='with_courier',updated_at=now() WHERE id=o.id; END IF;
   n:=n+1;
 END LOOP;
 IF n<>expected THEN RAISE EXCEPTION 'بعض الطلبات غير موجودة'; END IF;
 RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.assign_courier_orders_with_shipping(uuid,uuid[],text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.assign_courier_orders_with_shipping(uuid,uuid[],text) TO authenticated;
NOTIFY pgrst,'reload schema';
