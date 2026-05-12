
-- Safes
CREATE TABLE public.safes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL,
  name TEXT NOT NULL,
  balance NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.safes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner all safes" ON public.safes FOR ALL
  USING ((auth.uid() = owner_id) OR has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK ((auth.uid() = owner_id) OR has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER safes_set_owner BEFORE INSERT ON public.safes
  FOR EACH ROW EXECUTE FUNCTION public.set_owner_id();
CREATE TRIGGER safes_updated_at BEFORE UPDATE ON public.safes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Safe movements
CREATE TABLE public.safe_movements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL,
  safe_id UUID NOT NULL REFERENCES public.safes(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  movement_type TEXT NOT NULL,
  reference_id UUID,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.safe_movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner all safe_movements" ON public.safe_movements FOR ALL
  USING ((auth.uid() = owner_id) OR has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK ((auth.uid() = owner_id) OR has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER safe_movements_set_owner BEFORE INSERT ON public.safe_movements
  FOR EACH ROW EXECUTE FUNCTION public.set_owner_id();
CREATE INDEX idx_safe_movements_safe ON public.safe_movements(safe_id, created_at DESC);

-- Expense types
CREATE TABLE public.expense_types (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.expense_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner all expense_types" ON public.expense_types FOR ALL
  USING ((auth.uid() = owner_id) OR has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK ((auth.uid() = owner_id) OR has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER expense_types_set_owner BEFORE INSERT ON public.expense_types
  FOR EACH ROW EXECUTE FUNCTION public.set_owner_id();

-- Expenses
CREATE TABLE public.expenses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL,
  safe_id UUID NOT NULL REFERENCES public.safes(id) ON DELETE RESTRICT,
  expense_type_id UUID REFERENCES public.expense_types(id) ON DELETE SET NULL,
  amount NUMERIC NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner all expenses" ON public.expenses FOR ALL
  USING ((auth.uid() = owner_id) OR has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK ((auth.uid() = owner_id) OR has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER expenses_set_owner BEFORE INSERT ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION public.set_owner_id();

-- Purchases
CREATE TABLE public.purchases (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL,
  safe_id UUID NOT NULL REFERENCES public.safes(id) ON DELETE RESTRICT,
  amount NUMERIC NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner all purchases" ON public.purchases FOR ALL
  USING ((auth.uid() = owner_id) OR has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK ((auth.uid() = owner_id) OR has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER purchases_set_owner BEFORE INSERT ON public.purchases
  FOR EACH ROW EXECUTE FUNCTION public.set_owner_id();
