-- Edge endpoint uses the service role, which has no default grants on these tables.
GRANT SELECT ON public.couriers TO service_role;
GRANT SELECT, INSERT ON public.courier_accounts TO service_role;
NOTIFY pgrst,'reload schema';
