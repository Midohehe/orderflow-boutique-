-- The carrier requires drop products to be created as leads, not direct orders.
ALTER TABLE public.cod_network_shipments ADD COLUMN resource_type text NOT NULL DEFAULT 'order'
  CHECK (resource_type IN ('order','lead'));
ALTER TABLE public.cod_network_shipments DROP CONSTRAINT cod_network_shipments_store_id_remote_id_key;
ALTER TABLE public.cod_network_shipments ADD CONSTRAINT cod_network_shipments_store_resource_remote_key
  UNIQUE(store_id,resource_type,remote_id);

-- Persist the destination BEFORE the external POST, so timeouts reconcile through
-- the correct endpoint. Only a claimed attempt may switch; no guard is released.
CREATE FUNCTION public.set_cod_network_lead_attempt(_order_id uuid,_attempt_id uuid,_payload jsonb)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  PERFORM 1 FROM public.orders WHERE id=_order_id FOR UPDATE;
  UPDATE public.cod_network_shipments SET resource_type='lead',request_payload=_payload,updated_at=now()
    WHERE order_id=_order_id AND attempt_id=_attempt_id AND state='sending';
  RETURN FOUND;
END; $$;
REVOKE ALL ON FUNCTION public.set_cod_network_lead_attempt(uuid,uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.set_cod_network_lead_attempt(uuid,uuid,jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.finish_cod_network_order(_order_id uuid, _attempt_id uuid,
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
      carrier_status=CASE WHEN s.resource_type='lead' THEN 'COD_NETWORK_LEAD_NEW' ELSE 'COD_NETWORK_NEW' END,
      carrier_status_updated_at=now() WHERE id=_order_id;
  ELSE
    UPDATE public.orders SET shipping_provider=CASE WHEN _state='failed' THEN NULL ELSE 'cod_network' END,
      shipping_error=left(_error,600) WHERE id=_order_id;
  END IF;
  RETURN true;
END; $$;
NOTIFY pgrst,'reload schema';
