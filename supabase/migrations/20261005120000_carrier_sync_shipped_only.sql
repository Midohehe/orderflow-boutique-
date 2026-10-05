-- Only Wasla's shipped (جاري التوصيل) orders are eligible for carrier sync.
ALTER TABLE public.carrier_sync_jobs ADD COLUMN skipped integer NOT NULL DEFAULT 0 CHECK (skipped >= 0);
ALTER TABLE public.carrier_sync_jobs DROP CONSTRAINT carrier_sync_jobs_check;
ALTER TABLE public.carrier_sync_jobs ADD CONSTRAINT carrier_sync_jobs_check
  CHECK (processed = updated + failed + skipped AND processed <= total);

CREATE OR REPLACE FUNCTION public.start_carrier_sync(_store_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE j public.carrier_sync_jobs; ids uuid[];
BEGIN
  PERFORM 1 FROM public.stores WHERE id = _store_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Store not found'; END IF;
  SELECT * INTO j FROM public.carrier_sync_jobs WHERE store_id = _store_id;
  IF FOUND AND j.state = 'running' THEN RETURN to_jsonb(j) - 'order_ids' - 'lease_id'; END IF;
  IF j.updated_at > now() - interval '30 seconds' THEN RAISE EXCEPTION 'انتظر 30 ثانية قبل بدء مزامنة جديدة'; END IF;
  SELECT coalesce(array_agg(id ORDER BY id), '{}'::uuid[]) INTO ids
  FROM public.orders WHERE store_id = _store_id AND status = 'shipped'
    AND shipping_id IS NOT NULL AND is_deleted = false;
  INSERT INTO public.carrier_sync_jobs(store_id, order_ids, total, state)
  VALUES (_store_id, ids, cardinality(ids), CASE WHEN cardinality(ids)=0 THEN 'completed' ELSE 'running' END)
  ON CONFLICT (store_id) DO UPDATE SET id=gen_random_uuid(), order_ids=EXCLUDED.order_ids,
    total=EXCLUDED.total, processed=0, updated=0, failed=0, skipped=0, state=EXCLUDED.state,
    codes='[]', errors='[]', last_error=NULL, lease_id=NULL, locked_until=NULL, started_at=now(), updated_at=now()
  RETURNING * INTO j;
  UPDATE public.stores SET carrier_last_sync_at=now() WHERE id=_store_id;
  RETURN to_jsonb(j) - 'order_ids' - 'lease_id';
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_carrier_sync_batch(_store_id uuid, _job_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE j public.carrier_sync_jobs; pending_ids uuid[];
BEGIN
  SELECT * INTO j FROM public.carrier_sync_jobs WHERE store_id=_store_id AND id=_job_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'المزامنة غير موجودة؛ أعد تحميل الصفحة'; END IF;
  IF j.state='completed' OR j.locked_until > now() THEN
    RETURN jsonb_build_object('busy', j.state <> 'completed', 'job', to_jsonb(j) - 'order_ids' - 'lease_id');
  END IF;
  -- Also narrow snapshots created by the old version, without losing completed progress.
  -- Never change the list while another worker owns a live lease.
  SELECT coalesce(array_agg(item.id ORDER BY item.position), '{}'::uuid[]) INTO pending_ids
  FROM unnest(j.order_ids[j.processed+1:j.total]) WITH ORDINALITY AS item(id, position)
  JOIN public.orders o ON o.id=item.id AND o.store_id=_store_id
  WHERE o.status='shipped' AND o.is_deleted=false AND o.shipping_id IS NOT NULL;
  UPDATE public.carrier_sync_jobs SET order_ids=j.order_ids[1:j.processed] || pending_ids,
    total=j.processed+cardinality(pending_ids),
    state=CASE WHEN cardinality(pending_ids)=0 THEN 'completed' ELSE 'running' END,
    lease_id=CASE WHEN cardinality(pending_ids)=0 THEN NULL ELSE gen_random_uuid() END,
    locked_until=CASE WHEN cardinality(pending_ids)=0 THEN NULL ELSE now()+interval '90 seconds' END,
    last_error=NULL, updated_at=now()
  WHERE store_id=_store_id RETURNING * INTO j;
  RETURN jsonb_build_object('busy', false, 'lease_id', j.lease_id,
    'order_ids', j.order_ids[j.processed+1:least(j.processed+5,j.total)],
    'job', to_jsonb(j) - 'order_ids' - 'lease_id');
END;
$$;

-- The default keeps requests from an already-running older Edge worker compatible.
DROP FUNCTION public.finish_carrier_sync_batch(uuid,uuid,uuid,integer,integer,jsonb,jsonb);
CREATE FUNCTION public.finish_carrier_sync_batch(_store_id uuid, _job_id uuid, _lease_id uuid,
  _updated integer, _failed integer, _codes jsonb, _errors jsonb, _skipped integer DEFAULT 0) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE j public.carrier_sync_jobs; batch_size integer;
BEGIN
  SELECT * INTO j FROM public.carrier_sync_jobs WHERE store_id=_store_id AND id=_job_id FOR UPDATE;
  IF NOT FOUND OR j.lease_id IS DISTINCT FROM _lease_id OR _lease_id IS NULL THEN
    RAISE EXCEPTION 'انتهت صلاحية الدفعة؛ أعد الاستكمال لقراءة التقدّم المحفوظ';
  END IF;
  batch_size := least(5, j.total-j.processed);
  IF _updated IS NULL OR _failed IS NULL OR _skipped IS NULL OR _updated < 0 OR _failed < 0 OR _skipped < 0
    OR _updated+_failed+_skipped <> batch_size THEN RAISE EXCEPTION 'Invalid batch counters'; END IF;
  UPDATE public.carrier_sync_jobs SET processed=processed+batch_size, updated=updated+_updated, failed=failed+_failed, skipped=skipped+_skipped,
    state=CASE WHEN processed+batch_size=total THEN 'completed' ELSE 'running' END,
    codes=_codes, errors=_errors, lease_id=NULL, locked_until=NULL, updated_at=now()
  WHERE store_id=_store_id RETURNING * INTO j;
  RETURN to_jsonb(j) - 'order_ids' - 'lease_id';
END;
$$;
REVOKE ALL ON FUNCTION public.start_carrier_sync(uuid), public.claim_carrier_sync_batch(uuid,uuid),
  public.finish_carrier_sync_batch(uuid,uuid,uuid,integer,integer,jsonb,jsonb,integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.start_carrier_sync(uuid), public.claim_carrier_sync_batch(uuid,uuid),
  public.finish_carrier_sync_batch(uuid,uuid,uuid,integer,integer,jsonb,jsonb,integer) TO service_role;
NOTIFY pgrst, 'reload schema';
