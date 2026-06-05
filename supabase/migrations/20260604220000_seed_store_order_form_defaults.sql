-- Seed order form fields and store settings per store; fix owner-scoped uniqueness.

-- 1) Core seed function
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
END;
$$;

GRANT EXECUTE ON FUNCTION public.seed_store_defaults(uuid, uuid) TO authenticated;

-- 2) Backfill NULL store_id on order_form_fields
UPDATE public.order_form_fields o
SET store_id = s.id
FROM public.stores s
WHERE o.store_id IS NULL
  AND o.owner_id IS NOT NULL
  AND s.owner_id = o.owner_id
  AND s.is_default = true;

UPDATE public.order_form_fields o
SET store_id = (
  SELECT s.id FROM public.stores s
  WHERE s.owner_id = o.owner_id
  ORDER BY s.is_default DESC, s.created_at ASC
  LIMIT 1
)
WHERE o.store_id IS NULL AND o.owner_id IS NOT NULL;

-- Remove duplicate (store_id, field_key) rows before adding constraint
DELETE FROM public.order_form_fields a
USING public.order_form_fields b
WHERE a.id > b.id
  AND a.store_id IS NOT DISTINCT FROM b.store_id
  AND a.field_key = b.field_key
  AND a.store_id IS NOT NULL;

-- 3) Replace owner-scoped uniqueness with per-store uniqueness
ALTER TABLE public.order_form_fields
  DROP CONSTRAINT IF EXISTS order_form_fields_owner_field_key_unique;

ALTER TABLE public.order_form_fields
  DROP CONSTRAINT IF EXISTS order_form_fields_store_field_key_unique;

ALTER TABLE public.order_form_fields
  ADD CONSTRAINT order_form_fields_store_field_key_unique UNIQUE (store_id, field_key);

-- 4) Backfill all stores missing form fields
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT s.owner_id, s.id AS store_id FROM public.stores s
  LOOP
    PERFORM public.seed_store_defaults(r.owner_id, r.store_id);
  END LOOP;
END $$;

-- 5) Auto-seed on new store creation
CREATE OR REPLACE FUNCTION public.trg_stores_seed_defaults()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.seed_store_defaults(NEW.owner_id, NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_stores_seed_defaults ON public.stores;
CREATE TRIGGER trg_stores_seed_defaults
  AFTER INSERT ON public.stores
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_stores_seed_defaults();

-- 6) Public RPC for landing pages (seeds then returns enabled fields)
CREATE OR REPLACE FUNCTION public.get_public_order_form_fields(
  _owner_id uuid,
  _store_id uuid DEFAULT NULL
)
RETURNS TABLE(
  id uuid,
  field_key text,
  label text,
  placeholder text,
  field_type text,
  required boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _sid uuid;
BEGIN
  IF _owner_id IS NULL THEN
    RETURN;
  END IF;

  _sid := _store_id;
  IF _sid IS NULL THEN
    SELECT s.id INTO _sid
    FROM public.stores s
    WHERE s.owner_id = _owner_id AND s.is_default = true
    LIMIT 1;
  END IF;
  IF _sid IS NULL THEN
    SELECT s.id INTO _sid
    FROM public.stores s
    WHERE s.owner_id = _owner_id
    ORDER BY s.created_at ASC
    LIMIT 1;
  END IF;

  IF _sid IS NOT NULL THEN
    PERFORM public.seed_store_defaults(_owner_id, _sid);
  END IF;

  RETURN QUERY
  SELECT
    f.id,
    f.field_key,
    f.label,
    f.placeholder,
    f.field_type,
    f.required
  FROM public.order_form_fields f
  INNER JOIN public.form_field_catalog c
    ON c.field_key = f.field_key AND c.admin_enabled = true
  WHERE f.owner_id = _owner_id
    AND f.store_id = _sid
    AND f.enabled = true
  ORDER BY f.sort_order ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_order_form_fields(uuid, uuid) TO anon, authenticated;
