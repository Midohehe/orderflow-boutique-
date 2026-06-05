-- Make the MazBot confirmation-template variable order configurable.
--
-- MazBot templates bind variables positionally (body_values[1], body_values[2], ...)
-- to the placeholders in the order they appear in the template body. Different
-- merchants register templates with different variable counts/orders, so a fixed
-- 4-variable order (name, order_id, products, total) breaks templates that, for
-- example, only use 3 variables (order_id, products, total). This caused the
-- confirmation message to fail / never reach the customer.
--
-- mazbot_template_vars is a comma-separated, ordered list of tokens. Supported
-- tokens (and aliases): customer_name|name, order_id|order|ordernumber,
-- products|product, total|price. The default matches the common
-- "order number / product / total" template.

ALTER TABLE public.whatsapp_settings
  ADD COLUMN IF NOT EXISTS mazbot_template_vars text;

UPDATE public.whatsapp_settings
  SET mazbot_template_vars = 'order_id,products,total'
  WHERE mazbot_template_vars IS NULL;

ALTER TABLE public.whatsapp_settings
  ALTER COLUMN mazbot_template_vars SET DEFAULT 'order_id,products,total';
