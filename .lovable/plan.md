# خطة إكمال المراجعة الشاملة

## 1. تنظيف الواجهة (Frontend Store Isolation)
فلترة صارمة بـ `activeStoreId` في المكونات التالية:
- `src/components/OrderDetailsDialog.tsx` — استعلامات المنتجات/الإعدادات
- `src/components/StoreHeader.tsx` — إعدادات المتجر
- `src/components/CityCorrections.tsx` — تصحيحات المدن
- `src/components/ConfirmationCenter.tsx` و `src/pages/ConfirmationSettings.tsx`
- `src/pages/Inventory.tsx`, `Products.tsx`, `Returns.tsx`, `Settlements.tsx`, `Expenses.tsx`, `Purchases.tsx`, `FinancialAccounts.tsx`
- `src/pages/PixelSettings.tsx`, `ThankYouSettings.tsx`, `OrderFormSettings.tsx`, `StickerDesigner.tsx`, `WhatsAppPage.tsx`

كل استعلام يضيف `.eq("store_id", activeStoreId)` بدلاً من `owner_id` فقط.

## 2. Edge Functions تدرك المتجر
- `sync-easyorder`, `sync-returns`, `sync-settlements`, `receive-return`, `receive-settlement` — تمرير `store_id` عند الإدخال/التحديث
- `whatsapp-send-confirmation`, `whatsapp-webhook` — قراءة `whatsapp_settings` حسب `store_id`
- `apply-order-stock` — قراءة `stock_movements` حسب `store_id` للطلب

## 3. المرحلة 4 — تقارير مالية متقدمة

### أ) إغلاق الفترات (Period Closing)
- جدول `accounting_periods` (store_id, start, end, closed_at, closed_by)
- Trigger يمنع تعديل/حذف `safe_movements`, `orders.status`, `purchases` ضمن فترة مغلقة (ما عدا admin)
- صفحة `src/pages/AccountingPeriods.tsx` لإقفال/فتح فترة

### ب) تقرير الأرباح والخسائر (P&L)
- صفحة `src/pages/ProfitLossReport.tsx`:
  - الإيرادات: مجموع `orders.price` للحالة `delivered`
  - تكلفة البضاعة: `SUM(order_items.quantity * purchase_price_snapshot)` للمسلّمة
  - المصاريف: `expenses` ضمن الفترة
  - رسوم الشحن: من `orders.shipping_fee` (إن وجد)
  - صافي الربح = إيرادات − تكلفة − مصاريف
  - فلترة: متجر + فترة زمنية + مقارنة بفترة سابقة

### ج) تقرير التدفقات النقدية (Cash Flow)
- صفحة `src/pages/CashFlowReport.tsx`:
  - تجميع `safe_movements` حسب `movement_type` (settlement, expense, purchase, manual, transfer)
  - الرصيد الافتتاحي/الختامي لكل خزينة
  - تصدير Excel

### د) معالجة المرتجعات مالياً
- عند تحويل الطلب إلى `returned`:
  - Trigger يخصم المبلغ المُحصَّل من الخزينة (`movement_type='return_refund'`)
  - يُرجع المخزون تلقائياً
- صفحة `Returns.tsx` تعرض الأثر المالي لكل مرتجع

### هـ) تصدير محاسبي
- زر "تصدير دفتر الأستاذ" يخرج Excel بـ:
  - تاريخ، نوع الحركة، الوصف، مدين، دائن، الرصيد، المرجع

## تفاصيل تقنية
- جميع Migrations جديدة بدون تعديل القديمة
- استخدام `has_store_or_legacy` في RLS للجداول الجديدة
- المتطلب: حقل `store_id` موجود مسبقاً في الجداول المالية (تمّ في المرحلة السابقة)
- التريغرات الجديدة تستخدم `SECURITY DEFINER` مع `search_path = public`

## ترتيب التنفيذ
1. تنظيف الواجهة (سريع، أعلى أولوية لمنع تسريب البيانات)
2. Edge Functions
3. Migration: accounting_periods + return_refund trigger
4. صفحات التقارير الجديدة (P&L, Cash Flow, إغلاق الفترات)
5. زر التصدير المحاسبي
