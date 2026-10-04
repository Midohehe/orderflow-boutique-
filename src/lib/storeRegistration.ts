import { z } from "zod";
import { normalizeContactPhone, isValidContactPhone } from "./contactPhone";

export const storeRegistrationSchema = z.object({
  email: z.string().trim().email("أدخل بريدًا إلكترونيًا صحيحًا"),
  password: z.string().min(8, "كلمة المرور يجب أن تكون 8 أحرف على الأقل"),
  username: z.string().trim().min(3, "اسم المتجر 3 أحرف على الأقل").max(30, "اسم المتجر طويل جدًا")
    .regex(/^[a-zA-Z0-9_]+$/, "استخدم حروفًا إنجليزية وأرقامًا و _ فقط").transform(v => v.toLowerCase()),
  fullName: z.string().trim().min(2, "أدخل اسمك الكامل").max(80, "الاسم طويل جدًا"),
  phone: z.string().transform(normalizeContactPhone).refine(isValidContactPhone, "أدخل رقم هاتف صحيحًا من 7 إلى 15 رقمًا"),
});
export type StoreRegistration = z.infer<typeof storeRegistrationSchema>;

export function registrationError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("already registered") || m.includes("user already")) return "هذا البريد مسجّل مسبقًا. جرّب تسجيل الدخول أو استعادة كلمة المرور.";
  if (m.includes("username") || m.includes("duplicate key")) return "اسم المتجر مستخدم بالفعل. اختر اسمًا آخر وحاول مجددًا.";
  if (m.includes("weak") || m.includes("pwned") || m.includes("compromised")) return "كلمة المرور ضعيفة أو مسرّبة. اختر كلمة مرور أقوى.";
  if (m.includes("rate limit") || m.includes("429") || m.includes("email rate")) return "تم تجاوز حد المحاولات. انتظر قليلًا ثم حاول مجددًا.";
  if (m.includes("hook") || m.includes("authorization token")) return "تعذّر إرسال رسالة التأكيد. حاول لاحقًا أو تواصل مع الإدارة.";
  if (m.includes("invalid email")) return "البريد الإلكتروني غير صالح.";
  return "تعذّر إنشاء الحساب. تحقق من الاتصال وحاول مرة أخرى.";
}
