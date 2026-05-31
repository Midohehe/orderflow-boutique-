## التشخيص

اختبرت الطلب فعلياً على `https://www.was-la.com/p/katro` ورصدت في الكونسول والشبكة:

```
POST /rest/v1/analytics_events  →  400
PGRST204: Could not find the 'fb_adset_id' column of 'analytics_events' in the schema cache
```

### السبب الجذري
الكود في `LandingPage.tsx` (داخل `getAttribution()` و `trackCheckoutStart`) يحاول إدراج عمود `fb_adset_id` في جدول `analytics_events` — **لكن هذا العمود غير موجود في الجدول**. الأعمدة الموجودة فعلياً:
`fb_campaign_id`, `fb_ad_id`, `fbclid` فقط (بدون `fb_adset_id`).

نفس الكود يُستخدم في تتبع `page_view` و `checkout_start` ولإرسال الطلب — أي محاولة تتبع تفشل بـ 400 وتظهر للمستخدم رسالة خطأ.

ملاحظة جانبية: جدول `orders` يحتوي `fb_adset_id` بشكل سليم، لذا إدراج الطلب نفسه ليس فيه مشكلة على مستوى قاعدة البيانات.

## خطة الإصلاح

### 1. إضافة العمود الناقص في `analytics_events`
هجرة SQL تضيف `fb_adset_id TEXT` للجدول (متوافق مع باقي الأعمدة الإعلانية).

```sql
ALTER TABLE public.analytics_events
  ADD COLUMN IF NOT EXISTS fb_adset_id text;
```

لا حاجة لتعديل الـ GRANTs أو الـ RLS لأن الجدول موجود مسبقاً وسياساته قائمة.

### 2. التحقق بعد التطبيق
- إعادة تجربة طلب فعلي على نفس صفحة `/p/katro`.
- التأكد من اختفاء الخطأ من الكونسول.
- التأكد من وصول الطلب لقائمة الطلبات وانتقال المستخدم لصفحة الشكر.

## ملاحظة إضافية (لاحقة، ليست ضمن هذا الإصلاح)
في لوغات `ship-orders` رصدت خطأين متكررين مع شركة الشحن لا علاقة لهما بهذه المشكلة:
- `Validation failed: input.shipmentProducts.0.quantity` (كميات غير صالحة)
- `Selected region doesn't exists in customer price list` (منطقة الشحن غير مُسعَّرة)

أقدر أعالجهم في طلب منفصل لو رغبت.
