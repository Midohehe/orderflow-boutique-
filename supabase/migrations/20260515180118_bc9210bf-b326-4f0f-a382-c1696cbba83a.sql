
CREATE TABLE IF NOT EXISTS public.form_field_catalog (
  field_key text PRIMARY KEY,
  label text NOT NULL,
  field_type text NOT NULL DEFAULT 'text',
  default_required boolean NOT NULL DEFAULT false,
  default_placeholder text NOT NULL DEFAULT '',
  admin_enabled boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.form_field_catalog ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read catalog" ON public.form_field_catalog FOR SELECT USING (true);
CREATE POLICY "Admin write catalog" ON public.form_field_catalog FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_form_field_catalog_updated_at BEFORE UPDATE ON public.form_field_catalog
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.form_field_catalog (field_key, label, field_type, default_required, default_placeholder, sort_order) VALUES
  ('phone', 'رقم الهاتف', 'phone', true, 'أدخل رقم هاتفك', 1),
  ('full_name', 'الاسم الكامل', 'text', true, 'أدخل اسمك الكامل', 2),
  ('government', 'المدينة', 'text', true, 'أدخل اسم مدينتك', 3),
  ('address', 'العنوان التفصيلي', 'textarea', true, 'الشارع، رقم المبنى…', 4),
  ('note', 'المنطقة', 'text', false, 'الرجاء ادخال المنطقة', 5),
  ('country', 'الدولة', 'text', false, 'أدخل اسم الدولة', 6),
  ('email', 'البريد الإلكتروني', 'email', false, 'example@mail.com', 7),
  ('phone_alt', 'رقم هاتف بديل', 'phone', false, 'رقم هاتف إضافي', 8),
  ('sa_national_address', 'العنوان الوطني', 'text', false, 'رمز العنوان الوطني', 9)
ON CONFLICT (field_key) DO NOTHING;
