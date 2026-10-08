-- A receipt is committed in the same transaction as the complete checkout.
CREATE TABLE public.checkout_requests (
  request_id uuid PRIMARY KEY,
  fingerprint text NOT NULL,
  response jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.checkout_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.checkout_requests FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON public.checkout_requests TO service_role;
CREATE INDEX checkout_offer_receipts ON public.checkout_requests
  ((response->>'order_id'),(response->>'accepted_offer_id'))
  WHERE response->>'accepted_offer_id' IS NOT NULL;

-- lpad(text,3) truncates codes above 999. Preserve every digit, including counters
-- seeded from imported codes, without renumbering any existing order.
DO $$
DECLARE fn regprocedure; source text;
BEGIN
  FOREACH fn IN ARRAY ARRAY['public.generate_order_code()'::regprocedure,
    'public.generate_order_code_for_store(uuid)'::regprocedure] LOOP
    source := pg_get_functiondef(fn);
    source := replace(source, 'lpad(_n::text, 3, ''0'')', 'lpad(_n::text, greatest(3, length(_n::text)), ''0'')');
    EXECUTE source;
  END LOOP;
END;
$$;

-- New checkout items and their stock movement share the order transaction.
-- Keep one order_created ledger entry per variant so courier returns remain compatible.
CREATE FUNCTION public.record_checkout_stock(_order_id uuid, _item_ids uuid[], _is_offer boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE saved public.orders; prod public.products; line record; insufficient boolean:=false;
  strict_enabled boolean; variants jsonb;
BEGIN
  SELECT * INTO STRICT saved FROM public.orders WHERE id=_order_id FOR UPDATE;
  -- Lock in a consistent order before checking or changing any stock.
  PERFORM p.id FROM public.products p WHERE p.id IN
    (SELECT product_id FROM public.order_items WHERE order_id=_order_id AND id=ANY(_item_ids)) ORDER BY p.id FOR UPDATE;
  FOR line IN
    SELECT product_id,sum(quantity) AS quantity FROM public.order_items
    WHERE order_id=_order_id AND id=ANY(_item_ids) GROUP BY product_id
  LOOP
    SELECT * INTO STRICT prod FROM public.products WHERE id=line.product_id;
    IF line.quantity > coalesce(prod.stock,0) THEN insufficient:=true; END IF;
  END LOOP;
  FOR line IN
    SELECT product_id,CASE WHEN nullif(btrim(selected_color),'') IS NOT NULL AND nullif(btrim(selected_size),'') IS NOT NULL
      THEN btrim(selected_color)||' - '||btrim(selected_size)
      ELSE coalesce(nullif(btrim(selected_color),''),nullif(btrim(selected_size),''),nullif(btrim(selected_product_code),'')) END AS variant_key,
      sum(quantity) AS quantity FROM public.order_items WHERE order_id=_order_id AND id=ANY(_item_ids) GROUP BY 1,2
  LOOP
    SELECT * INTO STRICT prod FROM public.products WHERE id=line.product_id;
    IF line.variant_key IS NOT NULL AND coalesce(prod.variant_stock,'{}'::jsonb) ? line.variant_key
      AND line.quantity > coalesce((prod.variant_stock->>line.variant_key)::numeric,0) THEN insufficient:=true; END IF;
  END LOOP;
  SELECT coalesce(strict_stock_enabled,false) INTO strict_enabled FROM public.profiles WHERE user_id=saved.owner_id;
  IF insufficient THEN
    IF coalesce(strict_enabled,false) AND _is_offer THEN RAISE EXCEPTION 'Offer stock unavailable'; END IF;
    UPDATE public.orders SET insufficient_stock=true,status=CASE WHEN coalesce(strict_enabled,false) THEN 'cancelled' ELSE status END WHERE id=_order_id;
    IF coalesce(strict_enabled,false) THEN RETURN; END IF;
  END IF;
  FOR line IN
    SELECT product_id,min(product_name) AS product_name,
      CASE WHEN nullif(btrim(selected_color),'') IS NOT NULL AND nullif(btrim(selected_size),'') IS NOT NULL
        THEN btrim(selected_color)||' - '||btrim(selected_size)
        ELSE coalesce(nullif(btrim(selected_color),''),nullif(btrim(selected_size),''),nullif(btrim(selected_product_code),'')) END AS variant_key,
      sum(quantity)::integer AS quantity FROM public.order_items WHERE order_id=_order_id AND id=ANY(_item_ids) GROUP BY 1,3 ORDER BY 1,3
  LOOP
    SELECT * INTO STRICT prod FROM public.products WHERE id=line.product_id;
    variants:=coalesce(prod.variant_stock,'{}'::jsonb);
    IF line.variant_key IS NOT NULL AND variants ? line.variant_key THEN
      variants:=jsonb_set(variants,ARRAY[line.variant_key],to_jsonb(coalesce((variants->>line.variant_key)::numeric,0)-line.quantity));
    END IF;
    UPDATE public.products SET stock=coalesce(stock,0)-line.quantity,variant_stock=variants WHERE id=line.product_id;
    INSERT INTO public.stock_movements(owner_id,store_id,product_id,product_name,variant_key,warehouse_code,qty,unit_price,reason,order_id)
    VALUES(saved.owner_id,saved.store_id,line.product_id,line.product_name,line.variant_key,NULL,-line.quantity,prod.price,'order_created',saved.id)
    ON CONFLICT(order_id,reason,(coalesce(variant_key,'')),(coalesce(warehouse_code,'')),
      (coalesce(product_id,'00000000-0000-0000-0000-000000000000'::uuid))) WHERE order_id IS NOT NULL
    DO UPDATE SET qty=stock_movements.qty+excluded.qty;
  END LOOP;
END;
$$;
REVOKE ALL ON FUNCTION public.record_checkout_stock(uuid,uuid[],boolean) FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.commit_public_checkout(_request_id uuid, _fingerprint text,
  _order jsonb, _items jsonb, _response jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE receipt public.checkout_requests; saved public.orders; line jsonb;
  owner uuid; store uuid; product uuid; constraint_name text; attempts integer := 0;
  item_id uuid; item_ids uuid[]:='{}';
BEGIN
  IF _request_id IS NULL OR _fingerprint IS NULL OR _fingerprint !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'Invalid checkout request';
  END IF;
  -- Serializes concurrent retries, including the transaction before its receipt exists.
  PERFORM pg_advisory_xact_lock(hashtextextended(_request_id::text, 0));
  SELECT * INTO receipt FROM public.checkout_requests WHERE request_id=_request_id;
  IF FOUND THEN
    IF receipt.fingerprint IS DISTINCT FROM _fingerprint THEN RAISE EXCEPTION 'checkout_request_conflict'; END IF;
    RETURN receipt.response || jsonb_build_object('replayed',true);
  END IF;
  owner := (_order->>'owner_id')::uuid; store := (_order->>'store_id')::uuid; product := (_order->>'product_id')::uuid;
  IF NOT EXISTS(SELECT 1 FROM public.products p WHERE p.id=product AND p.owner_id=owner
    AND p.store_id IS NOT DISTINCT FROM store) THEN RAISE EXCEPTION 'Checkout product scope mismatch'; END IF;
  IF jsonb_typeof(_items) IS DISTINCT FROM 'array' OR jsonb_array_length(_items)=0 THEN
    RAISE EXCEPTION 'Checkout items required';
  END IF;
  LOOP
    BEGIN
      INSERT INTO public.orders(owner_id,store_id,customer_name,phone,address,city,governorate,
        product_id,product_name,currency_code,price,shipping_fee,quantity,status,selected_color,
        selected_size,selected_product_code,shipping_included,upsell_offers,client_ip,user_agent,
        country_code,utm_source,utm_medium,utm_campaign,utm_content,utm_term,fb_campaign_id,
        fb_adset_id,fb_ad_id,fbclid,landing_slug,order_code)
      SELECT owner,store,r.customer_name,r.phone,r.address,r.city,r.governorate,
        product,r.product_name,r.currency_code,r.price,r.shipping_fee,r.quantity,'pending',r.selected_color,
        r.selected_size,r.selected_product_code,r.shipping_included,r.upsell_offers,r.client_ip,r.user_agent,
        r.country_code,r.utm_source,r.utm_medium,r.utm_campaign,r.utm_content,r.utm_term,r.fb_campaign_id,
        r.fb_adset_id,r.fb_ad_id,r.fbclid,r.landing_slug,r.order_code
      FROM jsonb_populate_record(NULL::public.orders,_order) r RETURNING * INTO saved;
      EXIT;
    EXCEPTION WHEN unique_violation THEN
      GET STACKED DIAGNOSTICS constraint_name=CONSTRAINT_NAME;
      attempts := attempts+1;
      IF constraint_name <> 'orders_order_code_unique' OR attempts>=5 THEN RAISE; END IF;
      -- The index remains the final authority; retry only code collisions.
      _order := jsonb_set(_order,'{order_code}',to_jsonb((floor(random()*9000000000)+1000000000)::bigint::text));
    END;
  END LOOP;
  FOR line IN SELECT value FROM jsonb_array_elements(_items) LOOP
    IF (line->>'quantity')::integer <= 0 OR (line->>'price')::numeric < 0 OR NOT EXISTS(
      SELECT 1 FROM public.products p WHERE p.id=(line->>'product_id')::uuid AND p.owner_id=owner
        AND p.store_id IS NOT DISTINCT FROM store) THEN RAISE EXCEPTION 'Invalid checkout item'; END IF;
    INSERT INTO public.order_items(order_id,owner_id,store_id,product_id,product_name,quantity,price,
      selected_color,selected_size,selected_product_code)
    SELECT saved.id,owner,store,r.product_id,r.product_name,r.quantity,r.price,
      r.selected_color,r.selected_size,r.selected_product_code
    FROM jsonb_populate_record(NULL::public.order_items,line) r RETURNING id INTO item_id;
    item_ids:=array_append(item_ids,item_id);
  END LOOP;
  PERFORM public.record_checkout_stock(saved.id,item_ids,false);
  _response := _response || jsonb_build_object('ok',true,'order_id',saved.id,'order_code',saved.order_code);
  INSERT INTO public.checkout_requests(request_id,fingerprint,response) VALUES(_request_id,_fingerprint,_response);
  RETURN _response || jsonb_build_object('replayed',false);
END;
$$;
REVOKE ALL ON FUNCTION public.commit_public_checkout(uuid,text,jsonb,jsonb,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.commit_public_checkout(uuid,text,jsonb,jsonb,jsonb) TO service_role;

CREATE FUNCTION public.commit_checkout_offer(_request_id uuid,_fingerprint text,_parent_request_id uuid,
  _order_id uuid,_offer_id uuid,_items jsonb,_waives_shipping boolean) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE receipt public.checkout_requests; saved public.orders; line jsonb; result jsonb;
  added numeric:=0; added_quantity integer:=0; names text; item_id uuid; item_ids uuid[]:='{}';
BEGIN
  IF _request_id IS NULL OR _fingerprint IS NULL OR _fingerprint !~ '^[0-9a-f]{64}$' THEN RAISE EXCEPTION 'Invalid checkout request'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(_request_id::text,0));
  SELECT * INTO receipt FROM public.checkout_requests WHERE request_id=_request_id;
  IF FOUND THEN
    IF receipt.fingerprint IS DISTINCT FROM _fingerprint THEN RAISE EXCEPTION 'checkout_request_conflict'; END IF;
    RETURN receipt.response || jsonb_build_object('replayed',true);
  END IF;
  IF NOT EXISTS(SELECT 1 FROM public.checkout_requests WHERE request_id=_parent_request_id
    AND response->>'order_id'=_order_id::text AND response->>'appended' IS NULL) THEN RAISE EXCEPTION 'Invalid checkout receipt'; END IF;
  SELECT * INTO saved FROM public.orders WHERE id=_order_id AND NOT is_deleted AND status='pending' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order no longer accepts offers'; END IF;
  SELECT response INTO result FROM public.checkout_requests WHERE response->>'order_id'=_order_id::text
    AND response->>'accepted_offer_id'=_offer_id::text LIMIT 1;
  IF FOUND THEN RETURN result || jsonb_build_object('replayed',true); END IF;
  IF jsonb_typeof(_items) IS DISTINCT FROM 'array' OR jsonb_array_length(_items)=0 THEN RAISE EXCEPTION 'Checkout items required'; END IF;
  FOR line IN SELECT value FROM jsonb_array_elements(_items) LOOP
    IF (line->>'quantity')::integer <= 0 OR (line->>'price')::numeric < 0 OR NOT EXISTS(
      SELECT 1 FROM public.products p WHERE p.id=(line->>'product_id')::uuid AND p.owner_id=saved.owner_id
        AND p.store_id IS NOT DISTINCT FROM saved.store_id) THEN RAISE EXCEPTION 'Invalid checkout item'; END IF;
    INSERT INTO public.order_items(order_id,owner_id,store_id,product_id,product_name,quantity,price)
    VALUES(saved.id,saved.owner_id,saved.store_id,(line->>'product_id')::uuid,line->>'product_name',
      (line->>'quantity')::integer,(line->>'price')::numeric) RETURNING id INTO item_id;
    item_ids:=array_append(item_ids,item_id);
    added:=added+(line->>'quantity')::integer*(line->>'price')::numeric;
    added_quantity:=added_quantity+(line->>'quantity')::integer;
  END LOOP;
  PERFORM public.record_checkout_stock(saved.id,item_ids,true);
  SELECT string_agg(value->>'product_name',' + ') INTO names FROM jsonb_array_elements(_items);
  UPDATE public.orders SET price=price+added,quantity=quantity+added_quantity,
    shipping_fee=CASE WHEN _waives_shipping THEN 0 ELSE shipping_fee END,
    product_name=left(product_name||' + '||names,500) WHERE id=saved.id RETURNING * INTO saved;
  SELECT jsonb_build_object('ok',true,'appended',true,'order_id',saved.id,'order_code',saved.order_code,
    'price',saved.price,'shipping_fee',saved.shipping_fee,'total',saved.price+saved.shipping_fee,
    'accepted_offer_id',_offer_id,'offer_lines',_items,'items',coalesce(jsonb_agg(jsonb_build_object(
      'product_id',i.product_id,'product_name',i.product_name,'quantity',i.quantity,'price',i.price*i.quantity)),'[]'::jsonb))
    INTO result FROM public.order_items i WHERE i.order_id=saved.id;
  INSERT INTO public.checkout_requests(request_id,fingerprint,response) VALUES(_request_id,_fingerprint,result);
  RETURN result || jsonb_build_object('replayed',false);
END;
$$;
REVOKE ALL ON FUNCTION public.commit_checkout_offer(uuid,text,uuid,uuid,uuid,jsonb,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.commit_checkout_offer(uuid,text,uuid,uuid,uuid,jsonb,boolean) TO service_role;
NOTIFY pgrst, 'reload schema';
