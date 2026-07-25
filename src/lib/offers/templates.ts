import type { OfferType } from "./types";
import { DEFAULT_DESIGN, DEFAULT_PRICING, DEFAULT_TRIGGER } from "./types";

export interface OfferTemplate {
  key: string;
  name: string;
  category: string;
  description: string;
  offer_type: OfferType;
  design: Partial<typeof DEFAULT_DESIGN>;
  pricing: Partial<typeof DEFAULT_PRICING>;
  trigger: Partial<typeof DEFAULT_TRIGGER>;
}

export const OFFER_TEMPLATES: OfferTemplate[] = [
  {
    key: "fashion",
    name: "أزياء",
    category: "Fashion",
    description: "Upsell قطعة ثانية بخصم — مثالي للملابس والإكسسوارات",
    offer_type: "upsell",
    design: {
      title: "أكملي إطلالتكِ",
      subtitle: "أضيفي قطعة ثانية بخصم خاص",
      badge: "خصم الأزياء",
      primaryButtonText: "أضيفي للطلب",
      showTrustBadges: true,
    },
    pricing: { mode: "percent_discount", percentDiscount: 15 },
    trigger: { type: "before_checkout" },
  },
  {
    key: "electronics",
    name: "إلكترونيات",
    category: "Electronics",
    description: "Cross-sell ملحقات مع الجهاز الأساسي",
    offer_type: "cross_sell",
    design: {
      title: "كمّل جهازك",
      subtitle: "ملحقات موصى بها مع منتجك",
      badge: "موصى به",
      primaryButtonText: "أضف الملحق",
    },
    pricing: { mode: "fixed_discount", fixedDiscount: 10 },
    trigger: { type: "before_checkout" },
  },
  {
    key: "beauty",
    name: "تجميل",
    category: "Beauty",
    description: "Bundle عناية — اشترِ طقماً كاملاً بسعر أفضل",
    offer_type: "bundle",
    design: {
      title: "طقم العناية الكامل",
      subtitle: "وفّري أكثر عند الشراء معاً",
      badge: "باقة",
      showGuarantee: true,
    },
    pricing: { mode: "bundle_discount", percentDiscount: 20 },
    trigger: { type: "inside_checkout" },
  },
  {
    key: "furniture",
    name: "أثاث",
    category: "Furniture",
    description: "هدايا مجانية مع الطلبات الكبيرة",
    offer_type: "free_gift",
    design: {
      title: "هدية مع طلبك",
      subtitle: "عند إتمام الشراء تحصل على هدية",
      badge: "هدية",
      showFreeShippingLabel: true,
    },
    pricing: { mode: "free_product" },
    trigger: { type: "before_confirmation" },
  },
  {
    key: "general",
    name: "متجر عام",
    category: "General Store",
    description: "Order Bump بسيط داخل نموذج الطلب",
    offer_type: "order_bump",
    design: {
      title: "أضف هذا أيضاً؟",
      subtitle: "عرض إضافي بسعر مخفّض",
      displayStyle: "embedded",
      primaryButtonText: "نعم، أضف",
    },
    pricing: { mode: "percent_discount", percentDiscount: 10 },
    trigger: { type: "inside_checkout" },
  },
  {
    key: "cod",
    name: "الدفع عند الاستلام",
    category: "Cash On Delivery",
    description: "عرض كمية COD مع رسالة ثقة وضمان",
    offer_type: "quantity",
    design: {
      title: "اشترِ أكثر ووفّر",
      subtitle: "ادفع عند الاستلام — بدون مخاطر",
      showGuarantee: true,
      showTrustBadges: true,
      urgencyMessage: "الكمية محدودة اليوم",
    },
    pricing: { mode: "custom_price" },
    trigger: { type: "before_checkout" },
  },
  {
    key: "single_product",
    name: "منتج واحد",
    category: "Single Product",
    description: "Quantity offers لمنتج واحد على صفحة الهبوط",
    offer_type: "quantity",
    design: {
      title: "عروض الكمية",
      subtitle: "كل ما زادت الكمية زاد التوفير",
      displayStyle: "embedded",
    },
    pricing: { mode: "custom_price", showSavings: true },
    trigger: { type: "inside_checkout" },
  },
  {
    key: "high_ticket",
    name: "منتجات مرتفعة السعر",
    category: "High Ticket",
    description: "Post-purchase upsell بعد الطلب مباشرة",
    offer_type: "post_purchase",
    design: {
      title: "عرض حصري بعد طلبك",
      subtitle: "متاح فقط الآن",
      displayStyle: "fullscreen",
      showCountdown: true,
      countdownMinutes: 10,
    },
    pricing: { mode: "percent_discount", percentDiscount: 25 },
    trigger: { type: "after_order" },
  },
  {
    key: "seasonal",
    name: "تخفيضات موسمية",
    category: "Seasonal Sale",
    description: "Flash offer مع عدّاد تنازلي",
    offer_type: "flash",
    design: {
      title: "تخفيض موسمي",
      subtitle: "ينتهي قريباً",
      badge: "موسمي",
      showCountdown: true,
      countdownMinutes: 60,
      showProgressBar: true,
    },
    pricing: { mode: "percent_discount", percentDiscount: 30 },
    trigger: { type: "exit_intent" },
  },
  {
    key: "black_friday",
    name: "الجمعة البيضاء",
    category: "Black Friday",
    description: "عرض فلاش قوي مع إلحاح عالي",
    offer_type: "flash",
    design: {
      title: "الجمعة البيضاء",
      subtitle: "أكبر خصم هذا العام",
      badge: "BLACK FRIDAY",
      background: "#0f172a",
      buttonColor: "#f59e0b",
      showCountdown: true,
      countdownMinutes: 120,
      urgencyMessage: "آخر قطع لهذا السعر",
    },
    pricing: { mode: "percent_discount", percentDiscount: 50 },
    trigger: { type: "after_seconds", delaySeconds: 5 },
  },
];
