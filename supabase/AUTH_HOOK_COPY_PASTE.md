# Auth Email Hook — خطوة يدوية واحدة متبقية

> تم ضبط Secrets + نشر Functions تلقائياً. **بقي تفعيل الـ Hook في Dashboard** (Management API محظور من IP).

---

## Authentication → Auth Hooks → Send Email

| الحقل | القيمة |
|-------|--------|
| URL | `https://sukehkrhvasfnoheyvvx.supabase.co/functions/v1/auth-email-hook` |
| Hook Secret | `v1,whsec_n8G+Eymp7/6aeUAy3qZPKiEc+5Gu5OoDrWUM49fsCKo=` |

**Enable** + **Save**

> إذا كان Hook مفعّل مسبقاً: اضغط **Regenerate** أو الصق Secret أعلاه ليتطابق مع Edge Functions.

---

## ما تم ضبطه تلقائياً ✅

- `RESEND_API_KEY` — من `.env`
- `AUTH_HOOK_SECRET` / `SEND_EMAIL_HOOK_SECRET` — نفس القيمة أعلاه
- `EMAIL_CRON_SECRET` — للـ cron كل 30 ثانية
- `auth-email-hook` — منشور (`verify_jwt=false`)
- `process-email-queue` — منشور (`verify_jwt=false`) — **يعمل 200**
- pg_cron `process-email-queue` — نشط

---

## اختبار

1. «نسيت كلمة السر» على https://www.was-la.com
2. SQL: `SELECT * FROM email_send_log ORDER BY created_at DESC LIMIT 5;`
3. From: `noreply@was-la.com` عبر Resend

---

## Rate Limits (اختياري يدوي)

Authentication → Rate Limits → **Email sent** → `100`
