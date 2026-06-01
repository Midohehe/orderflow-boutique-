# 📋 مراجعة شاملة لـ LIBYA STORE

تمت مراجعة كاملة لـ:
- **عزل بيانات المتاجر** (multi-tenant isolation)
- **الجانب المالي/المحاسبي** (كأن المراجع محاسب مالي)

النتائج أدناه مرتبة بالأولوية لتُنفَّذ على مراحل.

---

## 🔴 المرحلة 1 — إصلاحات حرجة (فورية، تخص أموال المستخدم وأرصدته)

### 1.1 ✅ Bug إيداع مزدوج في الخزائن (Safes)
- `src/pages/Safes.tsx` السطر 99–104: يُحدّث `safes.balance` يدوياً **و** يُدرج `safe_movement` — والـ trigger `sync_safe_balance` يضيف نفس المبلغ مرة ثانية ⇒ **الرصيد يتضاعف**.
- نفس المشكلة عند إنشاء خزينة برصيد افتتاحي (السطر 76–88).
- **الإصلاح:** الاكتفاء بإدراج الحركة فقط، وحذف التحديث اليدوي.
- **بعد الإصلاح:** سكربت مرّة واحدة لإعادة احتساب `safes.balance = SUM(safe_movements.amount)` لكل خزينة.

### 1.2 Snapshot سعر الشراء على الطلب
- جدول `order_items` لا يحفظ `purchase_price` وقت البيع — الأرباح التاريخية تتغير عند تعديل سعر منتج اليوم.
- **الإصلاح:** إضافة عمود `purchase_price_snapshot` إلى `order_items`، يُملأ تلقائياً عند إنشاء الطلب، وتقارير الربح تستخدمه أولاً.

### 1.3 رسوم الطلبات تضيع صامتة
- `deduct_order_fee` تُسقط الاستثناءات وترجع NEW ⇒ الطلب يُنشأ بلا خصم وبلا أي سجل.
- **الإصلاح:** عند فشل الخصم، إدراج صف في جدول جديد `pending_order_fees` لاسترجاعها لاحقاً + تنبيه للمشرف.

### 1.4 push-easyorders-quantities & sync-easyorders-products بدون store_id
- يكتبان بـ `upsert(owner_id, external_id)` فقط ⇒ متجران مختلفان يستخدمان نفس EasyOrders يتعارضان.
- **الإصلاح:** إضافة `store_id` للـ unique constraint وعمليات الـ upsert.

### 1.5 لوحة التحكم وإحصائيات أخرى تظهر بيانات كل المتاجر
- (تم إصلاح DashboardStats مسبقاً.) باقي الصفحات/المكونات التي تحتاج فلترة `store_id`:
  - `StockMovements.tsx:75,81`
  - `OrderDetailsDialog.tsx:145` (يعرض منتجات كل المتاجر)
  - `ConfirmationCenter.tsx:155,421` (يقرأ localStorage مباشرة + يبحث بـ owner_id فقط)
  - `Orders.tsx:426,431,513` (sticker/store settings)
  - `PrepLists.tsx:90–91`
  - `StickerDesigner.tsx:56,58`
  - `StoreHeader.tsx:42`
  - `ConfirmationSettings.tsx:92` (reset يمسح templates كل المتاجر!)
  - `CityCorrections.tsx:35–36`
  - `ShippingSettings.tsx:284,290`
  - `OrderFormSettings.tsx:57,133`, `CurrencySettings.tsx:53`, `ThankYouSettings.tsx:59`

---

## 🟠 المرحلة 2 — عزل بيانات المتاجر هيكلياً

### 2.1 إضافة `store_id` لجداول ينقصها
| الجدول | الحالة |
|---|---|
| `sticker_settings` | `owner_id UNIQUE` فقط ⇒ إعداد واحد لكل المتاجر |
| `store_settings` | يخص الـ owner كله بدل المتجر |
| `whatsapp_settings`, `whatsapp_conversations`, `whatsapp_messages` | بدون store_id |
| `city_corrections`, `hidden_default_cities` | بدون store_id |
| `carrier_status_mappings`, `hidden_default_carrier_codes`, `shipping_error_aliases` | بدون store_id |

**الإصلاح:** migration تضيف `store_id` + backfill بالـ default store + UNIQUE(owner_id, store_id) حيث يلزم.

### 2.2 تحويل RLS من `is_member_of(owner_id)` إلى `has_store_access(store_id)`
الجداول الحساسة كلها تستخدم `is_member_of` فقط، ما يعني أن `store_member_stores` (صلاحيات الموظف لمتجر محدد) **غير مُطبَّقة فعلياً** في DB:
- `orders`, `order_items`, `products`, `analytics_events`, `landing_pages`
- `expenses`, `safes`, `safe_movements`, `purchases`, `returns`, `settlements`
- `pixel_settings`, `header_settings`, `order_form_fields`, `shipping_settings`, `shipping_zones`, `stock_movements`
- `prep_lists`, `prep_list_orders`, `fb_campaigns`, `fb_ads`, `fb_insights_daily`, `store_facebook_connections`
- `confirmation_settings`, `confirmation_templates`, `cancellation_reasons`

**الإصلاح:** policies جديدة تستعمل `has_store_access(store_id) OR (store_id IS NULL AND is_member_of(owner_id))` للتوافق مع السجلات القديمة.

### 2.3 إزالة backdoor "عضو بدون متاجر محددة = وصول كامل"
- `has_store_access` (migration `20260517212148`) تمنح الموظف الذي لم يُحدَّد له متجر **وصولاً كاملاً لكل المتاجر**.
- **الإصلاح:** اعتبار غياب الإسناد = "بلا وصول"، مع سكربت backfill يمنح كل الموظفين الحاليين كل المتاجر صراحةً.

