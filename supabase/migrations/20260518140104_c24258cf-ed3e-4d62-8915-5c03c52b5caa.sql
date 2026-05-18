
-- Create product_categories table
CREATE TABLE public.product_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  store_id uuid,
  name text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner all product_categories"
  ON public.product_categories
  FOR ALL
  USING (is_member_of(owner_id) OR has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (is_member_of(owner_id) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Public read product_categories"
  ON public.product_categories
  FOR SELECT
  USING (true);

CREATE TRIGGER update_product_categories_updated_at
  BEFORE UPDATE ON public.product_categories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Add category_id to products
ALTER TABLE public.products
  ADD COLUMN category_id uuid REFERENCES public.product_categories(id) ON DELETE SET NULL;

CREATE INDEX idx_products_category_id ON public.products(category_id);
CREATE INDEX idx_product_categories_store ON public.product_categories(store_id);
