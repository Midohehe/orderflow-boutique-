
CREATE TABLE public.thank_you_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL UNIQUE,
  title TEXT NOT NULL DEFAULT 'تم استلام طلبك بنجاح!',
  subtitle TEXT NOT NULL DEFAULT 'شكراً لك على ثقتك بنا',
  contact_message TEXT NOT NULL DEFAULT 'سنتواصل معك قريباً لتأكيد الطلب',
  shipping_message TEXT NOT NULL DEFAULT '🚚 شحن سريع خلال 2-5 أيام عمل',
  show_order_details BOOLEAN NOT NULL DEFAULT true,
  show_contact_info BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.thank_you_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read thank_you_settings"
ON public.thank_you_settings FOR SELECT
USING (true);

CREATE POLICY "Owner write thank_you_settings"
ON public.thank_you_settings FOR ALL
USING (is_member_of(owner_id) OR has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (is_member_of(owner_id) OR has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_thank_you_settings_updated_at
BEFORE UPDATE ON public.thank_you_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
