## المشكلة
رسائل الـ AI الطويلة تُحفظ في صندوق الوارد بحالة **failed** ولا تصل لواتساب الزبون، بينما الرسائل القصيرة المُرسلة يدوياً من لوحة المحادثات تنجح (مع `green_message_id: mazbot:xxx`).

## السبب المرجّح
- دالة `whatsapp-ai-reply` تحفظ الفشل لكن **لا تسجل سبب الخطأ** من MazBot (حقل `error` يبقى فارغاً).
- MazBot غالباً يرفض الرسائل بسبب: طول الرسالة، أو محارف Markdown (`**bold**`)، أو رموز emoji، أو فشل البحث عن `receiver_id` ثم فشل الـ fallback.
- بدون تسجيل الـ raw response لا نستطيع الجزم.

## الخطوات

### 1. التقاط الخطأ (تشخيص فوري)
- في `supabase/functions/whatsapp-ai-reply/index.ts` عند `insert` للرسالة الصادرة:
  - أضف `error: providerOk ? null : JSON.stringify(sendRes.raw).slice(0,500)`.
  - أضف `console.log("[ai-reply] sendText result", JSON.stringify(sendRes).slice(0,500))`.

### 2. تنظيف نص الرد قبل الإرسال
في نفس الملف، قبل `sendText`:
- إزالة Markdown bold/italic: `**x**` → `x`, `*x*` → `x`, `__x__` → `x`.
- استبدال الـ bullet points (`•`, `-`) ببداية سطر عادية.
- قص الرسالة إلى 1000 محرف كحد أقصى (MazBot لا يقبل رسائل طويلة جداً).

### 3. تحسين منطق MazBot في `_shared/wa-providers.ts`
- في `sendText` لمزود mazbot: عند فشل `receiver_id` و fallback `mobile`، **سجّل** السبب بشكل أوضح في `raw` (status code + body).
- جرّب أيضاً حقل `receiver` (بعض نسخ MazBot تستخدمه بدلاً من `mobile`).

### 4. التحقق
- بعد النشر، أرسل رسالة جديدة من واتساب الزبون لتفعيل AI.
- افحص `whatsapp_messages.error` للرسالة الصادرة الجديدة لمعرفة رد MazBot الحقيقي.
- بناءً على الخطأ المعروض نقرر الإصلاح النهائي (مثلاً تقسيم الرسالة، تغيير endpoint، إلخ).

## الملفات المعدّلة
- `supabase/functions/whatsapp-ai-reply/index.ts` — حفظ الخطأ + تنظيف النص + تسجيل.
- `supabase/functions/_shared/wa-providers.ts` — تحسين تسجيل خطأ MazBot + محاولة إضافية.

## ملاحظة
هذه خطوة تشخيصية + إصلاح أولي. بعد رؤية أول `error` حقيقي في قاعدة البيانات، قد نحتاج تعديلاً إضافياً (تقسيم رسائل، تغيير endpoint، إلخ).
