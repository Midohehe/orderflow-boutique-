CREATE TABLE public.courier_accounts (
 courier_id uuid PRIMARY KEY REFERENCES public.couriers(id), user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
 username text NOT NULL UNIQUE CHECK(username ~ '^[a-z0-9_]{3,30}$'), created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.courier_accounts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.courier_accounts FROM anon,authenticated;
GRANT SELECT ON public.courier_accounts TO authenticated;
CREATE POLICY courier_account_read ON public.courier_accounts FOR SELECT TO authenticated USING(user_id=auth.uid() OR EXISTS(SELECT 1 FROM public.couriers c WHERE c.id=courier_id AND public.has_store_access(c.store_id)));
CREATE TABLE public.courier_batches (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), code bigint GENERATED ALWAYS AS IDENTITY UNIQUE,
 courier_id uuid NOT NULL REFERENCES public.couriers(id), store_id uuid NOT NULL REFERENCES public.stores(id),
 created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.courier_batches ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.courier_batches FROM anon,authenticated;
GRANT SELECT ON public.courier_batches TO authenticated;
CREATE POLICY courier_batch_read ON public.courier_batches FOR SELECT TO authenticated USING(public.has_store_access(store_id));
ALTER TABLE public.courier_orders ADD COLUMN batch_id uuid REFERENCES public.courier_batches(id),
 ADD COLUMN sub_status text NOT NULL DEFAULT 'follow_up' CHECK(sub_status IN ('follow_up','delivered_by_courier','returned_by_courier'));
INSERT INTO public.courier_batches(courier_id,store_id,created_at)
 SELECT DISTINCT courier_id,store_id,assigned_at FROM public.courier_orders;
UPDATE public.courier_orders a SET batch_id=b.id FROM public.courier_batches b WHERE a.courier_id=b.courier_id AND a.store_id=b.store_id AND a.assigned_at=b.created_at;
ALTER TABLE public.courier_orders ALTER COLUMN batch_id SET NOT NULL;
UPDATE public.courier_orders SET sub_status=CASE WHEN state IN ('delivered','settled') THEN 'delivered_by_courier' WHEN state='returned' THEN 'returned_by_courier' ELSE 'follow_up' END;
CREATE TABLE public.courier_status_history (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), order_id uuid NOT NULL REFERENCES public.courier_orders(order_id),
 store_id uuid NOT NULL, actor_id uuid NOT NULL, old_status text NOT NULL, new_status text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.courier_status_history ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.courier_status_history FROM anon,authenticated;
GRANT SELECT ON public.courier_status_history TO authenticated;
CREATE POLICY courier_status_history_read ON public.courier_status_history FOR SELECT TO authenticated USING(public.has_store_access(store_id));
-- Courier identities are provisioned only by the service-role endpoint. No store/profile is created for them.
DROP TRIGGER on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW
 WHEN (coalesce(NEW.raw_app_meta_data->>'account_type','') <> 'courier') EXECUTE FUNCTION public.handle_new_user();
ALTER TABLE public.orders DROP CONSTRAINT orders_status_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_status_check CHECK(status IN ('pending','processing','preparing','prepared','shipped','with_courier','delivered','cancelled','unpacked','returned_received','settled'));

CREATE OR REPLACE FUNCTION public.validate_order_status_transition() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE allowed boolean;
BEGIN
 IF TG_OP='INSERT' OR NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NEW; END IF;
 allowed:=CASE
 WHEN OLD.status IN ('pending','processing','shipped') AND NEW.status='with_courier' THEN EXISTS(SELECT 1 FROM courier_orders WHERE order_id=OLD.id AND state='assigned')
 WHEN OLD.status='with_courier' AND NEW.status IN ('delivered','settled','returned_received') THEN true
 WHEN OLD.status='pending' AND NEW.status IN ('shipped','cancelled','delivered','processing') THEN true
 WHEN OLD.status='processing' AND NEW.status IN ('pending','shipped','cancelled') THEN true
 WHEN OLD.status='shipped' AND NEW.status IN ('delivered','cancelled','unpacked','returned_received','settled') THEN true
 WHEN OLD.status='delivered' AND NEW.status IN ('settled','returned_received','cancelled','shipped') THEN true
 WHEN OLD.status='settled' AND NEW.status IN ('delivered','shipped') THEN true
 WHEN OLD.status='cancelled' AND NEW.status='pending' THEN true ELSE false END;
 IF NOT allowed THEN RAISE EXCEPTION 'انتقال حالة غير مسموح: % → %',OLD.status,NEW.status; END IF;
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.assign_courier_orders(_courier_id uuid,_order_ids uuid[]) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE c public.couriers; o public.orders; n integer := 0; expected integer; batch uuid;
BEGIN
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
   INSERT INTO courier_orders(order_id,store_id,courier_id,cod_amount,delivery_fee,state,batch_id,sub_status)
    VALUES(o.id,c.store_id,c.id,coalesce(o.price,0)+coalesce(o.shipping_fee,0),c.delivery_fee,CASE WHEN o.status='delivered' THEN 'delivered' ELSE 'assigned' END,batch,CASE WHEN o.status='delivered' THEN 'delivered_by_courier' ELSE 'follow_up' END);
   IF o.status IN ('pending','processing','shipped') THEN UPDATE orders SET status='with_courier',updated_at=now() WHERE id=o.id; END IF;
   n:=n+1;
 END LOOP;
 IF n<>expected THEN RAISE EXCEPTION 'بعض الطلبات غير موجودة'; END IF;
 RETURN n;
END $$;

CREATE OR REPLACE FUNCTION public.guard_courier_order() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
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
 AND NOT ((a.state='assigned' AND NEW.status='with_courier' AND NOT coalesce(NEW.settlement_received,false))
 OR (a.state='delivered' AND a.sub_status='delivered_by_courier' AND NEW.status='delivered' AND NOT coalesce(NEW.settlement_received,false))
 OR (a.state='settled' AND a.sub_status='delivered_by_courier' AND NEW.status='settled' AND NEW.settlement_received)
 OR (a.state='returned' AND a.sub_status='returned_by_courier' AND NEW.status='returned_received' AND NOT coalesce(NEW.settlement_received,false)))
 THEN RAISE EXCEPTION 'استخدم واجهة تسوية المناديب لتغيير حالة هذا الطلب'; END IF;
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.process_courier_orders(_courier_id uuid,_order_ids uuid[],_action text,_safe_id uuid DEFAULT NULL) RETURNS jsonb
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
    OR a.state NOT IN ('assigned','delivered') OR o.status NOT IN ('with_courier','delivered')
    OR coalesce(o.settlement_received,false) OR coalesce(o.is_deleted,false)
   THEN RAISE EXCEPTION 'طلب غير متاح أو تمت تسويته/استلام مرتجعه مسبقًا'; END IF;
   IF _action IN ('deliver','settle') AND a.sub_status<>'delivered_by_courier' THEN RAISE EXCEPTION 'يجب أن تكون الحالة الفرعية تم التسليم لدى المندوب'; END IF;
   IF _action='return' AND a.sub_status<>'returned_by_courier' THEN RAISE EXCEPTION 'يجب أن تكون الحالة الفرعية راجع لدى المندوب'; END IF;
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
UPDATE public.orders o SET status='with_courier' FROM public.courier_orders a WHERE a.order_id=o.id AND a.state='assigned' AND o.status='shipped';

CREATE FUNCTION public.update_courier_sub_status(_order_ids uuid[],_sub_status text) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE a public.courier_orders; n integer:=0; expected integer;
BEGIN
 IF auth.uid() IS NULL OR _sub_status IS NULL OR _sub_status NOT IN ('follow_up','delivered_by_courier','returned_by_courier') THEN RAISE EXCEPTION 'حالة غير صالحة'; END IF;
 SELECT count(DISTINCT x) INTO expected FROM unnest(_order_ids) x;
 IF expected=0 OR expected>500 THEN RAISE EXCEPTION 'اختر من 1 إلى 500 طلب'; END IF;
 -- Same lock order as settlement processing, including the courier mutex.
 PERFORM c.id FROM couriers c WHERE c.id IN (SELECT courier_id FROM courier_orders WHERE order_id=ANY(_order_ids)) ORDER BY c.id FOR UPDATE;
 PERFORM id FROM orders WHERE id=ANY(_order_ids) ORDER BY id FOR UPDATE;
 FOR a IN SELECT * FROM courier_orders WHERE order_id=ANY(_order_ids) ORDER BY order_id FOR UPDATE LOOP
   IF NOT has_store_access(a.store_id) AND NOT EXISTS(SELECT 1 FROM courier_accounts ca JOIN couriers c ON c.id=ca.courier_id WHERE ca.user_id=auth.uid() AND c.active AND ca.courier_id=a.courier_id) THEN RAISE EXCEPTION 'ليس لديك صلاحية لهذا الطلب'; END IF;
   IF a.state NOT IN ('assigned','delivered') OR (a.state='delivered' AND _sub_status<>'delivered_by_courier') THEN RAISE EXCEPTION 'لا يمكن تغيير الحالة بعد اعتماد التسليم أو إغلاق الطلب'; END IF;
   IF a.sub_status<>_sub_status THEN
     INSERT INTO courier_status_history(order_id,store_id,actor_id,old_status,new_status) VALUES(a.order_id,a.store_id,auth.uid(),a.sub_status,_sub_status);
     UPDATE courier_orders SET sub_status=_sub_status WHERE order_id=a.order_id;
   END IF;
   n:=n+1;
 END LOOP;
 IF n<>expected THEN RAISE EXCEPTION 'بعض الطلبات غير موجودة'; END IF;
 RETURN n;
END $$;
CREATE FUNCTION public.get_courier_portal_orders(_offset integer DEFAULT 0,_limit integer DEFAULT 50,_sub_status text DEFAULT NULL)
RETURNS TABLE(order_id uuid,order_code text,customer_name text,phone text,address text,city text,product_name text,quantity integer,cod_amount numeric,state text,sub_status text,assigned_at timestamptz,batch_code bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT o.id,o.order_code,o.customer_name,o.phone,o.address,o.city,o.product_name,o.quantity,a.cod_amount,a.state,a.sub_status,a.assigned_at,b.code
 FROM courier_accounts ca JOIN couriers c ON c.id=ca.courier_id AND c.active
 JOIN courier_orders a ON a.courier_id=c.id JOIN orders o ON o.id=a.order_id AND o.store_id=c.store_id
 JOIN courier_batches b ON b.id=a.batch_id
 WHERE ca.user_id=auth.uid() AND (_sub_status IS NULL OR a.sub_status=_sub_status)
 ORDER BY a.assigned_at DESC,a.order_id LIMIT least(greatest(_limit,1),100) OFFSET greatest(_offset,0);
$$;
REVOKE ALL ON FUNCTION public.update_courier_sub_status(uuid[],text),public.get_courier_portal_orders(integer,integer,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.update_courier_sub_status(uuid[],text),public.get_courier_portal_orders(integer,integer,text) TO authenticated;
NOTIFY pgrst,'reload schema';
