-- ============ profiles ============
DROP POLICY IF EXISTS "Public read profiles" ON public.profiles;

CREATE POLICY "Owner read profiles"
ON public.profiles FOR SELECT
USING (
  auth.uid() = user_id
  OR has_role(auth.uid(), 'admin'::app_role)
  OR is_member_of(user_id)
);

CREATE OR REPLACE FUNCTION public.get_public_profile_by_username(_username text)
RETURNS TABLE(user_id uuid, is_active boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT user_id, is_active
  FROM public.profiles
  WHERE username = _username
  LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION public.get_public_profile_by_username(text) TO anon, authenticated;

-- ============ products: hide purchase_price ============
REVOKE SELECT (purchase_price) ON public.products FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_owner_product_costs(_product_ids uuid[] DEFAULT NULL)
RETURNS TABLE(id uuid, purchase_price numeric)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.purchase_price
  FROM public.products p
  WHERE (is_member_of(p.owner_id) OR has_role(auth.uid(), 'admin'::app_role))
    AND (_product_ids IS NULL OR p.id = ANY(_product_ids));
$$;
GRANT EXECUTE ON FUNCTION public.get_owner_product_costs(uuid[]) TO authenticated;

-- ============ pixel_settings ============
DROP POLICY IF EXISTS "Public read pixel_settings" ON public.pixel_settings;

CREATE OR REPLACE FUNCTION public.get_pixel_settings_public(_owner_id uuid, _store_id uuid DEFAULT NULL)
RETURNS TABLE(
  facebook_pixel_id text,
  facebook_enabled boolean,
  tiktok_pixel_id text,
  tiktok_enabled boolean,
  google_analytics_id text,
  google_enabled boolean,
  snapchat_pixel_id text,
  snapchat_enabled boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT facebook_pixel_id, facebook_enabled, tiktok_pixel_id, tiktok_enabled,
         google_analytics_id, google_enabled, snapchat_pixel_id, snapchat_enabled
  FROM public.pixel_settings
  WHERE owner_id = _owner_id
    AND (_store_id IS NULL OR store_id IS NOT DISTINCT FROM _store_id)
  LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION public.get_pixel_settings_public(uuid, uuid) TO anon, authenticated;

-- ============ store_member_stores ============
DROP POLICY IF EXISTS "Public read sms" ON public.store_member_stores;

CREATE POLICY "Scoped read store_member_stores"
ON public.store_member_stores FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.store_members sm
    WHERE sm.id = store_member_stores.member_id
      AND (sm.owner_id = auth.uid() OR sm.member_user_id = auth.uid())
  )
);

-- ============ search_path for email helper fns + revoke anon execute ============
CREATE OR REPLACE FUNCTION public.delete_email(queue_name text, message_id bigint)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pgmq
AS $function$
BEGIN
  RETURN pgmq.delete(queue_name, message_id);
EXCEPTION WHEN undefined_table THEN
  RETURN FALSE;
END;
$function$;

CREATE OR REPLACE FUNCTION public.move_to_dlq(source_queue text, dlq_name text, message_id bigint, payload jsonb)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pgmq
AS $function$
DECLARE new_id BIGINT;
BEGIN
  SELECT pgmq.send(dlq_name, payload) INTO new_id;
  PERFORM pgmq.delete(source_queue, message_id);
  RETURN new_id;
EXCEPTION WHEN undefined_table THEN
  BEGIN PERFORM pgmq.create(dlq_name); EXCEPTION WHEN OTHERS THEN NULL; END;
  SELECT pgmq.send(dlq_name, payload) INTO new_id;
  BEGIN PERFORM pgmq.delete(source_queue, message_id); EXCEPTION WHEN undefined_table THEN NULL; END;
  RETURN new_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.read_email_batch(queue_name text, batch_size integer, vt integer)
RETURNS TABLE(msg_id bigint, read_ct integer, message jsonb)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pgmq
AS $function$
BEGIN
  RETURN QUERY SELECT r.msg_id, r.read_ct, r.message FROM pgmq.read(queue_name, vt, batch_size) r;
EXCEPTION WHEN undefined_table THEN
  PERFORM pgmq.create(queue_name);
  RETURN;
END;
$function$;

CREATE OR REPLACE FUNCTION public.enqueue_email(queue_name text, payload jsonb)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pgmq
AS $function$
BEGIN
  RETURN pgmq.send(queue_name, payload);
EXCEPTION WHEN undefined_table THEN
  PERFORM pgmq.create(queue_name);
  RETURN pgmq.send(queue_name, payload);
END;
$function$;

-- Revoke execute on internal/admin-only SECURITY DEFINER fns from anon (and authenticated where appropriate)
REVOKE EXECUTE ON FUNCTION public.delete_email(text, bigint) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.generate_recharge_cards(numeric, integer, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.next_skus_for_store(uuid, integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.redeem_card(text) FROM PUBLIC, anon;