-- Public read of active offers for storefront runtime (anon-safe)

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
              'meta', op.meta
            )
            ORDER BY op.sort_order
          )
          FROM public.offer_products op
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

GRANT EXECUTE ON FUNCTION public.get_public_active_offers(uuid) TO anon, authenticated;

-- Keep offer_stats in sync from analytics events
CREATE OR REPLACE FUNCTION public.touch_offer_stats_from_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.offer_stats (offer_id, views, clicks, accepts, rejects, revenue, updated_at)
  VALUES (
    NEW.offer_id,
    CASE WHEN NEW.event_type = 'view' THEN 1 ELSE 0 END,
    CASE WHEN NEW.event_type = 'click' THEN 1 ELSE 0 END,
    CASE WHEN NEW.event_type = 'accept' THEN 1 ELSE 0 END,
    CASE WHEN NEW.event_type IN ('reject', 'dismiss') THEN 1 ELSE 0 END,
    COALESCE(NEW.revenue, 0),
    now()
  )
  ON CONFLICT (offer_id) DO UPDATE SET
    views = public.offer_stats.views + CASE WHEN NEW.event_type = 'view' THEN 1 ELSE 0 END,
    clicks = public.offer_stats.clicks + CASE WHEN NEW.event_type = 'click' THEN 1 ELSE 0 END,
    accepts = public.offer_stats.accepts + CASE WHEN NEW.event_type = 'accept' THEN 1 ELSE 0 END,
    rejects = public.offer_stats.rejects + CASE WHEN NEW.event_type IN ('reject', 'dismiss') THEN 1 ELSE 0 END,
    revenue = public.offer_stats.revenue + COALESCE(NEW.revenue, 0),
    updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_offer_analytics_stats ON public.offer_analytics_events;
CREATE TRIGGER trg_offer_analytics_stats
  AFTER INSERT ON public.offer_analytics_events
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_offer_stats_from_event();
