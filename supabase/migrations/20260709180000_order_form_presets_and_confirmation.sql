-- Named order-form presets (per store) + confirmation dialog settings.
-- Landing pages can pick a saved preset; NULL = store default (order_form_fields + store_settings).

-- ---------------------------------------------------------------------------
-- 1) Confirmation on store default settings
-- ---------------------------------------------------------------------------
ALTER TABLE public.store_settings
  ADD COLUMN IF NOT EXISTS confirmation_enabled boolean NOT NULL DEFAULT false;

ALTER TABLE public.store_settings
  ADD COLUMN IF NOT EXISTS confirmation_message text NOT NULL DEFAULT '';

COMMENT ON COLUMN public.store_settings.confirmation_enabled IS
  'When true, landing checkout shows a confirmation dialog before submitting.';
COMMENT ON COLUMN public.store_settings.confirmation_message IS
  'Message shown in the checkout confirmation dialog.';

-- ---------------------------------------------------------------------------
-- 2) Presets table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.order_form_presets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  name text NOT NULL,
  button_text text NOT NULL DEFAULT 'اطلب الآن',
  success_message text NOT NULL DEFAULT 'شكراً لك! تم استلام طلبك بنجاح',
  confirmation_enabled boolean NOT NULL DEFAULT false,
  confirmation_message text NOT NULL DEFAULT '',
  fields jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT order_form_presets_store_name_unique UNIQUE (store_id, name),
  CONSTRAINT order_form_presets_fields_is_array CHECK (jsonb_typeof(fields) = 'array')
);

CREATE INDEX IF NOT EXISTS idx_order_form_presets_store
  ON public.order_form_presets(store_id);

CREATE INDEX IF NOT EXISTS idx_order_form_presets_owner
  ON public.order_form_presets(owner_id);

ALTER TABLE public.order_form_presets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "store_tenant_select" ON public.order_form_presets;
DROP POLICY IF EXISTS "store_tenant_insert" ON public.order_form_presets;
DROP POLICY IF EXISTS "store_tenant_update" ON public.order_form_presets;
DROP POLICY IF EXISTS "store_tenant_delete" ON public.order_form_presets;

CREATE POLICY "store_tenant_select" ON public.order_form_presets
  FOR SELECT TO authenticated
  USING (public.rls_store_select(store_id));

CREATE POLICY "store_tenant_insert" ON public.order_form_presets
  FOR INSERT TO authenticated
  WITH CHECK (public.rls_store_write(store_id, owner_id));

CREATE POLICY "store_tenant_update" ON public.order_form_presets
  FOR UPDATE TO authenticated
  USING (public.rls_store_select(store_id))
  WITH CHECK (public.rls_store_write(store_id, owner_id));