### 2.4 Edge functions تستخدم owner_id فقط
- `sync-returns`, `sync-settlements`, `sync-easyorder`, `ship-orders`, `whatsapp-ai-reply`, `whatsapp-webhook`
- **الإصلاح:** قبول `store_id` في الـ body، وفلترة كل الاستعلامات به.

---

## 💰 المرحلة 3 — تطويرات محاسبية أساسية

### 3.1 صلاحيات مالية صارمة
- جداول `expenses`, `purchases`, `safe_movements`, `settlements` تستخدم `FOR ALL` مع `is_member_of` ⇒ أي موظف يحذف/يعدّل بلا أثر.
- **الإصلاح:** ربط الـ UPDATE/DELETE بـ `has_permission('finance_write')` + إنشاء صلاحيات منفصلة (read/write/delete) في `permission_groups`.

### 3.2 Audit log مالي
جدول جديد `financial_audit_log`: `user_id, table_name, row_id, action, old_value(jsonb), new_value(jsonb), ip, created_at` + triggers على الجداول المالية.

### 3.3 منع حذف حركات الخزينة بأثر رجعي
- منع `DELETE` على `safe_movements` بعد 24 ساعة عبر RLS/trigger.
- الإلغاء يتم بقيد معاكس (reverse entry) فقط — هذا معيار محاسبي أساسي.

### 3.4 عكس مالي عند المرتجعات
- `receive-return` حالياً يُغيّر حالة الطلب فقط دون أي حركة خزينة.
- **الإصلاح:** عند المرتجع لطلب مُسوّى، إدراج `safe_movement` سالب + تسجيل تكلفة الشحن المفقودة.

### 3.5 تسوية ذرية (Atomic)
- `Settlements.tsx:108–130` يُنفذ خطوتين منفصلتين ⇒ ممكن طلبات `settled` بلا إيداع خزينة.
- **الإصلاح:** تحويل العملية إلى DB function واحدة (`settle_orders_into_safe`).

### 3.6 معالجة DTRUC وCOD
- إضافة عمود `cod_collected` على الطلب (نعم/لا/جزئي).
- في تقارير الربح: التمييز بين delivered+collected و DTRUC.

---

## 📊 المرحلة 4 — تقارير وأدوات محاسبية جديدة

1. **تقرير P&L شهري:** إيرادات − COGS − شحن − مصاريف − رسوم.
2. **Cash Flow** للخزائن (تدفقات نقدية فعلية، مستقل عن الربح).
3. **Aged Receivables:** المبالغ عند شركة الشحن مقسّمة 30/60/90 يوم.
4. **مطابقة التسويات (Reconciliation):** فروقات بين `settlement_shipments` والطلبات.
5. **COGS vs Revenue لكل منتج:** اكتشاف المنتجات الخاسرة بعد الشحن والإعلانات.
6. **إغلاق الفترة المالية:** قفل الشهر السابق لمنع التعديل بأثر رجعي.
7. **ربط `purchases` بمنتجات** عبر `purchase_items` (لمطابقة المخزون والربح الفعلي).
8. **Export Excel/PDF محاسبي** لكل تقرير.
9. **تنبيهات تلقائية:** فروقات تسوية، رصيد منخفض، مرتجع غير معالج > 7 أيام.

---

## ⚙️ تفاصيل تقنية

### Migrations المتوقعة
1. إضافة `store_id` للجداول الناقصة + backfill + unique constraints جديدة.
2. إعادة كتابة RLS policies للجداول الحساسة باستخدام `has_store_access`.
3. إنشاء `financial_audit_log` + triggers.
4. إنشاء `purchase_items`, `pending_order_fees`, `period_locks`.
5. إضافة `purchase_price_snapshot` على `order_items` + `cod_collected` على `orders`.

### Frontend
- إصلاح كل الـ queries المذكورة لتشمل `store_id`.
- تقارير جديدة في `src/pages` (P&L, CashFlow, AgedReceivables, Reconciliation).
- استبدال قراءة `localStorage` المباشرة بـ `useStoreContext()`.

### Edge functions
- `sync-returns`, `sync-settlements`, `sync-easyorder`, `ship-orders`, `whatsapp-*`, `push-easyorders-quantities`, `sync-easyorders-products`: قبول وتمرير `store_id`.
- `receive-return`: عكس مالي.
- دالة جديدة `settle_orders_into_safe` (atomic).

---

## 🚦 ترتيب التنفيذ المقترح

| المرحلة | المدة | السبب |
|---|---|---|
| **1** إصلاحات حرجة | اليوم | تمس أموال حقيقية الآن |
| **2** عزل المتاجر | الأسبوع | منع تسرب البيانات بين المتاجر |
| **3** تطويرات محاسبية | الشهر | معايير محاسبية أساسية + أمان البيانات المالية |
| **4** تقارير جديدة | الربع | إضافة قيمة للتاجر |

---

## ❓ قبل البدء

أحتاج قراراتك:

1. **المرحلة 1 (الإصلاحات الحرجة) فقط الآن**، أم نفّذ **1 + 2 معاً**؟
2. **سكربت إصلاح أرصدة الخزائن الحالية** (نتيجة bug الإيداع المضاعف): هل أُجريه فوراً بعد إصلاح الكود؟
3. **المراحل 3 و4** نخططها بعد انتهاء 1 و2، أم تريد الخطة الكاملة الآن؟

أنصح: نبدأ بالمرحلة 1 الآن + إصلاح أرصدة الخزائن، ثم نخطط للمرحلة 2 لاحقاً.