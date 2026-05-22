## نظام محافظ الإعلانات (Advertising Wallets)

نظام احترافي لفصل **شحن رصيد الإعلانات** عن **استهلاك الإعلانات الفعلي**، حتى لا يُحسب الشحن كمصروف على الأرباح إلا عند استهلاكه فعلياً.

---

### 1. قاعدة البيانات (Migrations جديدة)

**جدول `ad_wallets`** — محافظ الإعلانات
- `name` (مثل: Facebook Ads, TikTok Ads)
- `platform` (facebook / tiktok / google / snapchat / other)
- `currency` (USD افتراضي)
- `balance` (الرصيد الحالي بعملة المحفظة)
- `avg_cost_rate` (متوسط سعر الشراء المرجح — يُحدّث تلقائياً عند كل شحنة)
- `store_id`, `owner_id`, `is_active`

**جدول `ad_wallet_topups`** — عمليات الشحن
- `wallet_id`, `safe_id` (الخزينة المخصوم منها)
- `amount_foreign` (الدولار المشحون)
- `exchange_rate` (سعر الصرف)
- `amount_local` (= amount_foreign × rate)
- `notes`, `created_at`, `created_by`

**جدول `ad_spends`** — استهلاك الإعلانات (= مصروف فعلي)
- `wallet_id`, `product_id` (للربط بالمنتج)
- `campaign_name` (اسم الحملة - نص حر)
- `fb_campaign_id` (اختياري للربط بحملات FB الموجودة)
- `amount_foreign` (المستهلك بالدولار)
- `cost_rate` (السعر المستخدم للتحويل = متوسط سعر المحفظة وقت الاستهلاك)
- `amount_local` (= amount_foreign × cost_rate) — هذا هو المصروف الفعلي
- `spend_date`, `notes`

**لا يُسجّل في `expenses` العادية** — يُحسب من `ad_spends` مباشرة في التقارير لتجنب الازدواج.

RLS: `is_member_of(owner_id) OR admin` على الثلاثة، مع `set_owner_id` trigger.

---

### 2. منطق العمليات

**عند الشحن (topup):**
1. خصم `amount_local` من `safes.balance` + إضافة `safe_movement` بنوع `ad_topup`
2. زيادة `ad_wallets.balance += amount_foreign`
3. تحديث `avg_cost_rate` بالمتوسط المرجح:
   `new_avg = (old_balance × old_avg + amount_foreign × new_rate) / (old_balance + amount_foreign)`
4. **لا يُسجّل كمصروف** على الأرباح

**عند الاستهلاك (spend):**
1. التحقق أن `wallet.balance >= amount_foreign`
2. خصم من `ad_wallets.balance -= amount_foreign`
3. حساب `amount_local = amount_foreign × wallet.avg_cost_rate`
4. إدراج في `ad_spends` (هذا هو المصروف الفعلي على المنتج/المتجر)

---

### 3. الواجهة (صفحات جديدة)

**`/ad-wallets`** — صفحة إدارة المحافظ الإعلانية:
- تبويب "المحافظ": قائمة محافظ + إضافة محفظة جديدة + رصيد كل محفظة بالدولار + ما يعادله بالدينار حسب متوسط سعرها
- تبويب "شحن رصيد": فورم (محفظة، خزينة، قيمة بالدولار، سعر الصرف، إجمالي بالدينار يُحسب تلقائياً، ملاحظات)
- تبويب "تسجيل استهلاك": فورم (محفظة، منتج، اسم الحملة، قيمة بالدولار، تاريخ، ملاحظات)
- تبويب "سجل الحركات": عرض كل الشحنات والاستهلاكات مع فلاتر

**تعديل `/financial-accounts` (الأرباح والخسائر):**
- إضافة كتلة "مصروفات الإعلانات المستهلكة" (مجموع `ad_spends.amount_local`)
- استبعاد رصيد المحافظ غير المستهلك من حساب الأرباح
- إضافة عمود "تكلفة الإعلان" لكل منتج (مجموع `ad_spends.amount_local` لذلك المنتج) و**صافي الربح الحقيقي** = ربح المنتج − تكلفة إعلانه

**تقارير جديدة داخل نفس الصفحة:**
- تقرير الأرباح لكل منتج (مع عمود تكلفة الإعلان)
- تقرير المصروفات حسب الحملة (group by `campaign_name`)

**إضافة لشريط التنقل:** رابط "محافظ الإعلانات" تحت قسم المالية.

---

### 4. تفاصيل تقنية مختصرة

- العملة الافتراضية USD لكن الحقل قابل للتعديل لو احتاج المستخدم EUR لاحقاً.
- متوسط السعر المرجح يضمن دقة احتساب المصروف عبر شحنات بأسعار صرف مختلفة.
- جميع الاستعلامات مفلترة بـ `activeStoreId`.
- استخدام `safe_movements` الموجود لتتبع حركة الخزينة (نوع جديد: `ad_topup`).
- التحقق من صحة الإدخال client + server side (zod في الفورم).

---

### الملفات المتأثرة

**Migrations جديدة:** جدول `ad_wallets`, `ad_wallet_topups`, `ad_spends` مع RLS وtriggers.

**ملفات جديدة:**
- `src/pages/AdWallets.tsx`
- إضافة Route في `src/App.tsx`
- إضافة رابط في `src/components/DashboardLayout.tsx`

**ملفات معدّلة:**
- `src/pages/FinancialAccounts.tsx` — استبعاد شحنات المحافظ من المصروفات + إضافة كتلة مصروفات الإعلانات المستهلكة + تقارير لكل منتج/حملة
