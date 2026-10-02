CREATE TABLE public.couriers (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), store_id uuid NOT NULL REFERENCES public.stores(id),
 name text NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 120), phone text NOT NULL DEFAULT '',
 delivery_fee numeric(12,2) NOT NULL DEFAULT 0 CHECK(delivery_fee >= 0 AND delivery_fee <> 'NaN'),
 active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(id,store_id)
);
CREATE TABLE public.courier_receipts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), store_id uuid NOT NULL REFERENCES public.stores(id),
 courier_id uuid NOT NULL, safe_id uuid REFERENCES public.safes(id), action text NOT NULL CHECK(action IN ('settle','return')),
 gross numeric(14,2) NOT NULL, fees numeric(14,2) NOT NULL, net numeric(14,2) NOT NULL,
 order_count integer NOT NULL, created_by uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(courier_id,store_id) REFERENCES public.couriers(id,store_id)
);
CREATE TABLE public.courier_orders (
 order_id uuid PRIMARY KEY REFERENCES public.orders(id), store_id uuid NOT NULL REFERENCES public.stores(id),
 courier_id uuid NOT NULL, cod_amount numeric(12,2) NOT NULL CHECK(cod_amount >= 0 AND cod_amount <> 'NaN'),
 delivery_fee numeric(12,2) NOT NULL CHECK(delivery_fee >= 0 AND delivery_fee <> 'NaN'),
 state text NOT NULL DEFAULT 'assigned' CHECK(state IN ('assigned','delivered','settled','returned')),
 receipt_id uuid REFERENCES public.courier_receipts(id), assigned_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(courier_id,store_id) REFERENCES public.couriers(id,store_id)
);
CREATE INDEX courier_orders_list ON public.courier_orders(store_id,courier_id,assigned_at DESC);
ALTER TABLE public.couriers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courier_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courier_receipts ENABLE ROW LEVEL SECURITY;
GRANT SELECT,INSERT,UPDATE ON public.couriers TO authenticated;
GRANT SELECT ON public.courier_orders,public.courier_receipts TO authenticated;
REVOKE INSERT,UPDATE,DELETE ON public.courier_orders,public.courier_receipts FROM anon,authenticated;
CREATE POLICY couriers_access ON public.couriers FOR ALL TO authenticated USING(public.has_store_access(store_id)) WITH CHECK(public.has_store_access(store_id));
CREATE POLICY courier_orders_read ON public.courier_orders FOR SELECT TO authenticated USING(public.has_store_access(store_id));
CREATE POLICY courier_receipts_read ON public.courier_receipts FOR SELECT TO authenticated USING(public.has_store_access(store_id));

CREATE FUNCTION public.assign_courier_orders(_courier_id uuid,_order_ids uuid[]) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE c public.couriers; o public.orders; n integer := 0; expected integer;
BEGIN
 SELECT * INTO c FROM couriers WHERE id=_courier_id FOR UPDATE;
 IF auth.uid() IS NULL OR c.id IS NULL OR NOT has_store_access(c.store_id) OR NOT c.active THEN RAISE EXCEPTION 'المندوب غير متاح أو ليست لديك صلاحية'; END IF;
 SELECT count(DISTINCT x) INTO expected FROM unnest(_order_ids) x;
 IF expected=0 OR expected>500 THEN RAISE EXCEPTION 'اختر من 1 إلى 500 طلب'; END IF;
 FOR o IN SELECT * FROM orders WHERE id=ANY(_order_ids) ORDER BY id FOR UPDATE LOOP
   IF o.store_id IS DISTINCT FROM c.store_id OR coalesce(o.is_deleted,false) OR coalesce(o.locked_insufficient_balance,false)
     OR coalesce(o.shipped_to_company,false) OR coalesce(o.settlement_received,false)
     OR o.status NOT IN ('pending','processing','shipped','delivered')
     OR EXISTS(SELECT 1 FROM courier_orders WHERE order_id=o.id)
   THEN RAISE EXCEPTION 'بعض الطلبات غير مؤهلة أو مرتبطة بمندوب/شركة أو تمت تسويتها'; END IF;
   INSERT INTO courier_orders(order_id,store_id,courier_id,cod_amount,delivery_fee,state)
    VALUES(o.id,c.store_id,c.id,coalesce(o.price,0)+coalesce(o.shipping_fee,0),c.delivery_fee,CASE WHEN o.status='delivered' THEN 'delivered' ELSE 'assigned' END);
   IF o.status IN ('pending','processing') THEN UPDATE orders SET status='shipped',updated_at=now() WHERE id=o.id; END IF;
   n:=n+1;
 END LOOP;
 IF n<>expected THEN RAISE EXCEPTION 'بعض الطلبات غير موجودة'; END IF;
 RETURN n;