CREATE POLICY "store_tenant_delete" ON public.order_form_presets
  FOR DELETE TO authenticated
  USING (public.rls_store_select(store_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_form_presets TO authenticated;

-- ---------------------------------------------------------------------------
-- 3) Landing page → preset link
-- ---------------------------------------------------------------------------
ALTER TABLE public.landing_pages
  ADD COLUMN IF NOT EXISTS order_form_preset_id uuid
    REFERENCES public.order_form_presets(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_landing_pages_order_form_preset
  ON public.landing_pages(order_form_preset_id);

-- ---------------------------------------------------------------------------
-- 4) Public RPC: resolve form fields + CTA + confirmation for a landing page
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_public_order_form_config(
  _owner_id uuid,
  _store_id uuid DEFAULT NULL,
  _preset_id uuid DEFAULT NULL
)
RETURNS TABLE(
  field_id uuid,
  field_key text,
  label text,
  placeholder text,
  field_type text,
  required boolean,
  button_text text,
  success_message text,
  confirmation_enabled boolean,
  confirmation_message text,
  preset_id uuid,
  preset_name text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _sid uuid;
  _preset public.order_form_presets%ROWTYPE;
  _btn text;
  _success text;
  _conf_enabled boolean;
  _conf_msg text;
  _elem jsonb;
  _idx int;
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

  -- Prefer an explicit preset that belongs to this store/owner
  IF _preset_id IS NOT NULL THEN
    SELECT * INTO _preset
    FROM public.order_form_presets p
    WHERE p.id = _preset_id
      AND p.owner_id = _owner_id
      AND (_sid IS NULL OR p.store_id = _sid)
    LIMIT 1;

    IF FOUND THEN
      _btn := COALESCE(NULLIF(trim(_preset.button_text), ''), 'اطلب الآن - الدفع عند الاستلام');
      _success := COALESCE(NULLIF(trim(_preset.success_message), ''), 'شكراً لك! تم استلام طلبك بنجاح');
      _conf_enabled := COALESCE(_preset.confirmation_enabled, false);
      _conf_msg := COALESCE(_preset.confirmation_message, '');

      _idx := 0;
      FOR _elem IN
        SELECT value
        FROM jsonb_array_elements(COALESCE(_preset.fields, '[]'::jsonb))
      LOOP
        IF COALESCE((_elem->>'enabled')::boolean, true) IS NOT TRUE THEN
          CONTINUE;
        END IF;
        IF NOT EXISTS (
          SELECT 1 FROM public.form_field_catalog c
          WHERE c.field_key = COALESCE(_elem->>'field_key', '')
            AND c.admin_enabled = true
        ) THEN
          CONTINUE;
        END IF;

        field_id := COALESCE((_elem->>'id')::uuid, gen_random_uuid());
        field_key := _elem->>'field_key';
        label := COALESCE(NULLIF(trim(_elem->>'label'), ''), field_key);
        placeholder := COALESCE(_elem->>'placeholder', '');
        field_type := COALESCE(_elem->>'field_type', 'text');
        required := COALESCE((_elem->>'required')::boolean, false);
        button_text := _btn;
        success_message := _success;
        confirmation_enabled := _conf_enabled;
        confirmation_message := _conf_msg;
        preset_id := _preset.id;
        preset_name := _preset.name;
        RETURN NEXT;
        _idx := _idx + 1;
      END LOOP;

      -- Still return CTA/confirmation even if all fields filtered out
      IF _idx = 0 THEN
        field_id := NULL;
        field_key := NULL;
        label := NULL;
        placeholder := NULL;
        field_type := NULL;
        required := NULL;
        button_text := _btn;
        success_message := _success;
        confirmation_enabled := _conf_enabled;
        confirmation_message := _conf_msg;
        preset_id := _preset.id;
        preset_name := _preset.name;
        RETURN NEXT;
      END IF;
      RETURN;
    END IF;
  END IF;

  -- Store default path
  SELECT
    COALESCE(NULLIF(trim(ss.button_text), ''), 'اطلب الآن - الدفع عند الاستلام'),
    COALESCE(NULLIF(trim(ss.success_message), ''), 'شكراً لك! تم استلام طلبك بنجاح'),
    COALESCE(ss.confirmation_enabled, false),
    COALESCE(ss.confirmation_message, '')
  INTO _btn, _success, _conf_enabled, _conf_msg
  FROM public.store_settings ss
  WHERE ss.owner_id = _owner_id
    AND (_sid IS NULL OR ss.store_id = _sid)
  ORDER BY CASE WHEN ss.store_id = _sid THEN 0 ELSE 1 END
  LIMIT 1;

  _btn := COALESCE(_btn, 'اطلب الآن - الدفع عند الاستلام');
  _success := COALESCE(_success, 'شكراً لك! تم استلام طلبك بنجاح');
  _conf_enabled := COALESCE(_conf_enabled, false);
  _conf_msg := COALESCE(_conf_msg, '');

  IF EXISTS (
    SELECT 1
    FROM public.order_form_fields f
    INNER JOIN public.form_field_catalog c
      ON c.field_key = f.field_key AND c.admin_enabled = true
    WHERE f.owner_id = _owner_id
      AND f.store_id = _sid
      AND f.enabled = true
  ) THEN
    RETURN QUERY
    SELECT
      f.id,
      f.field_key,
      f.label,
      f.placeholder,
      f.field_type,
      f.required,
      _btn,
      _success,
      _conf_enabled,
      _conf_msg,
      NULL::uuid,
      NULL::text
    FROM public.order_form_fields f
    INNER JOIN public.form_field_catalog c
      ON c.field_key = f.field_key AND c.admin_enabled = true
    WHERE f.owner_id = _owner_id
      AND f.store_id = _sid
      AND f.enabled = true
    ORDER BY f.sort_order ASC;
  ELSE
    -- No fields: still expose CTA/confirmation as a single meta row
    field_id := NULL;
    field_key := NULL;
    label := NULL;
    placeholder := NULL;
    field_type := NULL;
    required := NULL;
    button_text := _btn;
    success_message := _success;
    confirmation_enabled := _conf_enabled;
    confirmation_message := _conf_msg;
    preset_id := NULL;
    preset_name := NULL;
    RETURN NEXT;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_order_form_config(uuid, uuid, uuid) TO anon, authenticated;

COMMENT ON FUNCTION public.get_public_order_form_config(uuid, uuid, uuid) IS
  'Public landing checkout config: fields + button/success/confirmation from preset or store default.';
