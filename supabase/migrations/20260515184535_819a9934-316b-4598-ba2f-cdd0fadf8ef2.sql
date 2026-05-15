
CREATE TABLE public.landing_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  slug text NOT NULL UNIQUE,
  title text NOT NULL DEFAULT '',
  subtitle text DEFAULT '',
  description text DEFAULT '',
  images text[] NOT NULL DEFAULT '{}',
  price numeric,
  original_price numeric,
  upsell_enabled boolean NOT NULL DEFAULT false,
  upsell_offers jsonb NOT NULL DEFAULT '[]',
  is_visible boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_landing_pages_product_id ON public.landing_pages(product_id);
CREATE INDEX idx_landing_pages_owner_id ON public.landing_pages(owner_id);

ALTER TABLE public.landing_pages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read landing_pages"
  ON public.landing_pages FOR SELECT
  USING (true);

CREATE POLICY "Owner write landing_pages"
  ON public.landing_pages FOR ALL
  USING (is_member_of(owner_id) OR has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (is_member_of(owner_id) OR has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER set_landing_pages_owner
  BEFORE INSERT ON public.landing_pages
  FOR EACH ROW
  EXECUTE FUNCTION public.set_owner_id();

CREATE TRIGGER update_landing_pages_updated_at
  BEFORE UPDATE ON public.landing_pages
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Backfill: create a landing_page for every existing product that has a slug
INSERT INTO public.landing_pages (
  owner_id, product_id, slug, title, description, images, price, original_price,
  upsell_enabled, upsell_offers, is_visible, created_at, updated_at
)
SELECT
  p.owner_id, p.id, p.slug, p.name, COALESCE(p.description, ''), COALESCE(p.images, '{}'),
  p.price, p.original_price, p.upsell_enabled, p.upsell_offers, p.is_visible,
  p.created_at, p.updated_at
FROM public.products p
WHERE p.slug IS NOT NULL
  AND p.deleted_at IS NULL
  AND NOT EXISTS (SELECT 1 FROM public.landing_pages lp WHERE lp.slug = p.slug);
