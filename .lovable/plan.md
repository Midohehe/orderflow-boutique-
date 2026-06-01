## المشكلة

دوال `carrier-webhook` و `sync-carrier-statuses` تحدّث فقط نص `carrier_status` (للعرض)، ولا تحدّث `status` الداخلي للطلب إلا عند "تم التفريغ" (UPKBD/UPKBL/UKDB → unpacked). لذلك الطلبات اللي تم تسليمها أو رجعت تظل بحالة `shipped` بشكل دائم — حالياً عندنا 200+ طلب DTRC و 88 DTRUC و 290+ راجع كلها عالقة.

## الحل

### 1. خريطة تحويل الحالات (دالة مشتركة)
أضيف الخريطة التالية لكلتا الدالتين:

| كود شركة الشحن | الحالة الداخلية الجديدة |
|---|---|
| DTR, DTRC, DTRUC, DTRCP | `delivered` |
| RTRN (تم الإرجاع للراسل) | `returned_received` |
| RCV (ارتجاع للمخزن) | `returned_received` |
| UPKBL, UPKBD, UKDB | `unpacked` (موجود) |
| غير ذلك | بدون تغيير |

ملاحظة: عند تحويل الطلب إلى `returned_received`، الـ trigger الموجود `handle_order_return_refund` يعكس التسوية المالية تلقائياً إذا كانت موجودة.

### 2. تعديل `supabase/functions/carrier-webhook/index.ts`
- إضافة دالة `mapToInternalStatus(code)` ترجع الحالة الجديدة أو null.
- بدل الشرط الحالي `if (status === "UPKBD"...)`، نستخدم الخريطة لتحديد `updatePayload.status`.
- استدعاء `apply-order-stock` يبقى فقط لحالات unpacked.

### 3. تعديل `supabase/functions/sync-carrier-statuses/index.ts`
- نفس التعديل داخل `processOne`.
- إزالة استبعاد الطلبات اللي `status = 'shipped'` من الفلتر — هي بالفعل غير مستبعدة (الفلتر يستبعد فقط delivered/returned/cancelled/refunded)، لكن نتأكد إن المزامنة ستلتقطها.

### 4. مزامنة الطلبات القديمة (مهمة لمرة واحدة)
بعد نشر التغييرات، نشغّل تحديث SQL مباشر لكل الطلبات اللي عندها carrier_status نهائي لكن status لا يزال shipped:
- DTR/DTRC/DTRUC/DTRCP → `delivered`
- RTRN/RCV → `returned_received`

يتم تطبيقها كـ migration data update بعد موافقتك.

## الملفات المتأثرة

- `supabase/functions/carrier-webhook/index.ts` — تعديل
- `supabase/functions/sync-carrier-statuses/index.ts` — تعديل
- migration واحدة لتحديث الطلبات الموجودة

## خارج النطاق

- لا تغيير في الـ UI.
- حالات RTS / OTR / DEX / HTR تبقى shipped (مرحلية، ليست نهائية).
