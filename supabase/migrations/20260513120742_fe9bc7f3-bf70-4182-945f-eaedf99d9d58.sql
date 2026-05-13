-- Add ai_auto_reply_enabled flag to whatsapp_settings
ALTER TABLE public.whatsapp_settings
ADD COLUMN IF NOT EXISTS ai_auto_reply_enabled boolean NOT NULL DEFAULT false;