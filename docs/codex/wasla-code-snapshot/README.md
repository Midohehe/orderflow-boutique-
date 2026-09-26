# نسخة كود تطوير وصلة

هذه نسخة ثابتة من ملفات صفحة الهبوط وSSR كما كانت عند الإصدار `9a35b55`.

احتفظنا ببنية المسارات الأصلية حتى يمكن مقارنة أي ملف بالنسخة الفعلية في جذر المشروع. هذه الملفات مرجعية فقط؛ التطبيق يعمل من الملفات الأصلية خارج هذا المجلد.

## أهم المسارات

- `src/pages/LandingPage.tsx` — صفحة الهبوط ونموذج الطلب.
- `src/components/StoreHeader.tsx` — رأس المتجر المصغر.
- `src/components/landing/StandardLandingLayout.tsx` — ترتيب أقسام القالب.
- `src/components/landing/standard-landing-approved.css` — تصميم القالب المحسن.
- `src/lib/approvedLandingDesign.ts` — إصدار التصميم والترتيب المعتمد.
- `supabase/functions/landing-ssr/index.ts` — وظيفة SSR.
- `supabase/functions/_shared/approved-standard-landing.ts` — أول ظهور للقالب المحسن.
- `scripts/check-approved-landing.cjs` — فحوصات القالب.

لا توجد مفاتيح Vercel أو Supabase أو بيانات دخول داخل هذه النسخة.
