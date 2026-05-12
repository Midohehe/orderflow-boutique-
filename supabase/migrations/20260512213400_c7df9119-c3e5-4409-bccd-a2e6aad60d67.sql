
ALTER TABLE public.settlements ADD COLUMN IF NOT EXISTS safe_id UUID REFERENCES public.safes(id) ON DELETE SET NULL;
