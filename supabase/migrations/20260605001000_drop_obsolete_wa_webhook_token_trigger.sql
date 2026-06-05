-- Fix: "record \"new\" has no field \"webhook_token\"" when opening/saving
-- WhatsApp settings.
--
-- The webhook_token column was removed from public.whatsapp_settings (webhook
-- tokens now live in public.whatsapp_webhook_tokens), but the legacy BEFORE
-- INSERT/UPDATE trigger trg_wa_settings_token still calls generate_webhook_token(),
-- which assigns NEW.webhook_token. Since that column no longer exists, every
-- insert/update on whatsapp_settings fails. Drop only the obsolete trigger.
--
-- NOTE: generate_webhook_token() is still used by trigger profiles_webhook_token
-- on public.profiles (which DOES have a webhook_token column), so the function
-- itself must be kept.

DROP TRIGGER IF EXISTS trg_wa_settings_token ON public.whatsapp_settings;
