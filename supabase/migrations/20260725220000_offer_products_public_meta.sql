-- Enrich public offers with product name / image / price for storefront UI

CREATE OR REPLACE FUNCTION public.get_public_active_offers(_store_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  IF _store_id IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;

  SELECT COALESCE(jsonb_agg(row_data ORDER BY priority DESC, updated_at DESC), '[]'::jsonb)
  INTO result
  FROM (
    SELECT
      jsonb_build_object(
        'id', o.id,
        'store_id', o.store_id,
        'name', o.name,
        'status', o.status,
        'priority', o.priority,
        'offer_type', o.offer_type,
        'design', o.design,
        'pricing', o.pricing,
        'trigger_config', o.trigger_config,
        'frequency', o.frequency,
        'schedule', o.schedule,
        'updated_at', o.updated_at,
        'products', COALESCE((
          SELECT jsonb_agg(
            jsonb_build_object(
              'product_id', op.product_id,
              'category_id', op.category_id,
              'sort_order', op.sort_order,
              'is_default', op.is_default,
              'allow_variants', op.allow_variants,
              'allow_multi_select', op.allow_multi_select,
              'meta', op.meta,
              'product_name', p.name,
              'product_image', NULLIF(p.images[1], ''),
              'product_price', p.price
            )
            ORDER BY op.sort_order
          )
          FROM public.offer_products op
          LEFT JOIN public.products p ON p.id = op.product_id
          WHERE op.offer_id = o.id
        ), '[]'::jsonb),
        'rule_groups', COALESCE((
          SELECT jsonb_agg(
            jsonb_build_object(
              'id', g.id,
              'logic', g.logic,
              'sort_order', g.sort_order,
              'rules', COALESCE((
                SELECT jsonb_agg(
                  jsonb_build_object(
                    'field', r.field,
                    'operator', r.operator,
                    'value', r.value,
                    'sort_order', r.sort_order
                  )
                  ORDER BY r.sort_order
                )
                FROM public.offer_rules r
                WHERE r.offer_id = o.id AND (r.group_id = g.id OR (r.group_id IS NULL AND g.parent_group_id IS NULL))
              ), '[]'::jsonb)
            )
            ORDER BY g.sort_order
          )
          FROM public.offer_rule_groups g
          WHERE g.offer_id = o.id AND g.parent_group_id IS NULL
        ), '[]'::jsonb),
        'actions', COALESCE((
          SELECT jsonb_agg(
            jsonb_build_object(
              'on_event', a.on_event,
              'action_type', a.action_type,
              'config', a.config,
              'sort_order', a.sort_order
            )
            ORDER BY a.sort_order
          )
          FROM public.offer_actions a
          WHERE a.offer_id = o.id
        ), '[]'::jsonb)
      ) AS row_data,
      o.priority,
      o.updated_at
    FROM public.offers o
    WHERE o.store_id = _store_id
      AND o.status = 'active'
  ) sub;

  RETURN result;
END;
$$;
