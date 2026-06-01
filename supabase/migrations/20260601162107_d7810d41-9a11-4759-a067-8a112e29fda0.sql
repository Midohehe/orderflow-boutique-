-- Add reminder settings + manual review tracking
ALTER TABLE public.whatsapp_settings
  ADD COLUMN IF NOT EXISTS reminder_minutes integer NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS reminder_max integer NOT NULL DEFAULT 2;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS last_confirm_prompt_at timestamptz,
  ADD COLUMN IF NOT EXISTS needs_manual_review boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_orders_pending_reminder
  ON public.orders (last_confirm_prompt_at)
  WHERE confirmation_status = 'pending' AND needs_manual_review = false;