# خطة تطوير واتساب الذكي

## 1. تسريع البولينج إلى 10 ثوانٍ
- إعادة جدولة `pg_cron` للوظيفة `mazbot-poll-every-30s` إلى `10 seconds` (الحد الأدنى الآمن لـ pg_cron على Supabase).
- إضافة قفل خفيف داخل `mazbot-poll` لمنع تداخل التشغيلات المتوازية (إذا استغرق التشغيل أكثر من 10ث).
- تقليل عدد قراءات DB غير الضرورية لكل دورة (تجاهل الغرف غير المتغيرة عبر `last_conversation_at`).

## 2. إرسال رسالة تأكيد فور إنشاء الطلب
- استدعاء `whatsapp-send-confirmation` تلقائياً من `create-order` بعد نجاح الإدخال (إن لم يكن مستدعى).
- نص الرسالة يستخدم القالب الموجود في `whatsapp_settings.confirm_template` + يوضّح كيفية الرد ("نعم/لا/أكيد/الغاء…").

## 3. تأكيد/إلغاء بصياغات حرة عبر AI
- في `mazbot-poll`، توسيع `parseConfirmIntent` ليشمل عبارات: "أكيد نبي"، "ما نبيش"، "بدلت رايي"، "اكسلي"، "موافق"، "خلاص"، "تمام"، "ايوا".
- عند الفشل في المطابقة الحرفية ووجود `lastPrompt` نشط (آخر 24س)، يُستدعى edge function جديد `whatsapp-classify-intent` يستخدم Lovable AI (Gemini Flash Lite + structured tool call) لتصنيف الرسالة إلى `confirm | cancel | other`، ثم تطبيق التأكيد/الإلغاء بناءً على النتيجة.

## 4. تذكير تلقائي إن لم يرد الزبون
- جدول جديد `confirmation_reminders` (order_id, conversation_id, scheduled_at, sent, attempts).
- بعد إرسال رسالة التأكيد الأولى، يُجدول تذكير بعد 30 دقيقة.
- cron جديد كل دقيقة `process-confirmation-reminders` يرسل تذكيراً لطيفاً، ثم بعد تذكيرين بدون رد يُعلَّم الطلب `needs_manual_review` ويظهر في "مركز التأكيد".

## 5. توسيع قدرات AI Reply
إضافات على `whatsapp-ai-reply`:
- **أداة `check_stock`**: تتحقق من توفر اللون/المقاس قبل قبول الطلب.
- **أداة `suggest_alternatives`**: عند نفاد المنتج، تقترح 2-3 منتجات شبيهة.
- **أداة `track_order`**: تجلب حالة شحنة من `orders` + carrier_status للعميل الذي يسأل "وين طلبي".
- **أداة `cancel_order`**: تلغي طلباً قائماً بطلب الزبون (مع تأكيد).
- **ذاكرة محادثة أوسع**: من 15 إلى 30 رسالة + ملخص للمحادثات الأطول.
- **نموذج أقوى**: ترقية من `gemini-2.5-flash` إلى `gemini-3-flash-preview` للسرعة والدقة.
- **حماية ضد التكرار**: عدم إنشاء طلب مكرر لنفس الزبون خلال 5 دقائق (فحص قبل `create_order`).
- **معالجة أسعار التوصيل في الـ prompt**: تمرير المدن السريعة جاهزة بدلاً من استدعاء أداة في كل مرة.

## التفاصيل التقنية

**ملفات ستُعدَّل:**
- `supabase/functions/mazbot-poll/index.ts` — قفل، parseIntent موسّع، استدعاء classifier
- `supabase/functions/whatsapp-ai-reply/index.ts` — 4 أدوات جديدة + نموذج محدّث
- `supabase/functions/create-order/index.ts` — استدعاء confirmation بعد الإنشاء
- `supabase/config.toml` — تسجيل الدوال الجديدة

**ملفات جديدة:**
- `supabase/functions/whatsapp-classify-intent/index.ts` — تصنيف نية الرسالة
- `supabase/functions/process-confirmation-reminders/index.ts` — التذكيرات
- `supabase/functions/mazbot-poll-trigger/index.ts` — (اختياري) لو احتجنا تقسيم العمل

**ترحيلات DB:**
- إعادة جدولة `mazbot-poll-every-30s` إلى 10 ثوانٍ (عبر `supabase--insert` لأنها بيانات مستخدم).
- جدول `confirmation_reminders` + RLS + GRANTs.
- إضافة عمود `needs_manual_review` و `reminder_count` إلى `orders`.
- جدولة `process-confirmation-reminders` كل دقيقة.

**ملاحظات:**
- كل استدعاءات AI تذهب عبر Lovable AI Gateway باستخدام `LOVABLE_API_KEY` (موجود).
- معالجة أخطاء 429/402 من Gateway مع fallback للقواعد الحرفية.
- لا تغييرات على الواجهة الأمامية (UI) سوى إضافة شارة "بانتظار التأكيد" + "بحاجة لمتابعة يدوية" في صفحة الطلبات.
