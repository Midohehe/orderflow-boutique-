-- Reserve the order and persist the chosen endpoint in one transaction, before
-- any carrier POST. Keep the original RPC for clients/functions from older releases.
CREATE FUNCTION public.claim_cod_network_dispatch(_order_id uuid, _store_id uuid,
  _actor_id uuid, _expected_updated_at timestamptz, _expected_config_updated_at timestamptz,
  _payload jsonb, _resource_type text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE result jsonb; saved_type text;
BEGIN
  IF _resource_type IS NULL OR _resource_type NOT IN ('order', 'lead') THEN
    RAISE EXCEPTION 'اختر نوع الإرسال: Leads أو Orders';
  END IF;

  -- The existing reservation holds the parent order lock until this transaction
  -- finishes, and enforces store/config/revision and duplicate/carrier guards.
  result := public.claim_cod_network_order(_order_id, _store_id, _actor_id,
    _expected_updated_at, _expected_config_updated_at, _payload);
  IF result->>'state' = 'claimed' THEN
    UPDATE public.cod_network_shipments
      SET resource_type = _resource_type, updated_at = now()
      WHERE order_id = _order_id AND store_id = _store_id
        AND attempt_id = (result->>'attempt_id')::uuid AND state = 'sending';
    IF NOT FOUND THEN RAISE EXCEPTION 'تعذر حفظ نوع الإرسال'; END IF;
  END IF;
  SELECT resource_type INTO saved_type FROM public.cod_network_shipments
    WHERE order_id = _order_id AND store_id = _store_id;
  RETURN result || jsonb_build_object('resource_type', saved_type);
END; $$;

REVOKE ALL ON FUNCTION public.claim_cod_network_dispatch(uuid,uuid,uuid,timestamptz,timestamptz,jsonb,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_cod_network_dispatch(uuid,uuid,uuid,timestamptz,timestamptz,jsonb,text) TO service_role;
NOTIFY pgrst, 'reload schema';
