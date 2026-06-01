## السبب الجذري

الخطأ الحقيقي من MazBot الآن ظاهر في `whatsapp_messages.error`:

```
attempt2: { status: 422, body: { "receiver_id": ["The receiver id field is required."] } }
contactId: null
```

أي أن `mazbotEnsureContact()` يرجع `null`، فينتقل الكود للبديل عبر `/send-message` بـ `mobile=` فقط، لكن MazBot يرفضه ويطلب `receiver_id` إلزامياً.

سبب إرجاع `null`: الرقم يُمرَّر بصيغة `218925243296` بينما MazBot يخزّن جهة الاتصال بصيغة `+218925243296` (واضح في `raw.contact_name` للرسائل الواردة). كل عمليات البحث في `mazbotEnsureContact` تفشل لذلك، ومحاولة الإنشاء تُرجع رداً بدون `id` قابل للاستخراج.

## الخطة (ملف واحد فقط)

تعديل `supabase/functions/_shared/wa-providers.ts` داخل دالة `mazbotEnsureContact`:

1. **توسيع صيغ البحث** لتشمل النسخة مع `+`:
   - `+218...` بدل `218...` فقط
   - تجربة `/contacts?search=+digits` و `/contacts?mobile=+digits` و `/contacts?phone=+digits`

2. **توسيع `extractId`** ليتعرف على شكل إضافي محتمل من MazBot:
   - `d?.data?.data?.[0]?.id`
   - مطابقة `String(c.mobile).replace(/^\+/, '')` مع `digits` (لإزالة + قبل المقارنة)

3. **عند فشل كل المحاولات**: تسجيل (`console.log`) آخر استجابة بحث وإنشاء لتشخيص أعمق في حال بقي الفشل.

4. **تحسين `attempt2` (الإرسال عبر mobile)**: تجربة الرقم بالصيغتين (`+digits` و `digits`) لأن بعض نسخ MazBot تقبل الإرسال المباشر بالرقم دون `receiver_id` فقط عندما تكون الصيغة صحيحة.

## التحقق

بعد النشر، أطلب من المستخدم إرسال رسالة جديدة. أقرأ السجل من `whatsapp_messages`:
- المتوقع: `status='sent'` و `green_message_id != null`.
- لو ما زال يفشل: حقل `error` سيحتوي الآن استجابة بحث/إنشاء حقيقية تكشف صيغة الـ ID المطلوب.

لا توجد تغييرات على المخطط أو على الواجهة.
