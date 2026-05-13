-- WhatsApp Settings (Green API credentials per owner)
CREATE TABLE public.whatsapp_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL UNIQUE,
  enabled BOOLEAN NOT NULL DEFAULT false,
  instance_id TEXT NOT NULL DEFAULT '',
  api_token TEXT NOT NULL DEFAULT '',
  api_url TEXT NOT NULL DEFAULT 'https://api.green-api.com',
  webhook_token TEXT,
  auto_confirm_enabled BOOLEAN NOT NULL DEFAULT true,
  confirm_template TEXT NOT NULL DEFAULT 'مرحباً {customer_name} 👋
طلبك رقم #{order_id}
{products}
الإجمالي: {total} {currency}

للتأكيد أرسل: 1 أو "نعم"
للإلغاء أرسل: 2 أو "لا"',
  welcome_template TEXT NOT NULL DEFAULT 'شكراً لتواصلك معنا، سنرد عليك قريباً.',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.whatsapp_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner all whatsapp_settings"
ON public.whatsapp_settings FOR ALL
USING (auth.uid() = owner_id OR has_role(auth.uid(), 'admin'))
WITH CHECK (auth.uid() = owner_id OR has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_wa_settings_updated
BEFORE UPDATE ON public.whatsapp_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_wa_settings_owner
BEFORE INSERT ON public.whatsapp_settings
FOR EACH ROW EXECUTE FUNCTION public.set_owner_id();

-- Auto-generate webhook_token using existing trigger function
CREATE TRIGGER trg_wa_settings_token
BEFORE INSERT ON public.whatsapp_settings
FOR EACH ROW EXECUTE FUNCTION public.generate_webhook_token();

-- Conversations
CREATE TABLE public.whatsapp_conversations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL,
  phone TEXT NOT NULL,
  customer_name TEXT,
  order_id UUID,
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_message_preview TEXT,
  unread_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (owner_id, phone)
);

CREATE INDEX idx_wa_conv_owner_last ON public.whatsapp_conversations(owner_id, last_message_at DESC);
CREATE INDEX idx_wa_conv_order ON public.whatsapp_conversations(order_id);

ALTER TABLE public.whatsapp_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner all whatsapp_conversations"
ON public.whatsapp_conversations FOR ALL
USING (auth.uid() = owner_id OR has_role(auth.uid(), 'admin'))
WITH CHECK (auth.uid() = owner_id OR has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_wa_conv_updated
BEFORE UPDATE ON public.whatsapp_conversations
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Messages
CREATE TABLE public.whatsapp_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL,
  conversation_id UUID NOT NULL REFERENCES public.whatsapp_conversations(id) ON DELETE CASCADE,
  order_id UUID,
  direction TEXT NOT NULL CHECK (direction IN ('in','out')),
  message_type TEXT NOT NULL DEFAULT 'text' CHECK (message_type IN ('text','image','file','audio','video','sticker','location','contact','system')),
  content TEXT,
  media_url TEXT,
  media_mime TEXT,
  media_filename TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sent','delivered','read','failed')),
  green_message_id TEXT,
  error TEXT,
  raw JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_wa_msg_conv ON public.whatsapp_messages(conversation_id, created_at);
CREATE INDEX idx_wa_msg_owner ON public.whatsapp_messages(owner_id, created_at DESC);
CREATE INDEX idx_wa_msg_green ON public.whatsapp_messages(green_message_id) WHERE green_message_id IS NOT NULL;

ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner all whatsapp_messages"
ON public.whatsapp_messages FOR ALL
USING (auth.uid() = owner_id OR has_role(auth.uid(), 'admin'))
WITH CHECK (auth.uid() = owner_id OR has_role(auth.uid(), 'admin'));

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_conversations;
ALTER TABLE public.whatsapp_messages REPLICA IDENTITY FULL;
ALTER TABLE public.whatsapp_conversations REPLICA IDENTITY FULL;