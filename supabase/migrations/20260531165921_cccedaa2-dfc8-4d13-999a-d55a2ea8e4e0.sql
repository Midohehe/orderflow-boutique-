ALTER TABLE public.whatsapp_settings
  ADD COLUMN IF NOT EXISTS whatchimp_send_endpoint text NOT NULL DEFAULT 'https://app.whatchimp.com/api/v1/whatsapp/send',
  ADD COLUMN IF NOT EXISTS whatchimp_template_endpoint text NOT NULL DEFAULT 'https://app.whatchimp.com/api/v1/whatsapp/send/template',
  ADD COLUMN IF NOT EXISTS whatchimp_conversation_endpoint text NOT NULL DEFAULT 'https://app.whatchimp.com/api/v1/whatsapp/get/conversation';

UPDATE public.whatsapp_settings
SET
  whatchimp_send_endpoint = CASE
    WHEN COALESCE(trim(whatchimp_send_endpoint), '') = '' THEN 'https://app.whatchimp.com/api/v1/whatsapp/send'
    ELSE whatchimp_send_endpoint
  END,
  whatchimp_template_endpoint = CASE
    WHEN COALESCE(trim(whatchimp_template_endpoint), '') = '' THEN 'https://app.whatchimp.com/api/v1/whatsapp/send/template'
    ELSE whatchimp_template_endpoint
  END,
  whatchimp_conversation_endpoint = CASE
    WHEN COALESCE(trim(whatchimp_conversation_endpoint), '') = '' THEN 'https://app.whatchimp.com/api/v1/whatsapp/get/conversation'
    ELSE whatchimp_conversation_endpoint
  END,
  whatchimp_api_url = CASE
    WHEN whatchimp_api_url LIKE '%/api/v1/whatsapp/%' THEN 'https://app.whatchimp.com'
    WHEN COALESCE(trim(whatchimp_api_url), '') = '' THEN 'https://app.whatchimp.com'
    ELSE regexp_replace(whatchimp_api_url, '/+$', '')
  END;