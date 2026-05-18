
CREATE TABLE public.prep_lists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  store_id uuid,
  name text NOT NULL,
  status text NOT NULL DEFAULT 'open',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  confirmed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.prep_list_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id uuid NOT NULL REFERENCES public.prep_lists(id) ON DELETE CASCADE,
  order_id uuid NOT NULL,
  owner_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(list_id, order_id)
);

CREATE INDEX idx_prep_list_orders_list ON public.prep_list_orders(list_id);
CREATE INDEX idx_prep_list_orders_order ON public.prep_list_orders(order_id);
CREATE INDEX idx_prep_lists_owner ON public.prep_lists(owner_id);

ALTER TABLE public.prep_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prep_list_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner all prep_lists" ON public.prep_lists
  FOR ALL USING (is_member_of(owner_id) OR has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (is_member_of(owner_id) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Owner all prep_list_orders" ON public.prep_list_orders
  FOR ALL USING (is_member_of(owner_id) OR has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (is_member_of(owner_id) OR has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_prep_lists_updated_at
  BEFORE UPDATE ON public.prep_lists
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
