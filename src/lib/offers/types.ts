export type OfferStatus = "active" | "draft" | "disabled";

export type OfferType =
  | "upsell"
  | "cross_sell"
  | "post_purchase"
  | "order_bump"
  | "bundle"
  | "quantity"
  | "buy_x_get_y"
  | "free_gift"
  | "free_shipping"
  | "flash";

export type DisplayStyle =
  | "popup"
  | "slide_in"
  | "fullscreen"
  | "embedded"
  | "floating_bar"
  | "thank_you"
  | "side_panel";

export type TriggerType =
  | "before_checkout"
  | "inside_checkout"
  | "before_confirmation"
  | "after_order"
  | "thank_you_page"
  | "after_seconds"
  | "exit_intent"
  | "scroll_percent"
  | "button_click"
  | "manual";

export type PricingMode =
  | "fixed_discount"
  | "percent_discount"
  | "custom_price"
  | "free_product"
  | "free_shipping"
  | "bundle_discount"
  | "auto_coupon";

export interface OfferDesign {
  title: string;
  subtitle: string;
  description: string;
  badge: string;
  image: string;
  background: string;
  borderRadius: number;
  shadow: boolean;
  spacing: number;
  popupWidth: number;
  animation: "fade" | "slide" | "zoom" | "none";
  displayStyle: DisplayStyle;
  primaryButtonText: string;
  secondaryButtonText: string;
  buttonStyle: "solid" | "outline" | "gradient";
  buttonColor: string;
  buttonSize: "sm" | "md" | "lg";
  showCountdown: boolean;
  countdownMinutes: number;
  showProgressBar: boolean;
  showTrustBadges: boolean;
  showReviews: boolean;
  showGuarantee: boolean;
  showFreeShippingLabel: boolean;
  showDiscountBadge: boolean;
  urgencyMessage: string;
  inventoryMessage: string;
}

export interface OfferPricing {
  mode: PricingMode;
  fixedDiscount: number;
  percentDiscount: number;
  customPrice: number;
  couponCode: string;
  showOriginalPrice: boolean;
  showDiscountPercent: boolean;
  showSavings: boolean;
}

export interface OfferTrigger {
  type: TriggerType;
  delaySeconds: number;
  scrollPercent: number;
  buttonSelector: string;
}

export interface OfferFrequency {
  mode: "once" | "once_per_session" | "once_per_customer" | "every_visit" | "every_x_days";
  everyDays: number;
  maxDailyViews: number;
  maxAcceptances: number;
}

export interface OfferSchedule {
  startDate: string;
  endDate: string;
  timezone: string;
  businessHoursOnly: boolean;
  businessHoursStart: string;
  businessHoursEnd: string;
  weekdays: number[];
  holidayExclusions: string[];
}

export interface OfferProductRow {
  id?: string;
  product_id?: string | null;
  category_id?: string | null;
  collection_key?: string | null;
  sort_order: number;
  is_default: boolean;
  allow_variants: boolean;
  allow_multi_select: boolean;
  product_name?: string;
  product_image?: string;
  product_price?: number;
  stock?: number;
}

export interface OfferRule {
  id?: string;
  group_id?: string | null;
  field: string;
  operator: string;
  value: string | number | boolean | string[];
  sort_order: number;
}

export interface OfferRuleGroup {
  id?: string;
  parent_group_id?: string | null;
  logic: "and" | "or";
  sort_order: number;
  rules: OfferRule[];
  children?: OfferRuleGroup[];
}

export interface OfferAction {
  id?: string;
  on_event: "accept" | "decline";
  action_type: string;
  config: Record<string, unknown>;
  sort_order: number;
}

export interface OfferRecord {
  id: string;
  owner_id: string;
  store_id: string;
  name: string;
  status: OfferStatus;
  priority: number;
  offer_type: OfferType;
  design: OfferDesign;
  pricing: OfferPricing;
  trigger_config: OfferTrigger;
  frequency: OfferFrequency;
  schedule: OfferSchedule;
  template_key?: string | null;
  created_at?: string;
  updated_at?: string;
  products?: OfferProductRow[];
  rule_groups?: OfferRuleGroup[];
  actions?: OfferAction[];
  stats?: OfferStats;
}

export interface OfferStats {
  offer_id: string;
  views: number;
  clicks: number;
  accepts: number;
  rejects: number;
  revenue: number;
  acceptance_rate?: number;
}

