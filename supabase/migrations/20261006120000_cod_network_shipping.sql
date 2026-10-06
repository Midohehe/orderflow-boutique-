-- Separate provider configuration, credentials, SKU links and durable send attempts.
ALTER TABLE public.orders ADD COLUMN shipping_provider text
  CHECK (shipping_provider IN ('turbo', 'cod_network'));

CREATE TABLE public.store_cod_network_settings (
  store_id uuid PRIMARY KEY REFERENCES public.stores(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT false,
  country_code text NOT NULL DEFAULT 'SA' CHECK (country_code ~ '^[A-Z]{2}$'),
  currency_code text NOT NULL DEFAULT 'SAR' CHECK (currency_code ~ '^[A-Z]{3}$'),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.cod_network_credentials (
  store_id uuid PRIMARY KEY REFERENCES public.stores(id) ON DELETE CASCADE,
  api_token text NOT NULL CHECK (length(api_token) BETWEEN 8 AND 4096)
);
CREATE TABLE public.cod_network_sku_links (
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  variant_key text NOT NULL,
  sku text NOT NULL CHECK (length(sku) BETWEEN 1 AND 200),
  PRIMARY KEY (store_id, product_id, variant_key)
);
CREATE TABLE public.cod_network_shipments (
  order_id uuid PRIMARY KEY REFERENCES public.orders(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  state text NOT NULL CHECK (state IN ('sending','sent','failed','uncertain')),
  attempt_id uuid NOT NULL DEFAULT gen_random_uuid(),
  requested_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  request_payload jsonb NOT NULL,
  remote_id text,
  reference text,
  error_message text,
  started_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, remote_id)
);
ALTER TABLE public.store_cod_network_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cod_network_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cod_network_sku_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cod_network_shipments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.store_cod_network_settings, public.cod_network_credentials,
  public.cod_network_sku_links, public.cod_network_shipments FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.store_cod_network_settings, public.cod_network_credentials,
  public.cod_network_sku_links, public.cod_network_shipments TO service_role;
-- Readable metadata never contains the API token or customer snapshots.
GRANT SELECT ON public.store_cod_network_settings TO authenticated;
CREATE POLICY cod_network_settings_read ON public.store_cod_network_settings
  FOR SELECT TO authenticated USING (public.has_store_access(store_id));

CREATE FUNCTION public.save_cod_network_settings(_store_id uuid, _enabled boolean,
  _country_code text, _currency_code text, _api_token text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.store_cod_network_settings(store_id) VALUES (_store_id)
    ON CONFLICT (store_id) DO NOTHING;
  PERFORM 1 FROM public.store_cod_network_settings WHERE store_id=_store_id FOR UPDATE;
  IF _api_token IS NOT NULL THEN
    INSERT INTO public.cod_network_credentials(store_id,api_token) VALUES (_store_id,_api_token)
      ON CONFLICT (store_id) DO UPDATE SET api_token=excluded.api_token;
  END IF;
  IF _enabled AND NOT EXISTS (SELECT 1 FROM public.cod_network_credentials WHERE store_id=_store_id) THEN
    RAISE EXCEPTION 'أدخل API Token قبل تفعيل الخدمة';
  END IF;
  UPDATE public.store_cod_network_settings SET enabled=_enabled,country_code=_country_code,
    currency_code=_currency_code,updated_at=now() WHERE store_id=_store_id;
END; $$;

CREATE FUNCTION public.claim_cod_network_order(_order_id uuid, _store_id uuid,
  _actor_id uuid, _expected_updated_at timestamptz, _expected_config_updated_at timestamptz, _payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE o public.orders%ROWTYPE; s public.cod_network_shipments%ROWTYPE;
BEGIN
  -- Same lock order as finish and legacy reservation; one provider per order.
  SELECT * INTO o FROM public.orders WHERE id=_order_id AND store_id=_store_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'الطلب غير موجود في هذا المتجر'; END IF;
  PERFORM 1 FROM public.store_cod_network_settings WHERE store_id=_store_id AND enabled
    AND updated_at=_expected_config_updated_at FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'تغيرت إعدادات الربط أو الخدمة غير مفعلة؛ أعد فتح مراجعة الإرسال'; END IF;
  SELECT * INTO s FROM public.cod_network_shipments WHERE order_id=_order_id;
  IF s.state='sent' THEN RETURN jsonb_build_object('state','sent','reference',s.reference); END IF;
  IF s.state IN ('sending','uncertain') THEN
    RETURN jsonb_build_object('state','uncertain','attempt_id',s.attempt_id);
  END IF;
  IF o.is_deleted OR o.locked_insufficient_balance OR o.status NOT IN ('pending','processing')
    OR o.shipping_provider IS NOT NULL OR o.shipping_reference IS NOT NULL OR o.shipping_id IS NOT NULL
    OR EXISTS (SELECT 1 FROM public.courier_orders WHERE order_id=o.id AND state IN ('assigned','delivered')) THEN
    RAISE EXCEPTION 'الطلب مقفل أو مسند لشركة شحن أو مندوب، أو حالته غير متاحة للإرسال';
  END IF;
  IF o.updated_at IS DISTINCT FROM _expected_updated_at THEN RAISE EXCEPTION 'تغير الطلب؛ أعد فتح مراجعة الإرسال'; END IF;
  INSERT INTO public.cod_network_shipments(order_id,store_id,state,requested_by,request_payload)
    VALUES (_order_id,_store_id,'sending',_actor_id,_payload)
    ON CONFLICT (order_id) DO UPDATE SET state='sending',attempt_id=gen_random_uuid(),
      requested_by=excluded.requested_by,request_payload=excluded.request_payload,
      remote_id=NULL,reference=NULL,error_message=NULL,started_at=now(),updated_at=now()
    RETURNING * INTO s;
  UPDATE public.orders SET shipping_provider='cod_network',shipping_error=NULL WHERE id=_order_id;
  RETURN jsonb_build_object('state','claimed','attempt_id',s.attempt_id);
END; $$;

CREATE FUNCTION public.finish_cod_network_order(_order_id uuid, _attempt_id uuid,
  _state text, _remote_id text DEFAULT NULL, _reference text DEFAULT NULL, _error text DEFAULT NULL)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s public.cod_network_shipments%ROWTYPE;
BEGIN
  PERFORM 1 FROM public.orders WHERE id=_order_id FOR UPDATE;
  SELECT * INTO s FROM public.cod_network_shipments WHERE order_id=_order_id FOR UPDATE;
  IF NOT FOUND OR s.attempt_id<>_attempt_id OR s.state NOT IN ('sending','uncertain') THEN RETURN false; END IF;
  IF _state NOT IN ('sent','failed','uncertain') THEN RAISE EXCEPTION 'Invalid send result'; END IF;
  IF _state='sent' AND (NULLIF(_remote_id,'') IS NULL OR NULLIF(_reference,'') IS NULL) THEN RAISE EXCEPTION 'Missing remote order identifier'; END IF;
  UPDATE public.cod_network_shipments SET state=_state,remote_id=_remote_id,reference=_reference,
    error_message=left(_error,600),updated_at=now() WHERE order_id=_order_id;
  IF _state='sent' THEN
    UPDATE public.orders SET shipping_provider='cod_network',shipped_to_company=true,
      shipping_reference=_reference,shipping_id=NULL,status='shipped',shipping_error=NULL,
      carrier_status='COD_NETWORK_NEW',carrier_status_updated_at=now() WHERE id=_order_id;
  ELSE
    UPDATE public.orders SET shipping_provider=CASE WHEN _state='failed' THEN NULL ELSE 'cod_network' END,
      shipping_error=left(_error,600) WHERE id=_order_id;
  END IF;
  RETURN true;
END; $$;

-- Reserve legacy sends before making their external request, so they cannot race
-- a COD Network send. Existing Turbo retries keep their existing behavior.
CREATE FUNCTION public.reserve_legacy_shipping_order(_order_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE provider text;
BEGIN
  SELECT shipping_provider INTO provider FROM public.orders WHERE id=_order_id FOR UPDATE;
  IF NOT FOUND OR provider='cod_network' OR EXISTS (
    SELECT 1 FROM public.cod_network_shipments WHERE order_id=_order_id AND state IN ('sending','uncertain','sent')
  ) THEN RETURN false; END IF;
  UPDATE public.orders SET shipping_provider='turbo' WHERE id=_order_id;
  RETURN true;
END; $$;

-- Freeze the data used by an in-flight request. Finalization changes its durable
-- state first, then updates the order in the same transaction.
CREATE FUNCTION public.protect_cod_network_order() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.cod_network_shipments WHERE order_id=OLD.id AND state IN ('sending','uncertain')) THEN
    IF TG_OP='DELETE' THEN RAISE EXCEPTION 'تحقق من إرسال سعودي نيتورك قبل حذف الطلب'; END IF;
    IF ROW(NEW.store_id,NEW.status,NEW.is_deleted,NEW.price,NEW.shipping_fee,NEW.quantity,NEW.product_id,
      NEW.customer_name,NEW.phone,NEW.address,NEW.city,NEW.governorate,NEW.currency_code,
      NEW.selected_color,NEW.selected_size,NEW.selected_product_code)
      IS DISTINCT FROM ROW(OLD.store_id,OLD.status,OLD.is_deleted,OLD.price,OLD.shipping_fee,OLD.quantity,OLD.product_id,
      OLD.customer_name,OLD.phone,OLD.address,OLD.city,OLD.governorate,OLD.currency_code,
      OLD.selected_color,OLD.selected_size,OLD.selected_product_code) THEN
      RAISE EXCEPTION 'تحقق من إرسال سعودي نيتورك قبل تعديل بيانات الطلب';
    END IF;
  END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER protect_cod_network_order BEFORE UPDATE OR DELETE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.protect_cod_network_order();

-- Serialize item edits with claiming the parent order. Advance its revision so
-- a review cannot silently send changed quantities or products.
CREATE FUNCTION public.protect_cod_network_items() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE parent_id uuid;
BEGIN
  FOR parent_id IN SELECT id FROM public.orders WHERE id IN (
    CASE WHEN TG_OP<>'INSERT' THEN OLD.order_id END,
    CASE WHEN TG_OP<>'DELETE' THEN NEW.order_id END
  ) ORDER BY id FOR UPDATE LOOP
    IF EXISTS (SELECT 1 FROM public.cod_network_shipments WHERE order_id=parent_id AND state IN ('sending','uncertain')) THEN
      RAISE EXCEPTION 'تحقق من إرسال سعودي نيتورك قبل تعديل منتجات الطلب';
    END IF;
    UPDATE public.orders o SET updated_at=clock_timestamp() WHERE o.id=parent_id
      AND EXISTS (SELECT 1 FROM public.store_cod_network_settings c WHERE c.store_id=o.store_id AND c.enabled);
  END LOOP;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER protect_cod_network_items BEFORE INSERT OR UPDATE OR DELETE ON public.order_items
  FOR EACH ROW EXECUTE FUNCTION public.protect_cod_network_items();

REVOKE ALL ON FUNCTION public.save_cod_network_settings(uuid,boolean,text,text,text),
  public.claim_cod_network_order(uuid,uuid,uuid,timestamptz,timestamptz,jsonb),
  public.finish_cod_network_order(uuid,uuid,text,text,text,text),
  public.reserve_legacy_shipping_order(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.save_cod_network_settings(uuid,boolean,text,text,text),
  public.claim_cod_network_order(uuid,uuid,uuid,timestamptz,timestamptz,jsonb),
  public.finish_cod_network_order(uuid,uuid,text,text,text,text),
  public.reserve_legacy_shipping_order(uuid) TO service_role;
NOTIFY pgrst, 'reload schema';
