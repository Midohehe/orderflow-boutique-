ALTER TABLE public.store_settings
  ADD COLUMN IF NOT EXISTS button_text text NOT NULL DEFAULT 'اطلب الآن',
  ADD COLUMN IF NOT EXISTS success_message text NOT NULL DEFAULT 'شكراً لك! تم استلام طلبك بنجاح';