export interface FlowNode {
  id: string;
  type: "landing" | "checkout" | "offer" | "accept" | "decline" | "thank_you" | "downsell";
  label: string;
  offerId?: string | null;
  x: number;
  y: number;
  disabled?: boolean;
}

export interface FlowEdge {
  id: string;
  from: string;
  to: string;
  label?: string;
}

export interface OfferFlow {
  id: string;
  owner_id: string;
  store_id: string;
  name: string;
  is_active: boolean;
  graph: { nodes: FlowNode[]; edges: FlowEdge[] };
  created_at?: string;
  updated_at?: string;
}

export const OFFER_TYPE_META: Record<
  OfferType,
  { label: string; description: string; icon: string; color: string }
> = {
  upsell: {
    label: "Upsell",
    description: "اقترح منتجاً أعلى قيمة أو كمية أكبر قبل إتمام الطلب لزيادة متوسط قيمة السلة.",
    icon: "TrendingUp",
    color: "from-emerald-500 to-teal-600",
  },
  cross_sell: {
    label: "Cross Sell",
    description: "اعرض منتجات مكملة للمنتج الحالي (مثلاً إكسسوار مع المنتج الأساسي).",
    icon: "GitBranch",
    color: "from-blue-500 to-indigo-600",
  },
  post_purchase: {
    label: "Post Purchase",
    description: "عرض بعد تأكيد الطلب مباشرة — فرصة أخيرة قبل صفحة الشكر.",
    icon: "Gift",
    color: "from-violet-500 to-purple-600",
  },
  order_bump: {
    label: "Order Bump",
    description: "إضافة صغيرة داخل صفحة الطلب بضغطة واحدة (مربع اختيار) قبل الإرسال.",
    icon: "PlusSquare",
    color: "from-amber-500 to-orange-600",
  },
  bundle: {
    label: "Bundle Offer",
    description: "حزمة منتجات بسعر موحّد أو خصم على الشراء معاً.",
    icon: "Boxes",
    color: "from-cyan-500 to-sky-600",
  },
  quantity: {
    label: "Quantity Offer",
    description: "عروض الكمية: اشترِ 2 بسعر أقل، 3 بسعر أفضل…",
    icon: "Layers",
    color: "from-rose-500 to-pink-600",
  },
  buy_x_get_y: {
    label: "Buy X Get Y",
    description: "اشترِ X واحصل على Y مجاناً أو بخصم.",
    icon: "Sparkles",
    color: "from-fuchsia-500 to-pink-600",
  },
  free_gift: {
    label: "Free Gift",
    description: "هدية مجانية عند بلوغ شرط معيّن (قيمة طلب، منتج، كمية).",
    icon: "Gift",
    color: "from-lime-500 to-green-600",
  },
  free_shipping: {
    label: "Free Shipping",
    description: "شحن مجاني عند استيفاء شرط (قيمة الطلب أو منتج معيّن).",
    icon: "Truck",
    color: "from-sky-500 to-blue-600",
  },
  flash: {
    label: "Flash Offer",
    description: "عرض محدود بوقت مع عدّاد تنازلي لخلق إلحاح الشراء.",
    icon: "Zap",
    color: "from-yellow-500 to-amber-600",
  },
};

export const DEFAULT_DESIGN: OfferDesign = {
  title: "عرض خاص لك",
  subtitle: "لا تفوّت هذه الفرصة",
  description: "",
  badge: "عرض محدود",
  image: "",
  background: "#ffffff",
  borderRadius: 16,
  shadow: true,
  spacing: 16,
  popupWidth: 480,
  animation: "fade",
  displayStyle: "popup",
  primaryButtonText: "أضف العرض",
  secondaryButtonText: "لا شكراً",
  buttonStyle: "gradient",
  buttonColor: "#10b981",
  buttonSize: "lg",
  showCountdown: false,
  countdownMinutes: 15,
  showProgressBar: false,
  showTrustBadges: true,
  showReviews: false,
  showGuarantee: true,
  showFreeShippingLabel: false,
  showDiscountBadge: true,
  urgencyMessage: "ينتهي العرض قريباً",
  inventoryMessage: "",
};

export const DEFAULT_PRICING: OfferPricing = {
  mode: "percent_discount",
  fixedDiscount: 0,
  percentDiscount: 10,
  customPrice: 0,
  couponCode: "",
  showOriginalPrice: true,
  showDiscountPercent: true,
  showSavings: true,
};

