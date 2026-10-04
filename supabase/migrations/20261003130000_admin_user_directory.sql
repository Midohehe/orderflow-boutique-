-- A paginated, explicitly projected directory. Auth data never leaves this admin-only RPC.
CREATE OR REPLACE FUNCTION public.admin_user_directory(
  _search text DEFAULT '', _kind text DEFAULT 'all', _status text DEFAULT 'all',
  _link text DEFAULT 'all', _sort text DEFAULT 'newest', _page integer DEFAULT 1,
  _page_size integer DEFAULT 25, _email_status text DEFAULT 'all'
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE result jsonb; page_size integer := greatest(1, least(coalesce(_page_size,25),100));
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'admin') THEN
    RAISE EXCEPTION 'هذه البيانات متاحة للسوبر أدمن فقط' USING ERRCODE='42501';
  END IF;
  IF _kind NOT IN ('all','admin','owner','staff','courier','unassigned')
    OR _status NOT IN ('all','active','disabled','unconfirmed')
    OR _link NOT IN ('all','linked','unlinked') OR _sort NOT IN ('newest','oldest','last_sign_in')
    OR _email_status NOT IN ('all','confirmed','unconfirmed','not_applicable') THEN
    RAISE EXCEPTION 'فلتر غير صالح';
  END IF;
  WITH relationships AS MATERIALIZED (
    SELECT s.owner_id user_id, s.id store_id, 'owner'::text relation, NULL::text group_name FROM public.stores s
    UNION ALL
    SELECT m.member_user_id, s.id, 'staff', g.name
    FROM public.store_members m JOIN public.store_member_stores ms ON ms.member_id=m.id
    JOIN public.stores s ON s.id=ms.store_id AND s.owner_id=m.owner_id
    LEFT JOIN public.permission_groups g ON g.id=m.group_id
    UNION ALL
    SELECT a.user_id, c.store_id, 'courier', NULL
    FROM public.courier_accounts a JOIN public.couriers c ON c.id=a.courier_id
  ), links AS MATERIALIZED (
    SELECT r.user_id, jsonb_agg(jsonb_build_object(
      'id',s.id,'name',s.name,'slug',s.slug,'owner_id',s.owner_id,
      'owner_name',coalesce(p.full_name,p.username),'relation',r.relation,'group_name',r.group_name
    ) ORDER BY s.name,s.id,r.relation) stores,
    string_agg(concat_ws(' ',s.name,s.slug,p.full_name,p.username),' ') store_search
    FROM relationships r JOIN public.stores s ON s.id=r.store_id
    LEFT JOIN public.profiles p ON p.user_id=s.owner_id GROUP BY r.user_id
  ), base AS MATERIALIZED (
    SELECT u.id user_id, coalesce(a.username,p.username,nullif(u.raw_user_meta_data->>'username',''),split_part(u.email,'@',1),'') username,
      coalesce(c.name,m.display_name,p.full_name,nullif(u.raw_user_meta_data->>'full_name','')) full_name,
      CASE WHEN u.email LIKE '%@couriers.wasla.invalid' THEN NULL ELSE u.email END email,
      left(coalesce(nullif(trim(u.raw_user_meta_data->>'contact_phone'),''),nullif(trim(c.phone),'')),32) phone,
      u.created_at, u.last_sign_in_at, u.email_confirmed_at,
      CASE WHEN public.has_role(u.id,'admin') THEN 'admin' WHEN a.user_id IS NOT NULL THEN 'courier'
        WHEN m.id IS NOT NULL THEN 'staff' WHEN EXISTS(SELECT 1 FROM public.stores s WHERE s.owner_id=u.id) THEN 'owner'
        ELSE 'unassigned' END kind,
      CASE WHEN u.banned_until > now() OR p.is_active=false OR c.active=false OR parent.is_active=false THEN 'disabled'
        WHEN u.email_confirmed_at IS NULL THEN 'unconfirmed' ELSE 'active' END status,
      p.user_id IS NOT NULL has_profile, p.is_active profile_active, g.name permission_group,
      coalesce(l.stores,'[]'::jsonb) stores, coalesce(l.store_search,'') store_search
    FROM auth.users u LEFT JOIN public.profiles p ON p.user_id=u.id
    LEFT JOIN public.store_members m ON m.member_user_id=u.id
    LEFT JOIN public.permission_groups g ON g.id=m.group_id
    LEFT JOIN public.courier_accounts a ON a.user_id=u.id
    LEFT JOIN public.couriers c ON c.id=a.courier_id
    LEFT JOIN public.stores cs ON cs.id=c.store_id
    LEFT JOIN public.profiles parent ON parent.user_id=coalesce(m.owner_id,cs.owner_id)
    LEFT JOIN links l ON l.user_id=u.id
    WHERE u.deleted_at IS NULL
  ), filtered AS MATERIALIZED (
    SELECT * FROM base WHERE (_kind='all' OR kind=_kind) AND (_status='all' OR status=_status)
    AND (_email_status='all' OR (_email_status='confirmed' AND email IS NOT NULL AND email_confirmed_at IS NOT NULL)
      OR (_email_status='unconfirmed' AND email IS NOT NULL AND email_confirmed_at IS NULL)
      OR (_email_status='not_applicable' AND email IS NULL))
    AND (_link='all' OR (_link='linked' AND jsonb_array_length(stores)>0) OR (_link='unlinked' AND jsonb_array_length(stores)=0))
    AND (coalesce(trim(_search),'')='' OR strpos(lower(concat_ws(' ',username,full_name,email,phone,store_search)),lower(left(trim(_search),120)))>0)
  ), totals AS (SELECT count(*) total FROM filtered), paging AS (
    SELECT total, least(greatest(coalesce(_page,1),1),greatest(1,ceil(total::numeric/page_size)::integer)) page FROM totals
  ), selected AS (
    SELECT f.* FROM filtered f ORDER BY
      CASE WHEN _sort='oldest' THEN created_at END ASC,
      CASE WHEN _sort='last_sign_in' THEN last_sign_in_at END DESC NULLS LAST,
      created_at DESC,user_id
    LIMIT page_size OFFSET ((SELECT page FROM paging)-1)*page_size
  )
  SELECT jsonb_build_object(
    'users',coalesce((SELECT jsonb_agg(to_jsonb(s)-'store_search') FROM selected s),'[]'::jsonb),
    'total',(SELECT total FROM paging),'page',(SELECT page FROM paging),'page_size',page_size,
    'summary',(SELECT jsonb_build_object('total',count(*),'active',count(*) FILTER(WHERE status='active'),
      'owners',count(*) FILTER(WHERE kind='owner'),'staff',count(*) FILTER(WHERE kind='staff'),
      'couriers',count(*) FILTER(WHERE kind='courier'),
      'unlinked',count(*) FILTER(WHERE kind<>'admin' AND jsonb_array_length(stores)=0)) FROM base)
  ) INTO result;
  RETURN result;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_user_directory(text,text,text,text,text,integer,integer,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_user_directory(text,text,text,text,text,integer,integer,text) TO authenticated;
