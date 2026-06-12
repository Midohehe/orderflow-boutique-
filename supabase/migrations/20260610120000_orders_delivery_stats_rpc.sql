-- Server-side delivery stats & shipped carrier label counts (reduces DB egress).

CREATE OR REPLACE FUNCTION public._carrier_label_alias(_label text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE TRIM(COALESCE(_label, ''))
    WHEN 'جاري التجهيز' THEN 'جارى التجهيز'
    WHEN 'متابعة : لدي المندوب' THEN 'متابعة'
    WHEN 'تم الاستلام في الشركه' THEN 'تم التجهيز'
    WHEN 'طلب شحن' THEN 'قيد الارسال للمندوب'
    ELSE TRIM(COALESCE(_label, ''))
  END;
$$;

CREATE OR REPLACE FUNCTION public._order_extract_carrier_code(
  _carrier_status text,
  _carrier_status_raw jsonb
)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  _base text;
  _suffix text;
  _text text;
  _paren text;
BEGIN
  IF _carrier_status_raw IS NOT NULL AND _carrier_status_raw <> 'null'::jsonb THEN
    _base := COALESCE(
      NULLIF(TRIM(_carrier_status_raw->>'shipmentStatusCode'), ''),
      NULLIF(TRIM(_carrier_status_raw->>'shipment_status_code'), '')
    );
    IF _base IS NULL THEN
      IF jsonb_typeof(_carrier_status_raw->'status') = 'string' THEN
        _base := NULLIF(TRIM(_carrier_status_raw->>'status'), '');
      ELSIF jsonb_typeof(_carrier_status_raw->'status') = 'object' THEN
        _base := COALESCE(
          NULLIF(TRIM(_carrier_status_raw->'status'->>'code'), ''),
          NULLIF(TRIM(_carrier_status_raw->'status'->>'name'), '')
        );
      END IF;
    END IF;
    IF _base IS NOT NULL AND _base <> '' THEN
      IF UPPER(_base) = 'DTR' THEN
        RETURN 'DTR';
      END IF;
      _suffix := COALESCE(
        NULLIF(TRIM(_carrier_status_raw->>'deliveryTypeCode'), ''),
        NULLIF(TRIM(_carrier_status_raw->>'delivery_type_code'), ''),
        NULLIF(TRIM(_carrier_status_raw->>'returnTypeCode'), ''),
        NULLIF(TRIM(_carrier_status_raw->>'return_type_code'), '')
      );
      IF _suffix IS NOT NULL AND _suffix <> '' THEN
        RETURN UPPER(_base || _suffix);
      END IF;
      RETURN UPPER(_base);
    END IF;
  END IF;

  _text := NULLIF(TRIM(_carrier_status), '');
  IF _text IS NULL THEN
    RETURN NULL;
  END IF;

  IF _text ~ '\([^)]+\)\s*$' THEN
    _paren := (regexp_match(_text, '\(([^)]+)\)\s*$'))[1];
    IF _paren IS NOT NULL THEN
      RETURN UPPER(TRIM(_paren));
    END IF;
  END IF;

  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public._merged_carrier_mappings(_store_id uuid, _owner_id uuid)
RETURNS TABLE(status_code text, custom_label text, category text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH defaults AS (
    SELECT * FROM (
      VALUES
        ('PRP', 'جارى التجهيز', 'in_progress'),
        ('PRPD', 'تم التجهيز', 'in_progress'),
        ('STD', 'قيد الارسال للمندوب', 'in_progress'),
        ('DEX', 'متابعة', 'in_progress'),
        ('HTR', 'انتظار لإعادة التوصيل', 'in_progress'),
        ('PKH', 'انتظار لإعادة الالتقاط', 'in_progress'),
        ('OTD', 'قيد التوصيل', 'in_progress'),
        ('RITS', 'RITS', 'in_progress'),
        ('PKR', 'PKR', 'in_progress'),
        ('DTR', 'تم التسليم', 'delivered'),
        ('DTRC', 'تم التسليم والتحصيل', 'delivered'),
        ('DTRCP', 'تم التسليم والسداد للعميل', 'delivered'),
        ('DTRUC', 'تم التسليم دون تحصيل', 'delivered'),
        ('RTS', 'راجع', 'returned'),
        ('RTSD', 'راجع لدى المندوب', 'returned'),
        ('RTSC', 'راجع لدى الشركة', 'returned'),
        ('OTR', 'قيد الإرجاع', 'returned'),
        ('RTRN', 'تم الإرجاع للراسل', 'returned'),
        ('RCV', 'ارتجاع للمخزن', 'returned'),
        ('UPKBL', 'جاهز للتفريغ', 'returned'),
        ('UPKBD', 'تم التفريغ', 'returned'),
        ('UKDB', 'تم التفريغ', 'returned'),
        ('BMR', 'مناولة بين الفروع - وارد', 'in_progress'),
        ('BMT', 'مناولة بين الفروع - صادر', 'in_progress')
    ) AS t(status_code, custom_label, category)
  ),
  owner_rows AS (
    SELECT
      UPPER(m.status_code) AS status_code,
      COALESCE(NULLIF(TRIM(m.custom_label), ''), d.custom_label) AS custom_label,
      CASE
        WHEN m.category IN ('delivered', 'returned', 'in_progress') THEN m.category
        ELSE d.category
      END AS category
    FROM public.carrier_status_mappings m
    LEFT JOIN defaults d ON d.status_code = UPPER(m.status_code)
    WHERE m.owner_id = _owner_id
      AND (m.store_id = _store_id OR m.store_id IS NULL)
  )
  SELECT DISTINCT ON (combined.status_code)
    combined.status_code,
    combined.custom_label,
    combined.category
  FROM (
    SELECT 1 AS pri, d.status_code, d.custom_label, d.category FROM defaults d
    UNION ALL
    SELECT 2 AS pri, o.status_code, o.custom_label, o.category FROM owner_rows o
  ) combined
  ORDER BY combined.status_code, combined.pri DESC;
$$;

CREATE OR REPLACE FUNCTION public._order_carrier_display_label(
  _carrier_status text,
  _carrier_status_raw jsonb,
  _status_code text,
  _code_label text
)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  _text text;
  _paren_code text;
  _base text;
BEGIN
  IF _code_label IS NOT NULL AND _code_label <> '' THEN
    RETURN _code_label;
  END IF;

  _text := NULLIF(TRIM(_carrier_status), '');
  IF _text IS NULL THEN
    RETURN 'بدون حالة';
  END IF;

  IF _text ~ '^(.*?)\s*\(([^)]+)\)\s*$' THEN
    _paren_code := (regexp_match(_text, '^(.*?)\s*\(([^)]+)\)\s*$'))[2];
    _base := TRIM((regexp_match(_text, '^(.*?)\s*\(([^)]+)\)\s*$'))[1]);
    IF _base IS NOT NULL AND _base <> '' THEN
      RETURN public._carrier_label_alias(_base);
    END IF;
    IF _paren_code IS NOT NULL THEN
      RETURN public._carrier_label_alias(_paren_code);
    END IF;
  END IF;

  RETURN public._carrier_label_alias(_text);
END;
$$;

CREATE OR REPLACE FUNCTION public._order_carrier_category(
  _order_status text,
  _carrier_status text,
  _carrier_status_raw jsonb,
  _store_id uuid,
  _owner_id uuid
)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _code text;
  _label text;
  _cat text;
  _base text;
BEGIN
  IF _order_status IN ('delivered', 'settled') THEN
    RETURN 'delivered';
  END IF;
  IF _order_status IN ('returned_received', 'unpacked') THEN
    RETURN 'returned';
  END IF;

  _code := public._order_extract_carrier_code(_carrier_status, _carrier_status_raw);

  IF _code IS NOT NULL THEN
    SELECT m.category INTO _cat
    FROM public._merged_carrier_mappings(_store_id, _owner_id) m
    WHERE m.status_code = _code
    LIMIT 1;
    IF _cat IS NOT NULL THEN
      RETURN _cat;
    END IF;
  END IF;

  SELECT public._order_carrier_display_label(
    _carrier_status,
    _carrier_status_raw,
    _code,
    (SELECT m.custom_label FROM public._merged_carrier_mappings(_store_id, _owner_id) m WHERE m.status_code = _code LIMIT 1)
  ) INTO _label;

  SELECT m.category INTO _cat
  FROM public._merged_carrier_mappings(_store_id, _owner_id) m
  WHERE m.custom_label = _label
  LIMIT 1;
  IF _cat IS NOT NULL THEN
    RETURN _cat;
  END IF;

  IF _carrier_status ~ '^(.*?)\s*\(([^)]+)\)\s*$' THEN
    _base := TRIM((regexp_match(_carrier_status, '^(.*?)\s*\(([^)]+)\)\s*$'))[1]);
    IF _base IS NOT NULL AND _base <> '' THEN
      SELECT m.category INTO _cat
      FROM public._merged_carrier_mappings(_store_id, _owner_id) m
      WHERE m.custom_label = public._carrier_label_alias(_base)
      LIMIT 1;
      IF _cat IS NOT NULL THEN
        RETURN _cat;
      END IF;
    END IF;
  END IF;

  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.orders_delivery_stats_summary(
  _store_id uuid,
  _owner_id uuid DEFAULT NULL,
  _product_name text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _owner uuid;
  _result json;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_store_access(_store_id) THEN
    RETURN NULL;
  END IF;

  _owner := COALESCE(
    _owner_id,
    (SELECT s.owner_id FROM public.stores s WHERE s.id = _store_id LIMIT 1)
  );

  WITH sent AS (
    SELECT
      o.confirmation_status,
      public._order_carrier_category(
        o.status, o.carrier_status, o.carrier_status_raw, _store_id, _owner
      ) AS carrier_cat
    FROM public.orders o
    LEFT JOIN public.products p
      ON p.id = o.product_id
     AND p.store_id = o.store_id
     AND p.deleted_at IS NULL
    WHERE o.store_id = _store_id
      AND o.is_deleted = false
      AND o.status <> 'cancelled'
      AND (
        o.shipping_reference IS NOT NULL
        OR o.status IN ('shipped', 'delivered', 'settled', 'returned_received', 'unpacked')
      )
      AND (
        _product_name IS NULL
        OR COALESCE(p.name, o.product_name) = _product_name
      )
  )
  SELECT json_build_object(
    'confirmed_total', COALESCE(SUM(CASE WHEN confirmation_status = 'confirmed' THEN 1 ELSE 0 END), 0),
    'confirmed_delivered', COALESCE(SUM(
      CASE WHEN confirmation_status = 'confirmed' AND carrier_cat = 'delivered' THEN 1 ELSE 0 END
    ), 0),
    'other_total', COALESCE(SUM(CASE WHEN confirmation_status IS DISTINCT FROM 'confirmed' THEN 1 ELSE 0 END), 0),
    'other_delivered', COALESCE(SUM(
      CASE WHEN confirmation_status IS DISTINCT FROM 'confirmed' AND carrier_cat = 'delivered' THEN 1 ELSE 0 END
    ), 0),
    'carrier_delivered', COALESCE(SUM(CASE WHEN carrier_cat = 'delivered' THEN 1 ELSE 0 END), 0),
    'carrier_returned', COALESCE(SUM(CASE WHEN carrier_cat = 'returned' THEN 1 ELSE 0 END), 0),
    'carrier_in_progress', COALESCE(SUM(CASE WHEN carrier_cat = 'in_progress' THEN 1 ELSE 0 END), 0),
    'carrier_uncategorized', COALESCE(SUM(CASE WHEN carrier_cat IS NULL THEN 1 ELSE 0 END), 0)
  )
  INTO _result
  FROM sent;

  RETURN _result;
END;
$$;

CREATE OR REPLACE FUNCTION public.orders_shipped_carrier_counts(
  _store_id uuid,
  _owner_id uuid DEFAULT NULL
)
RETURNS TABLE(label text, cnt bigint)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _owner uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_store_access(_store_id) THEN
    RETURN;
  END IF;

  _owner := COALESCE(
    _owner_id,
    (SELECT s.owner_id FROM public.stores s WHERE s.id = _store_id LIMIT 1)
  );

  RETURN QUERY
  SELECT
    public._order_carrier_display_label(
      o.carrier_status,
      o.carrier_status_raw,
      public._order_extract_carrier_code(o.carrier_status, o.carrier_status_raw),
      m.custom_label
    ) AS label,
    COUNT(*)::bigint AS cnt
  FROM public.orders o
  LEFT JOIN LATERAL (
    SELECT mm.custom_label
    FROM public._merged_carrier_mappings(_store_id, _owner) mm
    WHERE mm.status_code = public._order_extract_carrier_code(o.carrier_status, o.carrier_status_raw)
    LIMIT 1
  ) m ON true
  WHERE o.store_id = _store_id
    AND o.status = 'shipped'
    AND o.is_deleted = false
  GROUP BY 1
  ORDER BY 2 DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.orders_delivery_stats_summary(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.orders_shipped_carrier_counts(uuid, uuid) TO authenticated;
