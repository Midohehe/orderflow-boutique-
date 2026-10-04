import { z } from "zod";

const text = (max: number) => z.string().trim().min(1, "هذا الحقل مطلوب").max(max, `الحد الأقصى ${max} حرفًا`);
const item = z.object({ title: text(80), description: text(300) });
export const platformSignupSchema = z.object({
  brandName: text(40), badge: text(100), title: text(120), highlight: text(100),
  description: text(500), ctaText: text(40), formTitle: text(80), formDescription: text(200),
  featuresTitle: text(120), stepsTitle: text(120), faqTitle: text(120),
  closingTitle: text(120), closingDescription: text(300),
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, "أدخل لونًا صحيحًا مثل #315BEE"),
  features: z.array(item).min(1).max(6),
  steps: z.array(item).min(1).max(4),
  faqs: z.array(z.object({ question: text(160), answer: text(600) })).max(8),
});
export type PlatformSignupContent = z.infer<typeof platformSignupSchema>;

export const defaultSignupContent: PlatformSignupContent = {
  brandName: "وصلة", badge: "من أول طلب، إلى إدارة متكاملة",
  title: "كل تفاصيل متجرك،", highlight: "في مكان واحد.",
  description: "حوّل اهتمام عملائك إلى طلبات، وتابع الشحن والتحصيل وأرباحك من لوحة واحدة. مع وصلة، إدارة متجرك أوضح من البداية.",
  ctaText: "أنشئ متجرك الآن", formTitle: "ابدأ حكاية متجرك", formDescription: "سجّل بياناتك، أكّد بريدك، وابدأ تجهيز متجرك.",
  featuresTitle: "من صفحة المنتج، حتى تحصيل آخر طلب.", stepsTitle: "بداية واضحة. خطوة بخطوة.",
  faqTitle: "قبل ما تبدأ، خلّينا نوضّح لك.", closingTitle: "خلّي وقتك لنموّ متجرك.",
  closingDescription: "اجمع منتجاتك وطلباتك وشحناتك في مساحة واحدة، وابدأ بخطوة بسيطة اليوم.", accentColor: "#315BEE",
  features: [
    { title: "صفحات تبيع فكرتك", description: "اعرض منتجاتك وخياراتها في صفحات هبوط، واستقبل بيانات الطلب مباشرة من عملائك." },
    { title: "طلبات مرتّبة من البداية", description: "تابع التأكيد والتجهيز والتوصيل والمرتجعات، واعرف أين وصل كل طلب." },
    { title: "شحن ومناديب تحت المتابعة", description: "أسند الطلبات للمناديب، تابع الحالات، وأكمل التسويات المالية من نفس النظام." },
    { title: "أرقام تساعدك تقرر", description: "نظّم الخزائن والمصاريف، وراجع الأرباح وتكلفة الإعلان لتفهم أداء متجرك." },
  ],
  steps: [
    { title: "أنشئ حسابك", description: "أدخل بياناتك واسم متجرك، ثم فعّل حسابك من رسالة تأكيد البريد." },
    { title: "جهّز متجرك", description: "أضف منتجاتك وأسعارك واضبط صفحات الطلب وإعدادات التوصيل." },
    { title: "شارك الرابط وابدأ", description: "اربط إعلاناتك بصفحات منتجاتك، وتابع الطلبات من لوحة التحكم." },
  ],
  faqs: [
    { question: "هل أحتاج خبرة تقنية؟", answer: "تقدر تبدأ بإضافة منتجاتك وضبط صفحات الطلب من لوحة التحكم، من غير كتابة كود. وتلقى فيديوهات تعليمية داخل المنصة تساعدك في الاستخدام." },
    { question: "شن يصير بعد التسجيل؟", answer: "توصلك رسالة لتأكيد بريدك الإلكتروني. بعد التأكيد تدخل للوحة التحكم وتبدأ تجهيز متجرك وإضافة منتجاتك." },
    { question: "نقدر نخدم من الهاتف؟", answer: "تقدر تفتح المنصة من متصفح الهاتف وتتابع متجرك وطلباتك. الصفحة ولوحة التحكم تتكيّف مع حجم الشاشة." },
    { question: "هل نقدر نتابع الشحن والتحصيل؟", answer: "نعم، المنصة فيها متابعة حالات الطلبات والشحن والمناديب، وتسويات مالية مرتبطة بالخزائن." },
  ],
};

/** Untrusted settings are always parsed; malformed/old content cannot break signup. */
export function parseSignupContent(value: unknown): PlatformSignupContent {
  const result = platformSignupSchema.safeParse(value);
  return result.success ? result.data : structuredClone(defaultSignupContent);
}

export function accentTextColor(hex: string): string {
  const rgb = [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16) / 255)
    .map((v) => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722 > 0.179 ? "#101B30" : "#FFFFFF";
}
