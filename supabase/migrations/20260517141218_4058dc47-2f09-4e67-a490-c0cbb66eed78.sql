-- New columns on orders
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS assigned_to uuid,
  ADD COLUMN IF NOT EXISTS last_attempt_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancellation_reason text;

CREATE INDEX IF NOT EXISTS idx_orders_assigned_to ON public.orders(assigned_to);
CREATE INDEX IF NOT EXISTS idx_orders_postponed_until ON public.orders(postponed_until);

-- Confirmation templates (WhatsApp / SMS message templates)
CREATE TABLE IF NOT EXISTS public.confirmation_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  name text NOT NULL,
  channel text NOT NULL DEFAULT 'whatsapp',
  body text NOT NULL,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.confirmation_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Owner all confirmation_templates" ON public.confirmation_templates;
CREATE POLICY "Owner all confirmation_templates" ON public.confirmation_templates FOR ALL
  USING (is_member_of(owner_id) OR has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (is_member_of(owner_id) OR has_role(auth.uid(), 'admin'::app_role));
DROP TRIGGER IF EXISTS set_owner_confirmation_templates ON public.confirmation_templates;
CREATE TRIGGER set_owner_confirmation_templates BEFORE INSERT ON public.confirmation_templates
  FOR EACH ROW EXECUTE FUNCTION public.set_owner_id();
DROP TRIGGER IF EXISTS upd_confirmation_templates ON public.confirmation_templates;
CREATE TRIGGER upd_confirmation_templates BEFORE UPDATE ON public.confirmation_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Cancellation reasons
CREATE TABLE IF NOT EXISTS public.cancellation_reasons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  label text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.cancellation_reasons ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Owner all cancellation_reasons" ON public.cancellation_reasons;
CREATE POLICY "Owner all cancellation_reasons" ON public.cancellation_reasons FOR ALL
  USING (is_member_of(owner_id) OR has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (is_member_of(owner_id) OR has_role(auth.uid(), 'admin'::app_role));
DROP TRIGGER IF EXISTS set_owner_cancellation_reasons ON public.cancellation_reasons;
CREATE TRIGGER set_owner_cancellation_reasons BEFORE INSERT ON public.cancellation_reasons
  FOR EACH ROW EXECUTE FUNCTION public.set_owner_id();

-- Confirmation settings (one row per owner)
CREATE TABLE IF NOT EXISTS public.confirmation_settings (
  owner_id uuid PRIMARY KEY,
  max_no_answer_attempts integer NOT NULL DEFAULT 3,
  auto_cancel_after_hours integer NOT NULL DEFAULT 0,
  work_hours_start text NOT NULL DEFAULT '09:00',
  work_hours_end text NOT NULL DEFAULT '21:00',
  auto_assign_enabled boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.confirmation_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Owner all confirmation_settings" ON public.confirmation_settings;
CREATE POLICY "Owner all confirmation_settings" ON public.confirmation_settings FOR ALL
  USING (is_member_of(owner_id) OR has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (is_member_of(owner_id) OR has_role(auth.uid(), 'admin'::app_role));
DROP TRIGGER IF EXISTS upd_confirmation_settings ON public.confirmation_settings;
CREATE TRIGGER upd_confirmation_settings BEFORE UPDATE ON public.confirmation_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed permissions
INSERT INTO public.permissions (key, label, category) VALUES
  ('confirmation.access', 'الدخول لمركز تأكيد الطلبات', 'تأكيد الطلبات'),
  ('confirmation.cancel', 'إلغاء الطلب أثناء التأكيد', 'تأكيد الطلبات'),
  ('confirmation.settings', 'إعدادات وقوالب التأكيد', 'تأكيد الطلبات')
ON CONFLICT (key) DO NOTHING;