-- Stock movements ledger
CREATE TABLE public.stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL,
  product_id UUID,
  product_name TEXT,
  variant_key TEXT,
  warehouse_code TEXT,
  qty INTEGER NOT NULL,
  reason TEXT NOT NULL,
  order_id UUID,
  return_id UUID,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner all stock_movements"
ON public.stock_movements FOR ALL
USING (auth.uid() = owner_id OR has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (auth.uid() = owner_id OR has_role(auth.uid(), 'admin'::app_role));

-- Idempotency: don't double-apply same (order, reason, variant, warehouse_code) combo
CREATE UNIQUE INDEX uq_stock_mov_order_reason
ON public.stock_movements (
  order_id, reason,
  COALESCE(variant_key, ''),
  COALESCE(warehouse_code, ''),
  COALESCE(product_id, '00000000-0000-0000-0000-000000000000'::uuid)
)
WHERE order_id IS NOT NULL;

CREATE INDEX idx_stock_mov_owner_created ON public.stock_movements (owner_id, created_at DESC);
CREATE INDEX idx_stock_mov_product ON public.stock_movements (product_id);