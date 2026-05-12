ALTER TABLE public.expenses ADD COLUMN product_id uuid;
ALTER TABLE public.purchases ADD COLUMN product_id uuid;
CREATE INDEX idx_expenses_product_id ON public.expenses(product_id);
CREATE INDEX idx_purchases_product_id ON public.purchases(product_id);