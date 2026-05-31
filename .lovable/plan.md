# إصلاح الرد التلقائي بالذكاء الاصطناعي على واتساب

## المشكلة
العملاء يرسلون رسائل واتساب عبر MazBot، وتُحفظ بنجاح في قاعدة البيانات، لكن لا يأتي أي رد من الذكاء الاصطناعي. بفحص السجلات تبيّن أن دالة `whatsapp-ai-reply` **لم تُنفَّذ نهائياً** رغم أن `ai_auto_reply_enabled = true`.

## السبب الجذري
في `supabase/functions/mazbot-poll/index.ts` (السطور 262-272):
- يتم استدعاء `whatsapp-ai-reply` عبر `fetch(...).catch(...)` ثم `queueBackground` (waitUntil)
- إن فشل الطلب أو رجع 4xx/5xx — يُبتلع الخطأ بدون تسجيل
- لا يوجد سجل واحد يثبت أن الطلب وصل (0 logs عبر اليوم كله)

## الخطة

### 1. إصلاح آلية الاستدعاء في `mazbot-poll`
- استخدام `supabase.functions.invoke('whatsapp-ai-reply', ...)` بدل `fetch` اليدوي (أبسط ويحلّ مشاكل الـ headers)
- انتظار النتيجة بعد الحلقة (Promise واحد لكل room بدلاً من background) لضمان أن الـ Edge Runtime لا يُغلق قبل الإرسال
- تسجيل النتيجة/الخطأ بـ `console.log/error` لنتمكن من التشخيص لاحقاً

### 2. نفس الإصلاح في `whatsapp-webhook` (مسار Wati/WhatChimp)
نفس المشكلة موجودة هناك (السطور 183-193 و 397-410) — نطبّق نفس الحل.

### 3. تحسين `whatsapp-ai-reply` لإرجاع أخطاء واضحة
- إذا فشل LOVABLE_API_KEY بسبب رصيد منتهٍ (402) أو حد المعدّل (429) — يُسجَّل بوضوح
- إرجاع status code مناسب بدل 500 مبهم

### 4. التحقق
- إعادة نشر الدوال الثلاث
- مراقبة سجلات `whatsapp-ai-reply` بعد رسالة عميل جديدة
- التأكد من ظهور ردود AI في المحادثة

## ملفات سيتم تعديلها
- `supabase/functions/mazbot-poll/index.ts`
- `supabase/functions/whatsapp-webhook/index.ts`
- `supabase/functions/whatsapp-ai-reply/index.ts` (تحسين الأخطاء فقط)

## ملاحظة مهمة
إذا كان رصيد Lovable AI منتهياً (كما أشرت سابقاً برسالة "Insufficient funds")، فالـ AI سيرجع 402 وسيظهر الخطأ في السجلات بعد الإصلاح، وعندها ستحتاج لشحن الرصيد ليعمل الرد فعلياً.
