-- These RPCs return merchant analytics, financial data, or mutate settlement
-- state. They are dashboard-only and must never be callable with the anon key.
DO $migration$
DECLARE
  fn regprocedure;
BEGIN
  FOREACH fn IN ARRAY ARRAY[
    'public.cash_flow_report(uuid,date,date)'::regprocedure,
    'public.count_missed_orders_for_store(uuid)'::regprocedure,
    'public.get_merchant_plan(uuid)'::regprocedure,
    'public.get_offer_stats_summary(uuid)'::regprocedure,
    'public.get_store_analytics(uuid,integer,text)'::regprocedure,
    'public.list_carrier_mappings_for_store(uuid,uuid)'::regprocedure,
    'public.list_missed_orders_for_store(uuid,integer,integer)'::regprocedure,
    'public.merchant_usage(uuid)'::regprocedure,
    'public.order_status_dwell_report(uuid,date,date)'::regprocedure,
    'public.orders_delivery_stats_summary(uuid,uuid,text)'::regprocedure,
    'public.orders_shipped_carrier_counts(uuid)'::regprocedure,
    'public.orders_shipped_carrier_counts(uuid,uuid)'::regprocedure,
    'public.orders_status_counts(uuid)'::regprocedure,
    'public.profit_loss_report(uuid,date,date)'::regprocedure,
    'public.resolve_merchant_owner(uuid)'::regprocedure,
    'public.settle_orders_into_safe(uuid[],uuid,numeric,text)'::regprocedure
  ]
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', fn);
  END LOOP;
END;
$migration$;
