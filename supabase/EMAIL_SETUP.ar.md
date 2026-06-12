# إرسال إيميلات التسجيل من was-la.com (بدل Supabase الافتراضي)

## كيف يعمل النظام عندكم

```
مستخدم يسجّل → Supabase Auth
       ↓
Send Email Hook → auth-email-hook (Edge Function)
       ↓
طابور auth_emails → process-email-queue
       ↓
Resend → من: وصلة <noreply@was-la.com>
```

إذا **لم** تُفعّل الـ Hook، Supabase يرسل من `noreply@mail.app.supabase.io` — وهذا ما يحدث حالياً (`email_send_log` فارغ).

---

## الخطوة 1 — Resend + دومين was-la.com

1. حساب على [resend.com](https://resend.com)
2. **Domains → Add Domain** → `was-la.com`
3. Resend يعطيك سجلات DNS (SPF, DKIM) — أضفها في **Cloudflare → DNS**
   - سجلات البريد: **DNS only** (رمادي ☁️) — **ليس Proxied**
4. انتظر **Verified** في Resend

**From address بعد التفعيل:**
`وصلة <noreply@was-la.com>`

---

## الخطوة 2 — Secrets في Supabase

**Dashboard → Edge Functions → Secrets**

| Secret | القيمة |
|--------|--------|
| `RESEND_API_KEY` | من Resend → API Keys |
| `AUTH_HOOK_SECRET` | سلسلة عشوائية طويلة (مثلاً `openssl rand -hex 32`) |
| `SITE_URL` | `https://www.was-la.com` |
| `SITE_NAME` | `وصلة` |
| `SITE_DOMAIN` | `www.was-la.com` |
| `EMAIL_FROM_DOMAIN` | `was-la.com` |
| `EMAIL_SENDER_DOMAIN` | `was-la.com` |

---

## الخطوة 3 — Send Email Hook في Supabase Auth

1. **Authentication → Hooks**
2. **Send Email** → Enable
3. **URL:**
   ```
   https://sukehkrhvasfnoheyvvx.supabase.co/functions/v1/auth-email-hook
   ```
4. **HTTP Headers:**
   ```
   Authorization: Bearer YOUR_AUTH_HOOK_SECRET
   ```
   (نفس قيمة `AUTH_HOOK_SECRET` من الخطوة 2)

5. **Save**

> بعد تفعيل الـ Hook، Supabase **يتوقف** عن إرسال إيميلاته الافتراضي.

---

## الخطوة 4 — Deploy Edge Functions

```powershell
cd orderflow-boutique
npx supabase functions deploy auth-email-hook process-email-queue
```

---

## الخطوة 5 — Cron لمعالجة الطابور (مهم)

الإيميل يُوضَع في طابور ثم `process-email-queue` يرسله عبر Resend.

في **Supabase → SQL Editor** (أو نفّذ عبر CLI بعد ضبط vault):

1. تأكد **pg_cron** و **pg_net** مفعّلين (Database → Extensions)
2. أنشئ cron job يستدعي `process-email-queue` كل دقيقة — راجع تعليقات
   `supabase/migrations/20260515174150_email_infra.sql` (قسم POST-MIGRATION)

**بديل سريع للاختبار:** بعد تسجيل تجريبي، استدعِ يدوياً:
```powershell
npx supabase functions invoke process-email-queue --no-verify-jwt
```
(مع service role — للاختبار فقط)

---

## الخطوة 6 — اختبار

1. سجّل حساب جديد بإيميل حقيقي
2. تحقق:
   - **From:** `noreply@was-la.com` أو `وصلة`
   - **Subject:** `تأكيد بريدك — وصلة`
   - رابط التأكيد يفتح `www.was-la.com/auth/confirm?...`
3. في Supabase SQL:
   ```sql
   SELECT template_name, status, recipient_email, created_at
   FROM email_send_log ORDER BY created_at DESC LIMIT 5;
   ```
   يجب `status = sent` (أو `pending` ثم `sent`)

---

## استكشاف الأخطاء

| المشكلة | الحل |
|---------|------|
| ما زال إيميل Supabase | Hook غير مفعّل أو URL/Secret خطأ |
| Hook 401 | `AUTH_HOOK_SECRET` لا يطابق Header |
| لا يصل إيميل | `RESEND_API_KEY` ناقص أو الدومين غير Verified |
| Resend 403 | From ليس `@was-la.com` verified |
| `email_send_log` فارغ | Hook لا يُستدعى — راجع Auth → Hooks |
| pending ولا sent | cron / `process-email-queue` لا يعمل |

---

## ملخص سريع

1. Resend + verify `was-la.com`
2. Supabase secrets (RESEND + AUTH_HOOK + SITE_URL)
3. Auth Send Email Hook
4. Deploy `auth-email-hook` + `process-email-queue`
5. Cron للطابور
6. اختبار تسجيل