END $$;

-- Assigned order finances and shipping cannot bypass the courier settlement flow.
CREATE FUNCTION public.guard_courier_order() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE a public.courier_orders;
BEGIN
 SELECT * INTO a FROM courier_orders WHERE order_id=OLD.id;
 IF a.order_id IS NULL THEN RETURN NEW; END IF;
 IF NEW.store_id IS DISTINCT FROM OLD.store_id OR NEW.owner_id IS DISTINCT FROM OLD.owner_id
 OR NEW.price IS DISTINCT FROM OLD.price OR NEW.shipping_fee IS DISTINCT FROM OLD.shipping_fee
 OR NEW.quantity IS DISTINCT FROM OLD.quantity OR NEW.product_id IS DISTINCT FROM OLD.product_id
 OR NEW.is_deleted IS DISTINCT FROM OLD.is_deleted OR NEW.shipped_to_company IS DISTINCT FROM OLD.shipped_to_company
 THEN RAISE EXCEPTION 'لا يمكن تغيير قيمة أو متجر أو شحن أو حذف طلب مرتبط بمندوب'; END IF;
 IF (NEW.status IS DISTINCT FROM OLD.status OR NEW.settlement_received IS DISTINCT FROM OLD.settlement_received)
 AND NOT ((a.state='assigned' AND NEW.status='shipped' AND NOT coalesce(NEW.settlement_received,false))
 OR (a.state='delivered' AND NEW.status='delivered' AND NOT coalesce(NEW.settlement_received,false))
 OR (a.state='settled' AND NEW.status='settled' AND NEW.settlement_received)
 OR (a.state='returned' AND NEW.status='returned_received' AND NOT coalesce(NEW.settlement_received,false)))
 THEN RAISE EXCEPTION 'استخدم واجهة تسوية المناديب لتغيير حالة هذا الطلب'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER guard_courier_order BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.guard_courier_order();

