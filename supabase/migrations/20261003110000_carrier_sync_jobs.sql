-- One resumable snapshot per store. Only the authenticated Edge handler uses these RPCs.
CREATE TABLE public.carrier_sync_jobs (
  store_id uuid PRIMARY KEY REFERENCES public.stores(id) ON DELETE CASCADE,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  order_ids uuid[] NOT NULL,
  total integer NOT NULL,
  processed integer NOT NULL DEFAULT 0,
  updated integer NOT NULL DEFAULT 0,
  failed integer NOT NULL DEFAULT 0,
  state text NOT NULL DEFAULT 'running' CHECK (state IN ('running', 'completed')),
  codes jsonb NOT NULL DEFAULT '[]',
  errors jsonb NOT NULL DEFAULT '[]',
  last_error text,
  lease_id uuid,
  locked_until timestamptz,
  started_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (processed = updated + failed AND processed <= total)
);
ALTER TABLE public.carrier_sync_jobs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.carrier_sync_jobs FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.carrier_sync_jobs TO service_role;

CREATE FUNCTION public.start_carrier_sync(_store_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE j public.carrier_sync_jobs; ids uuid[];
BEGIN
  PERFORM 1 FROM public.stores WHERE id = _store_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Store not found'; END IF;
  SELECT * INTO j FROM public.carrier_sync_jobs WHERE store_id = _store_id;
  IF FOUND AND j.state = 'running' THEN RETURN to_jsonb(j) - 'order_ids' - 'lease_id'; END IF;
  IF j.updated_at > now() - interval '30 seconds' THEN RAISE EXCEPTION 'انتظر 30 ثانية قبل بدء مزامنة جديدة'; END IF;
  SELECT coalesce(array_agg(id ORDER BY id), '{}'::uuid[]) INTO ids
  FROM public.orders WHERE store_id = _store_id AND shipping_id IS NOT NULL AND is_deleted = false;
  INSERT INTO public.carrier_sync_jobs(store_id, order_ids, total, state)
  VALUES (_store_id, ids, cardinality(ids), CASE WHEN cardinality(ids)=0 THEN 'completed' ELSE 'running' END)
  ON CONFLICT (store_id) DO UPDATE SET id=gen_random_uuid(), order_ids=EXCLUDED.order_ids,
    total=EXCLUDED.total, processed=0, updated=0, failed=0, state=EXCLUDED.state,
    codes='[]', errors='[]', last_error=NULL, lease_id=NULL, locked_until=NULL, started_at=now(), updated_at=now()
  RETURNING * INTO j;
  UPDATE public.stores SET carrier_last_sync_at=now() WHERE id=_store_id;
  RETURN to_jsonb(j) - 'order_ids' - 'lease_id';
END;
$$;

CREATE FUNCTION public.claim_carrier_sync_batch(_store_id uuid, _job_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE j public.carrier_sync_jobs;
BEGIN
  SELECT * INTO j FROM public.carrier_sync_jobs WHERE store_id=_store_id AND id=_job_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'المزامنة غير موجودة؛ أعد تحميل الصفحة'; END IF;
  IF j.state='completed' OR j.locked_until > now() THEN
    RETURN jsonb_build_object('busy', j.state <> 'completed', 'job', to_jsonb(j) - 'order_ids' - 'lease_id');
  END IF;
  UPDATE public.carrier_sync_jobs SET lease_id=gen_random_uuid(), locked_until=now()+interval '90 seconds', last_error=NULL
  WHERE store_id=_store_id RETURNING * INTO j;
  RETURN jsonb_build_object('busy', false, 'lease_id', j.lease_id,
    'order_ids', j.order_ids[j.processed+1:least(j.processed+5,j.total)],
    'job', to_jsonb(j) - 'order_ids' - 'lease_id');
END;
$$;

CREATE FUNCTION public.finish_carrier_sync_batch(_store_id uuid, _job_id uuid, _lease_id uuid,
  _updated integer, _failed integer, _codes jsonb, _errors jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE j public.carrier_sync_jobs; batch_size integer;
BEGIN
  SELECT * INTO j FROM public.carrier_sync_jobs WHERE store_id=_store_id AND id=_job_id FOR UPDATE;
  IF NOT FOUND OR j.lease_id IS DISTINCT FROM _lease_id OR _lease_id IS NULL THEN
    RAISE EXCEPTION 'انتهت صلاحية الدفعة؛ أعد الاستكمال لقراءة التقدّم المحفوظ';
  END IF;
  batch_size := least(5, j.total-j.processed);
  IF _updated < 0 OR _failed < 0 OR _updated+_failed <> batch_size THEN RAISE EXCEPTION 'Invalid batch counters'; END IF;
  UPDATE public.carrier_sync_jobs SET processed=processed+batch_size, updated=updated+_updated, failed=failed+_failed,
    state=CASE WHEN processed+batch_size=total THEN 'completed' ELSE 'running' END,
    codes=_codes, errors=_errors, lease_id=NULL, locked_until=NULL, updated_at=now()
  WHERE store_id=_store_id RETURNING * INTO j;
  RETURN to_jsonb(j) - 'order_ids' - 'lease_id';
END;
$$;
REVOKE ALL ON FUNCTION public.start_carrier_sync(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_carrier_sync_batch(uuid,uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.finish_carrier_sync_batch(uuid,uuid,uuid,integer,integer,jsonb,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.start_carrier_sync(uuid), public.claim_carrier_sync_batch(uuid,uuid),
  public.finish_carrier_sync_batch(uuid,uuid,uuid,integer,integer,jsonb,jsonb) TO service_role;
