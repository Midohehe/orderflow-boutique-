
CREATE OR REPLACE FUNCTION public.set_owner_id()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.owner_id IS NULL THEN
    NEW.owner_id := auth.uid();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_owner_products       BEFORE INSERT ON public.products       FOR EACH ROW EXECUTE FUNCTION public.set_owner_id();
CREATE TRIGGER trg_owner_purchases      BEFORE INSERT ON public.purchases      FOR EACH ROW EXECUTE FUNCTION public.set_owner_id();
CREATE TRIGGER trg_owner_shipping_settings BEFORE INSERT ON public.shipping_settings FOR EACH ROW EXECUTE FUNCTION public.set_owner_id();
CREATE TRIGGER trg_owner_shipping_zones BEFORE INSERT ON public.shipping_zones FOR EACH ROW EXECUTE FUNCTION public.set_owner_id();
CREATE TRIGGER trg_owner_header         BEFORE INSERT ON public.header_settings FOR EACH ROW EXECUTE FUNCTION public.set_owner_id();
CREATE TRIGGER trg_owner_store          BEFORE INSERT ON public.store_settings FOR EACH ROW EXECUTE FUNCTION public.set_owner_id();
CREATE TRIGGER trg_owner_pixel          BEFORE INSERT ON public.pixel_settings FOR EACH ROW EXECUTE FUNCTION public.set_owner_id();
CREATE TRIGGER trg_owner_form           BEFORE INSERT ON public.order_form_fields FOR EACH ROW EXECUTE FUNCTION public.set_owner_id();
