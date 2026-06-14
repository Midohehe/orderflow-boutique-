-- Expose strict stock policy to anonymous storefront visitors (landing pages).
CREATE OR REPLACE FUNCTION public.get_owner_stock_policy(_owner_id uuid)
RETURNS TABLE(strict_stock_enabled boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(p.strict_stock_enabled, false)
  FROM public.profiles p
  WHERE p.user_id = _owner_id
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_owner_stock_policy(uuid) TO anon, authenticated;
