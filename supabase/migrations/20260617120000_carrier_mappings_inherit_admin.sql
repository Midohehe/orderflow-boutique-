-- Inherit super-admin carrier status categories for all stores in delivery stats.

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
  admin_rows AS (
    SELECT
      UPPER(m.status_code) AS status_code,
      COALESCE(NULLIF(TRIM(m.custom_label), ''), d.custom_label) AS custom_label,
      CASE
        WHEN m.category IN ('delivered', 'returned', 'in_progress') THEN m.category
        ELSE d.category
      END AS category
    FROM public.carrier_status_mappings m
    LEFT JOIN defaults d ON d.status_code = UPPER(m.status_code)
    WHERE EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = m.owner_id
        AND ur.role = 'admin'
    )
    AND (m.store_id IS NULL OR m.store_id = _store_id)
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
    SELECT 2 AS pri, a.status_code, a.custom_label, a.category FROM admin_rows a
    UNION ALL
    SELECT 3 AS pri, o.status_code, o.custom_label, o.category FROM owner_rows o
  ) combined
  ORDER BY combined.status_code, combined.pri DESC;
$$;
