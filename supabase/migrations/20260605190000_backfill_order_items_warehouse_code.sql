-- Backfill order_items.warehouse_code from product variant mappings
UPDATE public.order_items oi
SET warehouse_code = trim(both from p.variant_warehouse_codes ->> oi.selected_product_code)
FROM public.products p
WHERE oi.product_id = p.id
  AND oi.warehouse_code IS NULL
  AND oi.selected_product_code IS NOT NULL
  AND trim(both from oi.selected_product_code) <> ''
  AND p.variant_warehouse_codes ? oi.selected_product_code;
