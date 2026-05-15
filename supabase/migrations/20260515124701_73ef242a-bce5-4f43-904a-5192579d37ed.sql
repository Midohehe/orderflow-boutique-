
ALTER TABLE public.order_form_fields DROP CONSTRAINT IF EXISTS order_form_fields_field_key_key;
ALTER TABLE public.order_form_fields
  ADD CONSTRAINT order_form_fields_owner_field_key_unique UNIQUE (owner_id, field_key);

WITH defaults(field_key, label, placeholder, field_type, required, enabled, sort_order) AS (
  VALUES
    ('phone','رقم الهاتف','أدخل رقم هاتفك','phone',true,true,1),
    ('full_name','الاسم الكامل','أدخل اسمك الكامل','text',true,true,2),
    ('government','المدينة','أدخل اسم مدينتك','text',true,true,3),
    ('address','العنوان التفصيلي','الشارع، رقم المبنى…','textarea',true,true,4),
    ('note','المنطقة','الرجاء ادخال المنطقة','text',false,false,5),
    ('country','الدولة','أدخل اسم الدولة','text',false,false,6),
    ('email','البريد الإلكتروني','example@mail.com','email',false,false,7),
    ('phone_alt','رقم هاتف بديل','رقم هاتف إضافي','phone',false,false,8),
    ('sa_national_address','العنوان الوطني','رمز العنوان الوطني','text',false,false,9)
),
owners AS (SELECT DISTINCT owner_id FROM public.order_form_fields)
INSERT INTO public.order_form_fields (owner_id, field_key, label, placeholder, field_type, required, enabled, sort_order)
SELECT o.owner_id, d.field_key, d.label, d.placeholder, d.field_type, d.required, d.enabled, d.sort_order
FROM owners o CROSS JOIN defaults d
WHERE NOT EXISTS (
  SELECT 1 FROM public.order_form_fields f
  WHERE f.owner_id = o.owner_id AND f.field_key = d.field_key
);
