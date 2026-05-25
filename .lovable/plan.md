## الهدف
إضافة مفتاح (Switch) في تبويب "منتجات EasyOrders" يسمح لكل مستخدم بتفعيل/إيقاف تكامل EasyOrders. عند الإيقاف، يختفي كل ما يخص EasyOrders من واجهة المستخدم.

## التغييرات

### 1. قاعدة البيانات
إضافة عمود جديد على جدول `profiles`:
- `easyorders_enabled` (boolean, افتراضي `false`)
- ترحيل: تفعيله تلقائياً لكل مستخدم لديه `easyorders_api_key` محفوظ مسبقاً (حفاظاً على عدم كسر السلوك الحالي).

### 2. Hook مشترك جديد
إنشاء `src/hooks/useEasyOrdersEnabled.ts` يقرأ القيمة من `profiles` للمستخدم الفعلي (`get_effective_owner_id`) ويوفرها كـ context بسيط مع `loading`.

### 3. صفحة `EasyOrdersProducts.tsx`
- في أعلى الصفحة (داخل `PageHeader` أو أسفله مباشرة) إضافة بطاقة بها:
  - `Switch` كبير: "تفعيل تكامل EasyOrders"
  - وصف قصير يوضح أن الإيقاف يخفي كل ما يتعلق بالتكامل.
- عند الإيقاف: إخفاء بقية محتوى الصفحة (المنتجات، المقارنة، `IntegrationsPanel`) وعرض رسالة "التكامل معطّل".
- التحديث يتم على `profiles.easyorders_enabled` للمستخدم الحالي.

### 4. إخفاء العناصر في باقي النظام عند الإيقاف

| الملف | ما يُخفى |
|---|---|
| `src/components/DashboardLayout.tsx` | عنصر القائمة "منتجات ايزي اوردرز" |
| `src/components/ProductForm.tsx` | قسم "المنتج الرئيسي في EasyOrders" + عمود "متغير EasyOrders" في جدول المتغيرات + قسم "متغيرات EasyOrders" |
| `src/components/OrderDetailsDialog.tsx` | عرض/تحرير `easyorders_product_id` و `easyorders_variant_id` وزر "retryLinking" |
| `src/components/IntegrationsPanel.tsx` | بطاقة "تكامل EasyOrders API" بالكامل (تبقى بطاقة Webhook) |
| `src/App.tsx` | حماية المسار `easyorders-products`: إذا معطّل، توجيه لصفحة الإعدادات أو السماح بالدخول لإعادة التفعيل (سنُبقي الدخول مسموحاً ليرى المستخدم المفتاح). |

### 5. منطق الحفظ في الخلفية
لا حاجة لتغيير دوال EasyOrders (sync/webhook). فقط نخفي الواجهة. القيم المحفوظة سابقاً (روابط المنتجات والمتغيرات) تبقى في DB حتى لو أعاد التفعيل لاحقاً.

## ملاحظات
- المفتاح لكل مستخدم (owner) عبر `profiles`، ويُطبَّق على جميع أعضاء المتجر تلقائياً عبر `get_effective_owner_id`.
- الافتراضي = معطّل للمستخدمين الجدد لتقليل التشويش، ومفعّل تلقائياً لمن سبق ووضع API Key.
