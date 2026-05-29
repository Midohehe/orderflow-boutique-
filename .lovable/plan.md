# خطة إكمال ربط WhatChimp

## 1. قاعدة البيانات (migration واحدة)

**جدول `whatsapp_webhook_tokens`:**
- `id`, `owner_id` (المالك الأساسي)
- `token` (فريد، يُولَّد تلقائياً)
- `label` (وصف اختياري للتمييز)
- `created_at`, `last_used_at`

**جدول `whatsapp_token_stores`** (ربط توكن بأكثر من متجر — للأدمن):
- `id`, `token_id` (FK)، `store_id` (FK)
- يسمح للأدمن بإضافة متاجر إضافية لنفس التوكن

**RLS:**
- المستخدم العادي: يدير توكناته فقط (`owner_id = auth.uid()`).
- الأدمن (`has_role admin`): يدير أي توكن + يضيف/يحذف ربط متاجر.

**GRANT:** authenticated (CRUD محدود بـRLS) + service_role (للـwebhook).

## 2. تعديل `whatsapp-webhook`
- يقبل `?provider=whatchimp&token=XXX`.
- يبحث عن التوكن → يحدد `owner_id` + قائمة المتاجر المرتبطة.
- يفك تشفير payload WhatChimp:
  - **الرسائل الواردة**: يحفظ في `whatsapp_messages` (direction=in) ويحدّث/ينشئ `whatsapp_conversations`.
  - **تحديثات الحالة** (sent/delivered/read/failed): يحدّث `whatsapp_messages.status` عبر `green_message_id`.
- يستدعي `whatsapp-ai-reply` للرسائل الواردة.

## 3. تعديل `whatsapp-ai-reply`
- يقرأ `provider` من `whatsapp_settings` (whatchimp أو green_api).
- يرسل الرد عبر WhatChimp API عند الحاجة.
- **معالجة كلمات مفتاحية** للرسائل الواردة على طلب:
  - "تأكيد" / "نعم" → تحديث حالة الطلب إلى `confirmed`.
  - "إلغاء" / "لا" → تحديث إلى `cancelled`.

## 4. واجهة المستخدم (`WhatsAppPage.tsx`)
قسم جديد **"رابط Webhook لـ WhatChimp"**:
- زر "توليد توكن جديد" (مع label اختياري).
- جدول التوكنات الحالية: التوكن، الرابط الكامل، زر نسخ، آخر استخدام، حذف.
- الرابط يكون:
  ```
  https://iyqooryhmshlajuhabmc.supabase.co/functions/v1/whatsapp-webhook?provider=whatchimp&token=<token>
  ```
- تعليمات قصيرة: انسخ الرابط → WhatChimp ← Webhook Settings.

## 5. واجهة الأدمن
في صفحة `AdminStoreDetail` أو قسم جديد ضمن إعدادات WhatsApp للأدمن فقط:
- اختيار توكن موجود + إضافة متجر/متاجر إضافية مرتبطة به.
- عرض المتاجر المرتبطة بكل توكن مع زر إزالة.

## 6. الاختبار
1. توليد توكن من الواجهة ولصقه في WhatChimp.
2. إرسال رسالة من رقم خارجي → تظهر في صفحة المحادثات.
3. كتابة "تأكيد" على رسالة طلب → تتغير حالة الطلب.

## ملفات ستتغير
- migration جديدة (جدولان + RLS + GRANT)
- `supabase/functions/whatsapp-webhook/index.ts`
- `supabase/functions/whatsapp-ai-reply/index.ts`
- `src/pages/WhatsAppPage.tsx`
- `src/pages/AdminStoreDetail.tsx` (قسم ربط متاجر بتوكن)

اضغط **Implement plan** للبدء.
