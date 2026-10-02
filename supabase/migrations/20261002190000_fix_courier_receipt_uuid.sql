-- Keep the settlement receipt reference as UUID, matching safe_movements.reference_id.
DO $$
DECLARE definition text;
BEGIN
 SELECT pg_get_functiondef('public.process_courier_orders(uuid,uuid[],text,uuid)'::regprocedure) INTO definition;
 IF position('receipt::text' IN definition)>0 THEN
   EXECUTE replace(definition,'receipt::text','receipt');
 END IF;
END $$;
NOTIFY pgrst,'reload schema';
