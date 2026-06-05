-- Create a default safe per store (expenses/purchases require at least one safe).

CREATE OR REPLACE FUNCTION public.seed_store_defaults(_owner_id uuid, _store_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _owner_id IS NULL OR _store_id IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.order_form_fields (
    owner_id, store_id, field_key, label, placeholder, field_type,
    required, enabled, sort_order
  )
  SELECT
    _owner_id,
    _store_id,
    c.field_key,
    c.label,
    c.default_placeholder,
    c.field_type,
    c.default_required,
    c.default_required,
    c.sort_order
  FROM public.form_field_catalog c
  WHERE c.admin_enabled = true
  ON CONFLICT (store_id, field_key) DO NOTHING;

  INSERT INTO public.store_settings (
    owner_id, store_id, currency_code, currency_symbol, currency_name,
    button_text, success_message
  )
  VALUES (
    _owner_id,
    _store_id,
    'LYD',
    'د.ل',
    'دينار ليبي',
    'اطلب الآن - الدفع عند الاستلام',
    'شكراً لك! تم استلام طلبك بنجاح'
  )
  ON CONFLICT (owner_id, store_id) DO NOTHING;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'header_settings'
  ) THEN
    INSERT INTO public.header_settings (owner_id, store_id, logo_text)
    SELECT _owner_id, _store_id, 'متجري'
    WHERE NOT EXISTS (
      SELECT 1 FROM public.header_settings h
      WHERE h.owner_id = _owner_id AND h.store_id = _store_id
    );
  END IF;

  INSERT INTO public.safes (owner_id, store_id, name, balance, notes)
  SELECT _owner_id, _store_id, 'الخزينة الرئيسية', 0, 'خزينة افتراضية للمتجر'
  WHERE NOT EXISTS (
    SELECT 1 FROM public.safes sf WHERE sf.store_id = _store_id
  );
END;
$$;

-- Backfill default safes for existing stores
INSERT INTO public.safes (owner_id, store_id, name, balance, notes)
SELECT s.owner_id, s.id, 'الخزينة الرئيسية', 0, 'خزينة افتراضية للمتجر'
FROM public.stores s
WHERE NOT EXISTS (
  SELECT 1 FROM public.safes sf WHERE sf.store_id = s.id
);