CREATE FUNCTION public.process_courier_orders(_courier_id uuid,_order_ids uuid[],_action text,_safe_id uuid DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE c public.couriers; s public.safes; o public.orders; a public.courier_orders;
 expected integer; n integer:=0; gross numeric:=0; fees numeric:=0; receipt uuid:=gen_random_uuid(); movement record; inserted uuid;
BEGIN
 SELECT * INTO c FROM couriers WHERE id=_courier_id FOR UPDATE;
 IF auth.uid() IS NULL OR c.id IS NULL OR NOT has_store_access(c.store_id) THEN RAISE EXCEPTION 'ليس لديك صلاحية'; END IF;
 IF _action NOT IN ('deliver','settle','return') OR _action IS NULL THEN RAISE EXCEPTION 'عملية غير صالحة'; END IF;
 SELECT count(DISTINCT x) INTO expected FROM unnest(_order_ids) x;
 IF expected=0 OR expected>500 THEN RAISE EXCEPTION 'اختر من 1 إلى 500 طلب'; END IF;
 IF _action='settle' THEN
   SELECT * INTO s FROM safes WHERE id=_safe_id FOR UPDATE;
   IF s.id IS NULL OR s.store_id IS DISTINCT FROM c.store_id OR NOT has_store_access(s.store_id) THEN RAISE EXCEPTION 'اختر خزينة من نفس المتجر'; END IF;
 END IF;
 FOR o IN SELECT * FROM orders WHERE id=ANY(_order_ids) ORDER BY id FOR UPDATE LOOP
   SELECT * INTO a FROM courier_orders WHERE order_id=o.id FOR UPDATE;
   IF a.order_id IS NULL OR a.courier_id<>c.id OR o.store_id IS DISTINCT FROM c.store_id
    OR a.state NOT IN ('assigned','delivered') OR o.status NOT IN ('shipped','delivered')
    OR coalesce(o.settlement_received,false) OR coalesce(o.is_deleted,false)
   THEN RAISE EXCEPTION 'طلب غير متاح أو تمت تسويته/استلام مرتجعه مسبقًا'; END IF;
   IF _action='deliver' AND a.state='delivered' THEN RAISE EXCEPTION 'تم تسجيل تسليم الطلب مسبقًا'; END IF;
   gross:=gross+a.cod_amount; fees:=fees+a.delivery_fee; n:=n+1;
 END LOOP;
 IF n<>expected THEN RAISE EXCEPTION 'بعض الطلبات غير موجودة'; END IF;
 IF _action<>'deliver' THEN
   INSERT INTO courier_receipts(id,store_id,courier_id,safe_id,action,gross,fees,net,order_count,created_by)
   VALUES(receipt,c.store_id,c.id,CASE WHEN _action='settle' THEN s.id END,_action,
     CASE WHEN _action='settle' THEN gross ELSE 0 END,CASE WHEN _action='settle' THEN fees ELSE 0 END,
     CASE WHEN _action='settle' THEN gross-fees ELSE 0 END,n,auth.uid());
 END IF;
 UPDATE courier_orders SET state=CASE _action WHEN 'deliver' THEN 'delivered' WHEN 'settle' THEN 'settled' ELSE 'returned' END,
 receipt_id=CASE WHEN _action<>'deliver' THEN receipt END WHERE order_id=ANY(_order_ids);
 UPDATE orders SET status=CASE _action WHEN 'deliver' THEN 'delivered' WHEN 'settle' THEN 'settled' ELSE 'returned_received' END,
 settlement_received=(_action='settle'), settlement_received_at=CASE WHEN _action='settle' THEN now() ELSE NULL END, updated_at=now()
 WHERE id=ANY(_order_ids);
 IF _action='settle' THEN
   INSERT INTO safe_movements(safe_id,owner_id,store_id,amount,movement_type,reference_id,notes)
    VALUES(s.id,s.owner_id,c.store_id,gross-fees,'deposit',receipt::text,
      'تسوية المندوب '||c.name||' | تحصيل '||gross||' | أجرة التوصيل '||fees||' | عدد الطلبات '||n);
 ELSIF _action='return' THEN
   -- Reverse only recorded stock deductions, once, inside this transaction.
   FOR movement IN SELECT * FROM stock_movements WHERE order_id=ANY(_order_ids) AND reason='order_created' AND qty<0 ORDER BY product_id,id LOOP
     IF NOT EXISTS(SELECT 1 FROM stock_movements WHERE order_id=movement.order_id AND reason IN ('return_received','order_unpacked')
       AND product_id IS NOT DISTINCT FROM movement.product_id AND variant_key IS NOT DISTINCT FROM movement.variant_key AND warehouse_code IS NOT DISTINCT FROM movement.warehouse_code) THEN
       INSERT INTO stock_movements(owner_id,store_id,product_id,product_name,variant_key,warehouse_code,qty,unit_price,reason,order_id)
       VALUES(movement.owner_id,movement.store_id,movement.product_id,movement.product_name,movement.variant_key,movement.warehouse_code,-movement.qty,movement.unit_price,'return_received',movement.order_id)
       ON CONFLICT DO NOTHING RETURNING id INTO inserted;
       IF inserted IS NOT NULL AND movement.product_id IS NOT NULL THEN
         UPDATE products SET stock=coalesce(stock,0)-movement.qty,
         variant_stock=CASE WHEN coalesce(variant_stock,'{}'::jsonb) ? movement.variant_key THEN
           jsonb_set(variant_stock,ARRAY[movement.variant_key],to_jsonb(coalesce((variant_stock->>movement.variant_key)::numeric,0)-movement.qty)) ELSE variant_stock END
         WHERE id=movement.product_id AND store_id=c.store_id;
       END IF;
     END IF;
   END LOOP;
 END IF;
 RETURN jsonb_build_object('count',n,'gross',CASE WHEN _action='settle' THEN gross ELSE 0 END,'fees',CASE WHEN _action='settle' THEN fees ELSE 0 END,'net',CASE WHEN _action='settle' THEN gross-fees ELSE 0 END);
END $$;
REVOKE ALL ON FUNCTION public.assign_courier_orders(uuid,uuid[]),public.process_courier_orders(uuid,uuid[],text,uuid),public.guard_courier_order() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.assign_courier_orders(uuid,uuid[]),public.process_courier_orders(uuid,uuid[],text,uuid) TO authenticated;
NOTIFY pgrst,'reload schema';
