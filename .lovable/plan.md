
# دعم متاجر متعددة لكل حساب

تحويل النظام من "حساب = متجر" إلى "حساب = عدة متاجر مستقلة". كل متجر يحتوي على منتجاته وطلباته وماليته وإعدادات الشحن والبيكسل بشكل منفصل تماماً.

---

## 1. قاعدة البيانات

### جدول جديد `stores`
- `id`, `owner_id` (مالك الحساب), `name`, `slug` (للرابط العام، فريد عالمياً), `is_default`, `created_at`

### إضافة `store_id` إلى جميع جداول البيانات التشغيلية
سيُضاف عمود `store_id uuid` إلى:
- `products`, `landing_pages`, `orders`, `order_items`
- `safes`, `safe_movements`, `expenses`, `purchases`, `expense_types`
- `shipping_settings`, `shipping_zones`, `shipping_warehouse_products`
- `pixel_settings`, `header_settings`, `order_form_fields`, `confirmation_settings`, `confirmation_templates`, `cancellation_reasons`
- `easyorders_products`, `returns`, `return_shipments`, `settlements`, `settlement_shipments`
- `city_corrections` (الخاصة بالمستخدم), `analytics_events`, `order_confirmation_attempts`, `carrier_status_mappings` (الخاصة بالمستخدم), `hidden_default_*`

### الترحيل التلقائي للبيانات الحالية
لكل `owner_id` موجود يُنشأ متجر افتراضي باسم "المتجر الرئيسي" مع `is_default=true`، ثم تُحدّث كل الصفوف القديمة لتشير إليه.

### المستخدمون الفرعيون
- إضافة جدول `store_member_stores(member_id, store_id)` لتحديد المتاجر المتاحة لكل موظف.
- تحديث `is_member_of()` لتأخذ `store_id` بعين الاعتبار، وإضافة `has_store_access(store_id)`.

### تحديث سياسات RLS
كل السياسات تتغير من `is_member_of(owner_id)` فقط إلى `is_member_of(owner_id) AND has_store_access(store_id)`.

---

## 2. الواجهة الأمامية

### سياق المتجر النشط (`useStoreContext`)
- يخزّن `activeStoreId` في `localStorage` لكل مستخدم.
- يُحمَّل ضمن `useUserContext` ويُمرَّر لكل الاستعلامات.
- محوّل متاجر (Store Switcher) في أعلى الـ Sidebar (dropdown) يعرض جميع المتاجر مع زر "+ إضافة متجر".

### صفحات جديدة
- `/dashboard/stores-list` (للمالك): إدارة متاجره الشخصية — إضافة، تعديل اسم/slug، حذف.
- صفحة "إضافة متجر" — اسم + slug + خيار نسخ الإعدادات من متجر آخر.

### تعديل كل الصفحات الموجودة
كل الصفحات التي تستعلم من Supabase تضيف فلتر `.eq('store_id', activeStoreId)`، وكل INSERT يضيف `store_id`.

### الواجهة العامة (Storefront)
- `/store/:slug` يبحث في `stores.slug` بدل `profiles.username`.
- `/p/:productSlug` يحتاج `store_id` ضمني — إما عبر الـ subdomain/slug أو يصبح `/s/:storeSlug/p/:productSlug`.

---

## 3. Edge Functions
كل الدوال (`create-order`, `ship-orders`, `sync-*`, `webhook-order`, `landing-ssr`, إلخ) تحتاج تمرير/قراءة `store_id`:
- استدعاءات الواجهة تمرر `store_id` صراحةً.
- الـ webhooks العامة تحلّ المتجر عبر slug في الرابط.
- إعدادات الشحن وEasyOrders تُقرأ حسب `store_id` بدل `owner_id`.

---

## 4. التفاصيل التقنية

```text
profiles (owner) ──┐
                   ├─< stores ──< products / orders / safes / shipping_settings / ...
store_members ─────┤        │
                   └────────┴─< store_member_stores (أي متاجر يصلها الموظف)
```

- تحويل `webhook_token` ليصبح على مستوى المتجر بدل الحساب.
- `header_settings.logo_text` يحدد اسم المتجر المعروض في الـ Sidebar حسب المتجر النشط.
- التحقق من سياسات RLS بدقة لتفادي تسريب بيانات بين متاجر نفس المالك.

---

## 5. التنفيذ على مراحل

1. **المرحلة أ — البنية:** إنشاء `stores` + ترحيل البيانات + إضافة `store_id` لكل الجداول + تحديث RLS.
2. **المرحلة ب — السياق:** `useStoreContext` + Store Switcher + صفحة إدارة المتاجر + إضافة متجر.
3. **المرحلة ج — تكييف الصفحات:** تحديث جميع استعلامات Frontend (منتجات، طلبات، مالية، شحن، بيكسل، إعدادات...).
4. **المرحلة د — Edge Functions:** تكييف كل الدوال لاستخدام `store_id`.
5. **المرحلة هـ — الواجهة العامة:** تحديث `/store/:slug` و `/p/:slug` للعمل مع متاجر متعددة.
6. **المرحلة و — المستخدمون الفرعيون:** ربط الموظفين بمتاجر محددة.

---

## ملاحظات مهمة

- هذا تغيير ضخم يمس **كل ملف تقريباً** في المشروع (50+ ملف، 20+ migration).
- سيستغرق التنفيذ عدة جولات متتابعة.
- يُفضّل عمل نسخة احتياطية قبل البدء (يمكنك استخدام نقاط الاستعادة في Lovable).
- بعد المرحلة أ مباشرة سيعمل النظام بمتجر افتراضي واحد بشكل طبيعي، ثم نضيف تدريجياً.

هل أبدأ بالمرحلة (أ): إنشاء جدول `stores`، الترحيل التلقائي، وإضافة `store_id` لجميع الجداول مع تحديث RLS؟
