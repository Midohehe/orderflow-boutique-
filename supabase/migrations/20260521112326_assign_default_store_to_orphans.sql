UPDATE orders o SET store_id = (
  SELECT id FROM stores s WHERE s.owner_id = o.owner_id
  ORDER BY is_default DESC, created_at ASC LIMIT 1
) WHERE o.store_id IS NULL;
UPDATE order_items oi SET store_id = o.store_id
  FROM orders o WHERE oi.order_id = o.id AND oi.store_id IS NULL AND o.store_id IS NOT NULL;
