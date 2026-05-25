
-- 1) Profiles: remove member access to owner profile (which exposes webhook_token, easyorders_api_key)
DROP POLICY IF EXISTS "Owner read profiles" ON public.profiles;
CREATE POLICY "Owner read profiles"
ON public.profiles FOR SELECT
USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));

-- Safe helper for sub-users to load parent profile (no secrets)
CREATE OR REPLACE FUNCTION public.get_owner_profile_safe(_owner_id uuid)
RETURNS TABLE(
  id uuid,
  user_id uuid,
  username text,
  full_name text,
  subscription_starts_at timestamptz,
  subscription_ends_at timestamptz,
  is_active boolean
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.user_id, p.username, p.full_name,
         p.subscription_starts_at, p.subscription_ends_at, p.is_active
  FROM public.profiles p
  WHERE p.user_id = _owner_id
    AND (
      auth.uid() = _owner_id
      OR has_role(auth.uid(), 'admin'::app_role)
      OR EXISTS (
        SELECT 1 FROM public.store_members sm
        WHERE sm.owner_id = _owner_id AND sm.member_user_id = auth.uid()
      )
    )
  LIMIT 1;
$$;

REVOKE EXECUTE ON FUNCTION public.get_owner_profile_safe(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_owner_profile_safe(uuid) TO authenticated;

-- 2) Products: hide purchase_price from unauthenticated visitors
REVOKE SELECT (purchase_price) ON public.products FROM anon;

-- 3) Landing page templates: remove public read
DROP POLICY IF EXISTS "Public read landing_page_templates" ON public.landing_page_templates;
