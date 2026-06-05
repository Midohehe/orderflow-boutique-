-- The whatsapp_shares table was created without GRANTs for service_role, so the
-- whatsapp-share edge function (service role) failed with
-- "permission denied for table whatsapp_shares" on insert/upsert. Grant it.
GRANT ALL ON public.whatsapp_shares TO service_role;
