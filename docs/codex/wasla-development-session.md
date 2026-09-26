# سجل تطوير مشروع وصلة

## صور خيارات الألوان — 2026-09-26

أضيفت صور اختيارية للألوان في ProductForm وProducts ونموذج الطلب في LandingPage، مع دعم SSR والاستيراد وتنظيف صور الألوان المحذوفة. الملفات الجديدة: ColorImagesEditor.tsx وlib/colorImages.ts وscripts/check-color-images.cjs وmigration 20260926180000_product_color_images.sql.

ترتيب النشر: تطبيق migration قبل نشر الواجهة ووظيفة landing-ssr. طُبّق حقل color_images ونُشرت وظيفة landing-ssr بالإصدار 31 بعد موافقة المستخدم على النشر. نجح بناء Vite وفحص الصور والمخزون وفحوص التصميم المعتمد. مقارنة TypeScript بعد قراءة الملف القديم بترميز UTF-16: 40 تشخيصًا قبل وبعد، دون أخطاء جديدة. ملف types.ts أضيفت إليه علامة BOM لتصحيح تعرف TypeScript على ترميزه.

ملخص قابل للتسليم: C:\Users\WIN 10\Documents\Codex\2026-09-26\new-chat\outputs\wasla-color-images.md.

هذا الملف يحفظ خلاصة العمل المنفذ في محادثة تطوير نظام **وصلة**، ومكان كل ملف كود تم إنشاؤه أو تعديله. لا يحتوي الملف على مفاتيح Vercel أو Supabase أو أي بيانات سرية.

نسخة ملفات الكود الفعلية محفوظة داخل `docs/codex/wasla-code-snapshot/` مع نفس بنية المسارات الأصلية، ويمكن الرجوع إليها حتى بعد تغيير ملفات التطبيق مستقبلاً.

## المشروع المعتمد

- مستودع الإنتاج: `Midohehe/orderflow-boutique-`
- منصة النشر: Vercel
- الدومين: `https://www.was-la.com`
- فرع الإنتاج: `main`
- فرع العمل: `codex/approved-landing-template-live`
- آخر إصدار موثق: `9a35b5543c0c5607cef511ec752835ab8d1d587d`
- رابط المعاينة المستخدم: `https://www.was-la.com/p/samorai?preview=1`
- وظيفة Supabase المنشورة: `landing-ssr`، الإصدار 30

## النتيجة المعتمدة

- تصغير اسم المتجر في رأس صفحة الهبوط.
- عرض صورة المنتج قبل عنوانه في القالب القياسي.
- ترتيب الصفحة: الصورة، العنوان والعرض، نموذج الطلب، الوصف، التقييمات، ثم الأسئلة الشائعة.
- الإبقاء على نموذج طلب واحد فعّال.
- إضافة زر طلب ثابت أسفل شاشة الهاتف.
- تنسيق Mobile First وتحسين المسافات والأحجام والتباين.
- تنسيق أول ظهور SSR مع واجهة React لمنع تكرار المحتوى أثناء التحميل.
- تفعيل التصميم المحسن فقط عندما يحتوي غلاف الواجهة على العلامة `standard-approved-v1`.
- إضافة علامة التفعيل إلى `index.html` و`landing.html` لأن وظيفة SSR تقرأ `landing.html` أولاً.

## ملفات الواجهة

- `index.html` — علامة تفعيل التصميم في غلاف التطبيق.
- `landing.html` — علامة تفعيل التصميم في الغلاف الذي تستخدمه وظيفة SSR.
- `src/components/StoreHeader.tsx` — رأس مصغر لصفحات الهبوط مع الحفاظ على الأنماط الأخرى.
- `src/components/landing/StandardLandingLayout.tsx` — مكون ترتيب أقسام القالب القياسي.
- `src/components/landing/standard-landing-approved.css` — تنسيق القالب المحسن على الهاتف وسطح المكتب.
- `src/lib/approvedLandingDesign.ts` — رقم إصدار التصميم والترتيب المعتمد.
- `src/lib/landingSectionOrder.ts` — منطق ترتيب الأقسام والتوافق مع الصفحات القديمة.
- `src/pages/LandingPage.tsx` — دمج القالب، نموذج الطلب، SSR، الصور، والرأس المصغر.

## ملفات Supabase وSSR

- `supabase/functions/_shared/approved-standard-landing.ts` — HTML الخاص بأول ظهور للقالب المحسن.
- `supabase/functions/landing-ssr/index.ts` — اختيار التصميم، حقن بيانات الصفحة، وتجهيز أول ظهور سريع.

## الفحوصات والتوثيق

- `scripts/check-approved-landing.cjs` — يتحقق من ترتيب الأقسام، وجود نموذج واحد، الحالات الاختيارية، ووجود علامة التفعيل في الغلافين.
- `docs/approved-landing-release.md` — ملاحظات إصدار صفحة الهبوط.

نتيجة الفحص الأخيرة:

```text
PASS approved design activation marker exists in both application shells
PASS approved reading order and one functional checkout, including legacy form-first pages
PASS default layout compatibility and adjacent desktop checkout columns
PASS products without optional sections keep images, heading, and checkout
```

## التزامات Git

- `0f94f3e` — تطبيق تصميم صفحة الهبوط القياسي المعتمد وتنسيق أول ظهور SSR.
- `9c12c0a` — مزامنة وظيفة SSR المنشورة وربط التفعيل بإصدار الواجهة.
- `43921e5` — توضيح تكامل الواجهة ونشر النسخة على Vercel.
- `9a35b55` — تفعيل التصميم في غلاف `landing.html` وإضافة فحص يمنع تكرار الخطأ.

لعرض كل الكود الذي تغير في هذه الجلسة من داخل المستودع:

```bash
git diff c3e4062..9a35b55
```

ولعرض قائمة الملفات فقط:

```bash
git diff --name-status c3e4062..9a35b55
```

## ملاحظات أمان

يجب عدم حفظ رموز الوصول داخل المشروع. مفاتيح Vercel وSupabase التي ظهرت في المحادثة يجب إلغاؤها وإنشاء مفاتيح جديدة من لوحات التحكم الخاصة بالخدمتين.
