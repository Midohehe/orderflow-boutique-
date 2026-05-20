import { useEffect } from "react";

const Privacy = () => {
  useEffect(() => {
    document.title = "سياسة الخصوصية | منصة وصلة";
  }, []);
  return (
    <div dir="rtl" className="min-h-screen bg-background text-foreground py-12 px-4">
      <article className="max-w-3xl mx-auto space-y-6 leading-relaxed">
        <h1 className="text-3xl font-bold">سياسة الخصوصية</h1>
        <p className="text-sm text-muted-foreground">آخر تحديث: 20 مايو 2026</p>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">1. مقدمة</h2>
          <p>
            نحن في منصة وصلة (was-la.com) نلتزم بحماية خصوصية مستخدمينا. توضح هذه السياسة كيفية جمع البيانات
            واستخدامها وحمايتها عند استخدامك للمنصة وخدماتها، بما في ذلك تكامل حسابات الإعلانات (مثل Facebook).
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">2. البيانات التي نجمعها</h2>
          <ul className="list-disc pr-6 space-y-1">
            <li>بيانات الحساب: البريد الإلكتروني، الاسم، رقم الهاتف.</li>
            <li>بيانات المتجر: المنتجات، الطلبات، العملاء، الإعدادات.</li>
            <li>بيانات الإعلانات: عند الربط مع Facebook نقوم بقراءة بيانات الحملات والإحصائيات فقط (ads_read, ads_management, read_insights) لعرضها داخل لوحة التحكم.</li>
            <li>بيانات الاستخدام: ملفات تعريف الارتباط، عنوان IP، نوع المتصفح لأغراض التحليل.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">3. استخدام البيانات</h2>
          <ul className="list-disc pr-6 space-y-1">
            <li>تشغيل المنصة وتقديم الخدمات.</li>
            <li>عرض إحصائيات الحملات الإعلانية لصاحب المتجر فقط.</li>
            <li>تحسين الأداء والدعم الفني.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">4. مشاركة البيانات</h2>
          <p>لا نبيع أو نشارك بياناتك مع أي طرف ثالث، باستثناء مزودي الخدمة الضروريين (مثل Supabase للاستضافة) ولأغراض التشغيل فقط.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">5. تكامل Facebook</h2>
          <p>
            عند ربط حسابك بـ Facebook، نقوم بتخزين رمز الوصول (Access Token) بشكل آمن ومشفر، ونستخدمه فقط لجلب
            بيانات إعلاناتك الخاصة. يمكنك فصل الحساب في أي وقت من صفحة "إعلانات فيسبوك" داخل لوحة التحكم،
            وعند الفصل يتم حذف الرمز نهائياً.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">6. حقوقك</h2>
          <p>لك الحق في طلب الوصول لبياناتك، تعديلها، أو حذفها بالكامل بمراسلتنا على البريد أدناه.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">7. التواصل</h2>
          <p>
            للاستفسارات المتعلقة بالخصوصية: <a className="text-primary underline" href="mailto:support@was-la.com">support@was-la.com</a>
          </p>
        </section>
      </article>
    </div>
  );
};

export default Privacy;
