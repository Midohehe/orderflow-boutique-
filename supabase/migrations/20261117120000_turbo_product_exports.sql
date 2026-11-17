-- One durable carrier creation attempt per local product variant.
CREATE TABLE public.turbo_product_exports (
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  variant_key text NOT NULL,
  code text NOT NULL,
  account_key text NOT NULL,
  payload jsonb NOT NULL,
  state text NOT NULL CHECK (state IN ('sending','uncertain','failed','created')),
  attempt_id uuid NOT NULL DEFAULT gen_random_uuid(),
  remote_id bigint,
  error_message text,
  started_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (product_id,variant_key),
  UNIQUE (store_id,code),
  UNIQUE (store_id,remote_id)
);
ALTER TABLE public.turbo_product_exports ENABLE ROW LEVEL SECURITY;
CREATE POLICY turbo_exports_read ON public.turbo_product_exports FOR SELECT TO authenticated
  USING (public.has_store_access(store_id));
REVOKE ALL ON public.turbo_product_exports FROM anon,authenticated;
GRANT SELECT ON public.turbo_product_exports TO authenticated;
GRANT ALL ON public.turbo_product_exports TO service_role;

CREATE FUNCTION public.claim_turbo_product_export(_product_id uuid,_store_id uuid,_variant_key text,
  _code text,_account_key text,_payload jsonb,_revision jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE p public.products%ROWTYPE; saved public.turbo_product_exports%ROWTYPE; current_revision jsonb;
BEGIN
  SELECT * INTO p FROM public.products WHERE id=_product_id AND store_id=_store_id FOR UPDATE;
  IF NOT FOUND OR p.deleted_at IS NOT NULL OR NOT coalesce(p.warehouse_linked,false) THEN RAISE EXCEPTION 'المنتج غير متاح للربط بتوربو'; END IF;
  current_revision=jsonb_build_object('name',p.name,'price',p.price,'colors',p.colors,'sizes',p.sizes,
    'product_codes',p.product_codes,'variant_skus',p.variant_skus,'warehouse_linked',p.warehouse_linked);
  IF current_revision IS DISTINCT FROM _revision THEN RAISE EXCEPTION 'تغير المنتج؛ أعد فتح نافذة توربو'; END IF;
  SELECT * INTO saved FROM public.turbo_product_exports WHERE product_id=_product_id AND variant_key=_variant_key FOR UPDATE;
  IF FOUND THEN
    IF saved.state<>'failed' AND (saved.account_key<>_account_key OR saved.code<>_code) THEN RAISE EXCEPTION 'تغير حساب توربو أو كود المتغير؛ راجع الربط السابق أولًا'; END IF;
    IF saved.state='created' THEN RETURN to_jsonb(saved)||jsonb_build_object('outcome','created'); END IF;
    IF saved.state='sending' AND saved.started_at>now()-interval '2 minutes' THEN RETURN to_jsonb(saved)||jsonb_build_object('outcome','busy'); END IF;
    IF saved.state IN ('sending','uncertain') THEN RETURN to_jsonb(saved)||jsonb_build_object('outcome','reconcile'); END IF;
    UPDATE public.turbo_product_exports SET state='sending',code=_code,account_key=_account_key,payload=_payload,attempt_id=gen_random_uuid(),
      started_at=now(),updated_at=now(),error_message=NULL WHERE product_id=_product_id AND variant_key=_variant_key RETURNING * INTO saved;
  ELSE
    IF coalesce(p.variant_warehouse_codes->>_variant_key,'')<>'' THEN RETURN jsonb_build_object('outcome','linked'); END IF;
    INSERT INTO public.turbo_product_exports(product_id,store_id,variant_key,code,account_key,payload,state)
      VALUES (_product_id,_store_id,_variant_key,_code,_account_key,_payload,'sending') RETURNING * INTO saved;
  END IF;
  RETURN to_jsonb(saved)||jsonb_build_object('outcome','claimed');
END; $$;

CREATE FUNCTION public.finish_turbo_product_export(_product_id uuid,_variant_key text,_attempt_id uuid,
  _state text,_remote jsonb DEFAULT NULL,_error text DEFAULT NULL)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE p public.products%ROWTYPE; saved public.turbo_product_exports%ROWTYPE; existing_code text;
BEGIN
  SELECT * INTO p FROM public.products WHERE id=_product_id FOR UPDATE;
  SELECT * INTO saved FROM public.turbo_product_exports WHERE product_id=_product_id AND variant_key=_variant_key FOR UPDATE;
  IF NOT FOUND OR saved.attempt_id<>_attempt_id OR saved.state NOT IN ('sending','uncertain') THEN RETURN false; END IF;
  IF _state NOT IN ('created','uncertain','failed') THEN RAISE EXCEPTION 'حالة ربط غير صحيحة'; END IF;
  IF _state='created' THEN
    IF _remote IS NULL OR NOT (_remote ?& ARRAY['id','code','name','price','weight'])
      OR _remote->>'id' IS NULL OR _remote->>'price' IS NULL OR _remote->>'weight' IS NULL THEN RAISE EXCEPTION 'رد توربو غير مكتمل'; END IF;
    IF p.deleted_at IS NOT NULL OR (_remote->>'id')::bigint<=0 OR _remote->>'code' IS DISTINCT FROM saved.code
      OR _remote->>'name' IS DISTINCT FROM saved.payload->>'name'
      OR (_remote->>'price')::numeric IS DISTINCT FROM (saved.payload->>'price')::numeric
      OR (_remote->>'weight')::numeric IS DISTINCT FROM (saved.payload->>'weight')::numeric THEN RAISE EXCEPTION 'بيانات منتج توربو لا تطابق المحاولة'; END IF;
    existing_code=coalesce(p.variant_warehouse_codes->>_variant_key,'');
    IF existing_code<>'' AND existing_code<>saved.code THEN RAISE EXCEPTION 'تغير ربط المتغير؛ راجع كود توربو'; END IF;
    UPDATE public.products SET variant_warehouse_codes=jsonb_set(coalesce(variant_warehouse_codes,'{}'),ARRAY[_variant_key],to_jsonb(saved.code),true)
      WHERE id=_product_id;
    INSERT INTO public.shipping_warehouse_products(owner_id,store_id,external_id,code,name,stock,synced_at)
      VALUES(p.owner_id,saved.store_id,(_remote->>'id')::bigint,saved.code,_remote->>'name',coalesce((_remote->>'availableQuantity')::int,0),now())
      ON CONFLICT(store_id,external_id) DO UPDATE SET code=excluded.code,name=excluded.name,stock=excluded.stock,synced_at=excluded.synced_at;
  END IF;
  UPDATE public.turbo_product_exports SET state=_state,remote_id=CASE WHEN _state='created' THEN (_remote->>'id')::bigint ELSE remote_id END,
    error_message=left(_error,500),updated_at=now() WHERE product_id=_product_id AND variant_key=_variant_key;
  RETURN true;
END; $$;

CREATE FUNCTION public.protect_turbo_product_export() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF TG_OP='DELETE' THEN
    IF EXISTS(SELECT 1 FROM public.turbo_product_exports WHERE product_id=OLD.id AND state IN ('sending','uncertain')) THEN RAISE EXCEPTION 'تحقق من نتيجة توربو قبل حذف المنتج'; END IF;
    RETURN OLD;
  END IF;
  IF ROW(NEW.name,NEW.price,NEW.colors,NEW.sizes,NEW.product_codes,NEW.variant_skus,NEW.warehouse_linked,NEW.deleted_at,NEW.store_id)
    IS DISTINCT FROM ROW(OLD.name,OLD.price,OLD.colors,OLD.sizes,OLD.product_codes,OLD.variant_skus,OLD.warehouse_linked,OLD.deleted_at,OLD.store_id)
    AND EXISTS(SELECT 1 FROM public.turbo_product_exports WHERE product_id=OLD.id AND state IN ('sending','uncertain'))
    THEN RAISE EXCEPTION 'تحقق من نتيجة إنشاء متغيرات توربو قبل تعديل بيانات المنتج'; END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER protect_turbo_product_export BEFORE UPDATE OR DELETE ON public.products FOR EACH ROW EXECUTE FUNCTION public.protect_turbo_product_export();
REVOKE ALL ON FUNCTION public.claim_turbo_product_export(uuid,uuid,text,text,text,jsonb,jsonb) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.finish_turbo_product_export(uuid,text,uuid,text,jsonb,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_turbo_product_export(uuid,uuid,text,text,text,jsonb,jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.finish_turbo_product_export(uuid,text,uuid,text,jsonb,text) TO service_role;
NOTIFY pgrst,'reload schema';
