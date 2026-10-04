-- Public visitors see only published copy. Drafts and writes require a super admin.
CREATE TABLE public.platform_signup_page (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  draft jsonb,
  published jsonb,
  revision integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);
INSERT INTO public.platform_signup_page (id) VALUES (true);
ALTER TABLE public.platform_signup_page ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.platform_signup_page FROM anon, authenticated;
GRANT SELECT ON public.platform_signup_page TO authenticated;
CREATE POLICY "Super admins can read signup drafts" ON public.platform_signup_page
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE FUNCTION public.get_platform_signup_page() RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT published FROM public.platform_signup_page WHERE id = true $$;
REVOKE ALL ON FUNCTION public.get_platform_signup_page() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_platform_signup_page() TO anon, authenticated;

CREATE FUNCTION public.save_platform_signup_page(_content jsonb, _publish boolean, _expected_revision integer)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  current_revision integer;
  field text;
  entry jsonb;
  field_limit integer;
BEGIN
  IF auth.uid() IS NULL OR NOT COALESCE(public.has_role(auth.uid(), 'admin'), false) THEN
    RAISE EXCEPTION 'هذه العملية مخصصة للسوبر أدمن' USING ERRCODE = '42501';
  END IF;
  IF _content IS NULL OR jsonb_typeof(_content) <> 'object' OR octet_length(_content::text) > 65536 OR _publish IS NULL THEN
    RAISE EXCEPTION 'محتوى الصفحة غير صالح';
  END IF;
  FOREACH field IN ARRAY ARRAY['brandName','badge','title','highlight','description','ctaText','formTitle','formDescription','featuresTitle','stepsTitle','faqTitle','closingTitle','closingDescription','accentColor'] LOOP
    field_limit := CASE field WHEN 'brandName' THEN 40 WHEN 'badge' THEN 100 WHEN 'highlight' THEN 100
      WHEN 'description' THEN 500 WHEN 'ctaText' THEN 40 WHEN 'formTitle' THEN 80 WHEN 'formDescription' THEN 200
      WHEN 'closingDescription' THEN 300 WHEN 'accentColor' THEN 7 ELSE 120 END;
    IF jsonb_typeof(_content->field) IS DISTINCT FROM 'string' OR length(btrim(_content->>field)) NOT BETWEEN 1 AND field_limit THEN
      RAISE EXCEPTION 'حقل غير صالح: %', field;
    END IF;
  END LOOP;
  IF (_content->>'accentColor') !~ '^#[0-9a-fA-F]{6}$' THEN RAISE EXCEPTION 'اللون غير صالح'; END IF;
  FOREACH field IN ARRAY ARRAY['features','steps','faqs'] LOOP
    IF jsonb_typeof(_content->field) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'قائمة غير صالحة: %', field; END IF;
    IF jsonb_array_length(_content->field) NOT BETWEEN (CASE WHEN field='faqs' THEN 0 ELSE 1 END)
      AND (CASE field WHEN 'features' THEN 6 WHEN 'steps' THEN 4 ELSE 8 END) THEN RAISE EXCEPTION 'عدد عناصر غير صالح: %', field; END IF;
    FOR entry IN SELECT value FROM jsonb_array_elements(_content->field) LOOP
      IF jsonb_typeof(entry) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'عنصر غير صالح'; END IF;
      IF field='faqs' THEN
        IF jsonb_typeof(entry->'question') IS DISTINCT FROM 'string' OR length(btrim(entry->>'question')) NOT BETWEEN 1 AND 160
          OR jsonb_typeof(entry->'answer') IS DISTINCT FROM 'string' OR length(btrim(entry->>'answer')) NOT BETWEEN 1 AND 600 THEN
          RAISE EXCEPTION 'سؤال أو جواب غير صالح'; END IF;
      ELSE
        IF jsonb_typeof(entry->'title') IS DISTINCT FROM 'string' OR length(btrim(entry->>'title')) NOT BETWEEN 1 AND 80
          OR jsonb_typeof(entry->'description') IS DISTINCT FROM 'string' OR length(btrim(entry->>'description')) NOT BETWEEN 1 AND 300 THEN
          RAISE EXCEPTION 'عنوان أو وصف غير صالح'; END IF;
      END IF;
    END LOOP;
  END LOOP;
  SELECT revision INTO current_revision FROM public.platform_signup_page WHERE id = true FOR UPDATE;
  IF current_revision IS NULL OR _expected_revision IS DISTINCT FROM current_revision THEN
    RAISE EXCEPTION 'تم تعديل الصفحة من جلسة أخرى. أعد تحميل الإعدادات قبل الحفظ.' USING ERRCODE = '40001';
  END IF;
  UPDATE public.platform_signup_page SET draft = _content,
    published = CASE WHEN _publish THEN _content ELSE published END,
    published_at = CASE WHEN _publish THEN now() ELSE published_at END,
    revision = revision + 1, updated_at = now(), updated_by = auth.uid() WHERE id = true;
  RETURN current_revision + 1;
END $$;
REVOKE ALL ON FUNCTION public.save_platform_signup_page(jsonb, boolean, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_platform_signup_page(jsonb, boolean, integer) TO authenticated;
