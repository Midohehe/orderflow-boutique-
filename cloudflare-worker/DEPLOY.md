# تفعيل Cloudflare Edge Cache لـ was-la.com

يقلّل هذا الإعداد استهلاك **Supabase Storage egress** (صور صفحات الهبوط) و**Edge Functions** (landing-ssr)،
بينما يبقى التطبيق الرئيسي على **Vercel**.

## ما الذي يُخزَّن على Cloudflare؟

| المسار | المصدر | مدة الكاش |
|--------|--------|-----------|
| `/p/*` | Supabase `landing-ssr` | ساعة على Edge |
| `/cdn/img?u=...` | Supabase Storage | 30 يوماً على Edge |
| `/assets/*` وملفات JS/CSS | Vercel (Cache Rules) | سنة |

> **مهم:** لا توجّه `was-la.com/*` بالكامل إلى الـ Worker — فقط `/p/*` و `/cdn/img` لتجنب حلقة proxy مع Vercel.

---

## الخطوة 1 — التأكد أن الدومين على Cloudflare

1. ادخل [dash.cloudflare.com](https://dash.cloudflare.com)
2. أضف zone `was-la.com` إن لم تكن موجودة
3. غيّر nameservers عند مسجّل الدومين إلى Cloudflare (إن لم يكن مفعّلاً)

---

## الخطوة 2 — DNS نحو Vercel (مع Proxy)

في **DNS → Records**:

| النوع | الاسم | المحتوى | Proxy |
|-------|-------|---------|-------|
| CNAME | `www` | `cname.vercel-dns.com` | ☁️ Proxied |
| CNAME أو A | `@` | حسب إعداد Vercel للـ apex | ☁️ Proxied |

في **Vercel → Project → Settings → Domains** تأكد أن `www.was-la.com` و `was-la.com` مضافان.

---

## الخطوة 3 — نشر الـ Worker

### الطريقة أ (موصى بها): API Token — بدون `wrangler login`

إذا ظهر خطأ OAuth مثل `request_forbidden` أو `No CSRF value available`، **تخطَّ login** واستخدم Token:

#### 1) إنشاء Token

1. [Cloudflare → My Profile → API Tokens](https://dash.cloudflare.com/profile/api-tokens)
2. **Create Token** → قالب **Edit Cloudflare Workers**
3. Zone Resources: **Include → Specific zone → was-la.com**
4. انسخ الـ Token (يظهر مرة واحدة)

#### 2) النشر من PowerShell

```powershell
cd C:\Users\Administrator\Projects\orderflow-boutique\cloudflare-worker

$env:CLOUDFLARE_API_TOKEN = "YOUR_TOKEN_HERE"

# تحقق
npx wrangler whoami

# المفتاح السري (Supabase publishable key)
npx wrangler secret put SUPABASE_ANON_KEY

# النشر
npx wrangler deploy
```

أو من جذر المشروع (بعد تعيين `$env:CLOUDFLARE_API_TOKEN`):

```powershell
npm run cf:deploy
```

> **لا تشغّل** `wrangler login` إذا استخدمت API Token — يكفي المتغير `CLOUDFLARE_API_TOKEN`.

---

### الطريقة ب: OAuth (`wrangler login`) — إن عمل عندك

```powershell
cd cloudflare-worker
npx wrangler login
npx wrangler secret put SUPABASE_ANON_KEY
npx wrangler deploy
```

#### إذا فشل OAuth — جرّب بالترتيب

1. **VPN:** أوقف Tailscale / Outline / أي VPN ثم أعد المحاولة
2. **متصفح خارج Cursor:** افتح **PowerShell أو CMD عادي** (ليس طرفية Cursor) ثم:
   ```powershell
   npx wrangler login --browser=false
   ```
   انسخ الرابط → الصقه في **Chrome/Edge** على **نفس الجهاز** → Allow
3. **كوكيز:** فعّل cookies لـ `dash.cloudflare.com` (لا تستخدم نافذة خاصة أول مرة)
4. **نفس الجلسة:** لا تفتح الرابط على جوال أو جهاز آخر — Wrangler ينتظر callback على `localhost:8976`
5. **مسح جلسة قديمة:**
   ```powershell
   Remove-Item -Recurse -Force "$env:USERPROFILE\.wrangler" -ErrorAction SilentlyContinue
   npx wrangler login --browser=false
   ```

---

### الطريقة ج: بدون Wrangler — من لوحة Cloudflare (يدوي)

1. **Workers & Pages → Create → Worker**
2. الصق محتوى `cloudflare-worker/worker.js`
3. **Settings → Variables:**
   - `SUPABASE_ORIGIN` = `https://sukehkrhvasfnoheyvvx.supabase.co`
   - `SSR_ENDPOINT` = `https://sukehkrhvasfnoheyvvx.supabase.co/functions/v1/landing-ssr`
   - `SUPABASE_ANON_KEY` = (Encrypted) publishable key من Supabase
4. **Triggers → Routes** — نفس المسارات في الخطوة 4 أدناه
5. **Deploy**


## الخطوة 4 — ربط المسارات (Routes)

في **Workers & Pages → was-la-edge → Settings → Triggers → Routes** أضف:

```
www.was-la.com/p/*
www.was-la.com/cdn/img
was-la.com/p/*
was-la.com/cdn/img
```

> لا تضف `was-la.com/*` — باقي الموقع يمر مباشرة إلى Vercel.

بديل: فعّل الـ `[[routes]]` في `wrangler.toml` ثم `wrangler deploy`.

---

## الخطوة 5 — Cache Rules (لملفات Vercel الثابتة)

**Caching → Cache Rules → Create rule**

### قاعدة 1 — الأصول الثابتة

- **اسم:** Static assets
- **When:** URI Path contains `/assets/` **OR** URI Path ends with `.js` / `.css` / `.woff2` / `.webp` / `.png` / `.svg`
- **Then:**
  - Cache eligibility: Eligible for cache
  - Edge TTL: 1 year
  - Browser TTL: 1 year

### قاعدة 2 — صور CDN (احتياط)

- **When:** URI Path equals `/cdn/img`
- **Edge TTL:** 1 month
- **Browser TTL:** 7 days

### قاعدة 3 — صفحات الهبوط (احتياط)

- **When:** URI Path starts with `/p/`
- **Edge TTL:** 1 hour
- **Browser TTL:** Respect origin

---

## الخطوة 6 — purge تلقائي عند نشر صفحة هبوط

في **Supabase → Edge Functions → Secrets** أضف:

| Secret | القيمة |
|--------|--------|
| `CLOUDFLARE_ZONE_ID` | من Cloudflare → Overview → Zone ID |
| `CLOUDFLARE_API_TOKEN` | Token بصلاحية `Zone.Cache Purge` |
| `PUBLIC_HOST` | `www.was-la.com` |

Token: **My Profile → API Tokens → Create → Custom → Zone → Cache Purge → Edit**

عند حفظ/نشر صفحة هبوط، يستدعي التطبيق `purge-landing-cache` لمسح كاش `/p/slug`.

---

## الخطوة 7 — التحقق

### صفحة هبوط

```powershell
curl -sI "https://www.was-la.com/p/your-slug" | findstr /i "cache-control x-wasla-cache cf-cache-status"
```

- الطلب الأول: `x-wasla-cache: MISS`
- الطلب الثاني: `x-wasla-cache: HIT` أو `cf-cache-status: HIT`

### صورة

```powershell
curl -sI "https://www.was-la.com/cdn/img?u=https%3A%2F%2Fsukehkrhvasfnoheyvvx.supabase.co%2Fstorage%2Fv1%2F..." | findstr /i "cache-control cf-cache-status"
```

### Analytics

**Caching → Cache Analytics** — راقب Hit Ratio بعد 24–48 ساعة.

---

## Supabase Smart CDN (اختياري إضافي)

**Storage → Settings → Smart CDN** — يفيد إذا بقيت روابط مباشرة لـ `supabase.co/storage` في مكان ما.
التطبيق يوجّه صور الهبوط عبر `/cdn/img` تلقائياً (`landingImageUrl.ts`).

---

## استكشاف الأخطاء

| المشكلة | الحل |
|---------|------|
| Worker لا يعمل | تحقق من Routes — يجب أن تطابق `/p/*` و `/cdn/img` |
| حلقة redirect | لا تستخدم route `/*` على Worker |
| صور لا تُخزَّن | تأكد أن `u=` يشير لـ `*.supabase.co/storage/v1/` |
| purge لا يعمل | تحقق من `CLOUDFLARE_*` و `PUBLIC_HOST` في Supabase secrets |
| Vercel middleware + Worker | طبيعي — Worker يخدم `/p/` على Edge قبل Vercel |
| `wrangler login` → `request_forbidden` / CSRF cookie | **لا تستخدم login** — انظر الطريقة أ (API Token) أعلاه |
| `Timed out waiting for authorization code` | VPN أو فتح الرابط على جهاز مختلف — استخدم `--browser=false` على نفس الجهاز |
| `wrangler whoami` فشل مع Token | تأكد Token فيه Workers Edit + Zone was-la.com |