export const DEFAULT_TRIGGER: OfferTrigger = {
  type: "before_checkout",
  delaySeconds: 3,
  scrollPercent: 50,
  buttonSelector: "",
};

export const DEFAULT_FREQUENCY: OfferFrequency = {
  mode: "once_per_session",
  everyDays: 7,
  maxDailyViews: 0,
  maxAcceptances: 0,
};

export const DEFAULT_SCHEDULE: OfferSchedule = {
  startDate: "",
  endDate: "",
  timezone: "Africa/Tripoli",
  businessHoursOnly: false,
  businessHoursStart: "09:00",
  businessHoursEnd: "22:00",
  weekdays: [0, 1, 2, 3, 4, 5, 6],
  holidayExclusions: [],
};

export const RULE_FIELDS = [
  { value: "product", label: "المنتج" },
  { value: "category", label: "التصنيف" },
  { value: "brand", label: "العلامة" },
  { value: "collection", label: "المجموعة" },
  { value: "landing_page", label: "صفحة الهبوط" },
  { value: "store", label: "المتجر" },
  { value: "order_value", label: "قيمة الطلب" },
  { value: "customer_city", label: "مدينة الزبون" },
  { value: "country", label: "الدولة" },
  { value: "device", label: "الجهاز" },
  { value: "os", label: "نظام التشغيل" },
  { value: "traffic_source", label: "مصدر الزيارة" },
  { value: "utm_source", label: "UTM Source" },
  { value: "utm_campaign", label: "UTM Campaign" },
  { value: "fb_campaign", label: "حملة فيسبوك" },
  { value: "google_campaign", label: "حملة جوجل" },
  { value: "returning_customer", label: "زبون عائد" },
  { value: "new_customer", label: "زبون جديد" },
  { value: "customer_tags", label: "وسوم الزبون" },
  { value: "coupon_used", label: "كوبون مستخدم" },
  { value: "order_quantity", label: "كمية الطلب" },
  { value: "payment_method", label: "طريقة الدفع" },
  { value: "shipping_method", label: "طريقة الشحن" },
  { value: "date", label: "التاريخ" },
  { value: "time", label: "الوقت" },
  { value: "day_of_week", label: "يوم الأسبوع" },
  { value: "inventory", label: "مستوى المخزون" },
  { value: "custom_field", label: "حقل مخصص" },
] as const;

export const ACCEPT_ACTIONS = [
  { value: "add_to_order", label: "إضافة المنتج للطلب الحالي" },
  { value: "create_order", label: "إنشاء طلب آخر" },
  { value: "apply_discount", label: "تطبيق خصم" },
  { value: "add_free_gift", label: "إضافة هدية مجانية" },
  { value: "recalc_shipping", label: "إعادة حساب الشحن" },
  { value: "redirect_offer", label: "توجيه لعرض آخر" },
  { value: "redirect_url", label: "توجيه لرابط مخصص" },
  { value: "redirect_thank_you", label: "توجيه لصفحة الشكر" },
] as const;

export const DECLINE_ACTIONS = [
  { value: "do_nothing", label: "لا شيء" },
  { value: "show_offer", label: "عرض آخر" },
  { value: "show_downsell", label: "عرض Downsell" },
  { value: "redirect_thank_you", label: "توجيه لصفحة الشكر" },
  { value: "redirect_funnel", label: "توجيه لقمع آخر" },
  { value: "close_popup", label: "إغلاق النافذة" },
] as const;

export function emptyOfferDraft(offerType: OfferType = "upsell"): Omit<
  OfferRecord,
  "id" | "owner_id" | "store_id"
> {
  return {
    name: "",
    status: "draft",
    priority: 0,
    offer_type: offerType,
    design: { ...DEFAULT_DESIGN },
    pricing: { ...DEFAULT_PRICING },
    trigger_config: { ...DEFAULT_TRIGGER },
    frequency: { ...DEFAULT_FREQUENCY },
    schedule: { ...DEFAULT_SCHEDULE },
    template_key: null,
    products: [],
    rule_groups: [{ logic: "and", sort_order: 0, rules: [] }],
    actions: [
      { on_event: "accept", action_type: "add_to_order", config: {}, sort_order: 0 },
      { on_event: "decline", action_type: "close_popup", config: {}, sort_order: 0 },
    ],
  };
}
