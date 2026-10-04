import { useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Check, Eye, EyeOff, Loader2, Mail } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { registrationError, storeRegistrationSchema, type StoreRegistration } from "@/lib/storeRegistration";

export default function StoreSignupForm({ ctaText, preview = false }: { ctaText: string; preview?: boolean }) {
  const { user, loading, signUp } = useAuth();
  const navigate = useNavigate();
  const [values, setValues] = useState<StoreRegistration>({ fullName: "", username: "", phone: "", email: "", password: "" });
  const [errors, setErrors] = useState<Partial<Record<keyof StoreRegistration, string>>>({});
  const [failure, setFailure] = useState("");
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const submitting = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (preview || submitting.current || loading || user || success) return;
    setFailure("");
    const parsed = storeRegistrationSchema.safeParse(values);
    if (!parsed.success) {
      const next: typeof errors = {};
      for (const issue of parsed.error.issues) next[issue.path[0] as keyof StoreRegistration] ??= issue.message;
      setErrors(next);
      const first = parsed.error.issues[0].path[0];
      formRef.current?.querySelector<HTMLInputElement>(`[name="${first}"]`)?.focus();
      return;
    }
    setErrors({}); submitting.current = true; setBusy(true);
    try {
      const data = parsed.data;
      const result = await signUp(data.email, data.password, data.username, data.fullName, data.phone);
      if (result.error) { setFailure(registrationError(result.error.message)); return; }
      setValues({ ...data, password: "" });
      setSuccess(true);
      if (!result.needsEmailConfirmation) navigate("/dashboard");
    } catch { setFailure("تعذّر الاتصال. بياناتك ما زالت في النموذج؛ حاول مرة أخرى."); }
    finally { submitting.current = false; setBusy(false); }
  };

  if (success) return <div className="ps-success" role="status">
    <span className="ps-success-icon"><Mail size={30} /></span>
    <h3>باقي خطوة: أكّد بريدك</h3><p>أرسلنا رابط التفعيل إلى <b dir="ltr">{values.email}</b>. افتح الرسالة واضغط الرابط لتكمل الدخول لمتجرك.</p>
    <p>لو ما لقيت الرسالة، راجع مجلد الرسائل غير المرغوب فيها (Spam).</p>
    <Link to="/login" className="ps-button">الذهاب لتسجيل الدخول <ArrowLeft size={18} /></Link>
  </div>;
  if (user && !preview) return <div className="ps-success">
    <span className="ps-success-icon"><Check size={30} /></span><h3>حسابك جاهز</h3><p>أنت مسجّل الدخول بالفعل. تقدر تكمّل إدارة متجرك من لوحة التحكم.</p>
    <Link to="/dashboard" className="ps-button">افتح لوحة التحكم <ArrowLeft size={18} /></Link>
  </div>;

  const input = (name: keyof StoreRegistration, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => <div className="ps-field" key={name}>
    <label htmlFor={`register-${name}`}>{label}</label>
    <div className="ps-input-wrap"><input id={`register-${name}`} name={name} value={values[name]} required
      onChange={e => { setValues(v => ({ ...v, [name]: name === "username" ? e.target.value.toLowerCase() : e.target.value })); setErrors(v => ({ ...v, [name]: undefined })); }}
      aria-invalid={Boolean(errors[name])} aria-describedby={errors[name] ? `register-${name}-error` : name === "username" || name === "phone" || name === "password" ? `register-${name}-help` : undefined} {...props} />
      {name === "password" && <button type="button" className="ps-password-toggle" onClick={() => setShowPassword(v => !v)} aria-label={showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"} aria-pressed={showPassword}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button>}
    </div>
    {errors[name] ? <p id={`register-${name}-error`} className="ps-field-error">{errors[name]}</p> :
      name === "username" ? <p id="register-username-help">رابط متجرك: <bdi>/store/{values.username || "your_store"}</bdi></p> :
      name === "phone" ? <p id="register-phone-help">للتواصل مع الإدارة، ولا يظهر لزوار متجرك.</p> :
      name === "password" ? <p id="register-password-help">8 أحرف على الأقل. استخدم كلمة مرور خاصة بهذا الحساب.</p> : null}
  </div>;

  return <form className="ps-form" onSubmit={submit} noValidate ref={formRef} aria-label="إنشاء حساب متجر" aria-busy={busy}>
    <fieldset disabled={busy || loading || preview}>
      {input("fullName", "الاسم الكامل", { autoComplete: "name", placeholder: "اسم صاحب المتجر", maxLength: 80 })}
      {input("username", "اسم المتجر بالإنجليزية", { autoComplete: "username", placeholder: "your_store", dir: "ltr", maxLength: 30, autoCapitalize: "none", spellCheck: false })}
      {input("phone", "رقم الهاتف", { type: "tel", inputMode: "tel", autoComplete: "tel", placeholder: "0912345678", dir: "ltr", maxLength: 32 })}
      {input("email", "البريد الإلكتروني", { type: "email", inputMode: "email", autoComplete: "email", placeholder: "you@example.com", dir: "ltr", maxLength: 254, autoCapitalize: "none" })}
      {input("password", "كلمة المرور", { type: showPassword ? "text" : "password", autoComplete: "new-password", placeholder: "اختر كلمة مرور قوية", minLength: 8, dir: "ltr" })}
      {failure && <div role="alert" className="ps-error">{failure}</div>}
      <button className="ps-button ps-submit" type="submit">{busy ? <><Loader2 className="animate-spin" size={18} /> جارٍ إنشاء الحساب…</> : loading && !preview ? "جارٍ التحقق من الحساب…" : <>{ctaText}<ArrowLeft size={18} /></>}</button>
    </fieldset>
    <p className="ps-form-note">سنرسل رابط تأكيد إلى بريدك لتفعيل الحساب. <Link to="/privacy" target="_blank" rel="noopener noreferrer">سياسة الخصوصية</Link></p>
    <div className="ps-form-login">عندك حساب بالفعل؟ <Link to="/login">سجّل الدخول</Link></div>
  </form>;
}
