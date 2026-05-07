-- Create store_settings table for currency and other settings
CREATE TABLE public.store_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  currency_code TEXT NOT NULL DEFAULT 'AED',
  currency_symbol TEXT NOT NULL DEFAULT 'د.إ',
  currency_name TEXT NOT NULL DEFAULT 'درهم إماراتي',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create order_form_fields table
CREATE TABLE public.order_form_fields (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  field_key TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  placeholder TEXT NOT NULL DEFAULT '',
  field_type TEXT NOT NULL DEFAULT 'text',
  required BOOLEAN NOT NULL DEFAULT false,
  enabled BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.store_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_form_fields ENABLE ROW LEVEL SECURITY;

-- Policies for store_settings
CREATE POLICY "Allow public read store_settings" ON public.store_settings FOR SELECT USING (true);
CREATE POLICY "Allow public write store_settings" ON public.store_settings FOR ALL USING (true) WITH CHECK (true);

-- Policies for order_form_fields
CREATE POLICY "Allow public read order_form_fields" ON public.order_form_fields FOR SELECT USING (true);
CREATE POLICY "Allow public write order_form_fields" ON public.order_form_fields FOR ALL USING (true) WITH CHECK (true);

-- Insert default store settings
INSERT INTO public.store_settings (currency_code, currency_symbol, currency_name) 
VALUES ('AED', 'د.إ', 'درهم إماراتي');

-- Insert default form fields
INSERT INTO public.order_form_fields (field_key, label, placeholder, field_type, required, enabled, sort_order) VALUES
('name', 'الاسم الكامل', 'أدخل اسمك الكامل', 'text', true, true, 1),
('phone', 'رقم الهاتف', '+971 50 000 0000', 'phone', true, true, 2),
('city', 'المدينة', 'دبي', 'text', true, true, 3),
('address', 'العنوان', 'الشارع، رقم المبنى، رقم الشقة...', 'textarea', true, true, 4),
('email', 'البريد الإلكتروني', 'example@email.com', 'email', false, false, 5);

-- Add triggers for updated_at
CREATE TRIGGER update_store_settings_updated_at
BEFORE UPDATE ON public.store_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_order_form_fields_updated_at
BEFORE UPDATE ON public.order_form_fields
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();