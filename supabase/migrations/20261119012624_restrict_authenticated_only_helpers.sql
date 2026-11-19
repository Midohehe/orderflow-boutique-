-- Both helpers are used only after auth.getUser() succeeds in the dashboard.
-- Keep signed-in and server access while removing the anonymous RPC surface.
REVOKE EXECUTE ON FUNCTION public.get_easyorders_enabled() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_easyorders_enabled() TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.seed_store_defaults(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.seed_store_defaults(uuid, uuid) TO authenticated, service_role;
