
## الهدف
تحسين دقة ردود مساعد الواتساب وتقليل التكلفة، مع منح المسؤول تحكماً كاملاً في "تدريب" النموذج عبر تعليمات عامة + جدول أسئلة وأجوبة.

## 1) تبديل النموذج
- في `supabase/functions/whatsapp-ai-reply/index.ts` تغيير الـmodel من `google/gemini-3-flash-preview` إلى **`google/gemini-2.5-flash`** (دقة أعلى من 3-flash-preview في المحادثات العربية، وسعر اقتصادي).
- إبقاء `whatsapp-classify-intent` على `gemini-2.5-flash-lite` (تصنيف بسيط).

## 2) قاعدة بيانات التدريب
Migration واحد ينشئ جدولين:

### جدول `ai_training_settings` (تعليمات عامة)
- `owner_id` (PK, FK auth.users)
- `custom_instructions` text — تُضاف إلى الـsystem prompt
- `tone` text (مثلاً: ودود/رسمي) — اختياري
- `enabled` bool default true

### جدول `ai_training_qa` (أسئلة وأجوبة)
- `id` uuid PK
- `owner_id` uuid
- `question` text — مثال "متى يوصل الطلب؟"
- `answer` text — الجواب الذي يرد به النموذج
- `keywords` text[] — كلمات مفتاحية للبحث السريع (اختياري)
- `enabled` bool default true
- `sort_order` int

كلا الجدولين: RLS scoped على `auth.uid() = owner_id`، GRANTs مناسبة، تريغر `updated_at`.

## 3) دمجها في الـsystem prompt
في `whatsapp-ai-reply`:
1. جلب `ai_training_settings` + كل `ai_training_qa` المفعّلة للمالك (بالتوازي مع الاستعلامات الحالية).
2. إضافة قسمين جديدين داخل `systemPrompt`:
   ```
   📌 تعليمات إضافية من المتجر:
   {custom_instructions}

   📚 أسئلة وأجوبة جاهزة (استخدم نفس الجواب إن طابق سؤال الزبون):
   - س: {question}
     ج: {answer}
   ```
3. لا تغيير على الـtools أو حلقة الـagent.

## 4) واجهة الإدارة
صفحة جديدة `src/pages/AITrainingSettings.tsx` (مسار `/dashboard/ai-training`):
- قسم "تعليمات عامة": Textarea كبير + سويتش تفعيل + زر حفظ.
- قسم "أسئلة وأجوبة":
  - جدول/قائمة بطاقات للـQA الموجودة (تعديل/حذف/تفعيل).
  - زر "+ إضافة سؤال" يفتح Dialog (سؤال، جواب، كلمات مفتاحية اختيارية).
  - السحب لإعادة الترتيب (اختياري — أو حقل sort_order يدوي).
- إضافة رابط في `DashboardLayout` ضمن قسم الواتساب/الإعدادات.

## التفاصيل التقنية
- استخدام `supabase.from('ai_training_qa').select()` مع RLS التلقائي.
- تنظيف HTML/قص الإجابات الطويلة قبل الحقن في الـprompt (حد 500 حرف لكل إجابة، إجمالي ~4000 حرف لمنع تضخم الـcontext).
- لا تعديل على إرسال الواتساب أو منطق الطلبات.

## الملفات المتأثرة
- Migration جديد (جدولان + RLS + GRANTs + trigger).
- `supabase/functions/whatsapp-ai-reply/index.ts` (تغيير model + قراءة جداول التدريب + دمج في prompt).
- `src/pages/AITrainingSettings.tsx` (جديد).
- `src/App.tsx` (إضافة route).
- `src/components/DashboardLayout.tsx` (رابط في القائمة).
