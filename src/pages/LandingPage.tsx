import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import {
  Check,
  ShoppingBag,
  Phone,
  MapPin,
  User,
  Mail,
  Ruler,
  ZoomIn,
  X,
  Star,
  ChevronDown,
  ShieldCheck,
  Sparkles,
  Award,
  Truck,
} from "lucide-react";

// محاكاة مكتبة عزل النصوص ثنائية الاتجاه bidi
const isolateLatin = (text: string) => text;

// خطافات آمنة تمنع الانهيار في حال تشغيل المكون خارج بيئة <Router>
const useNavigateSafe = () => {
  try {
    return useNavigate();
  } catch (e) {
    return (path: string, options?: any) => {
      console.log("Mock Navigate to:", path, options);
      window.location.hash = path;
    };
  }
};

const useParamsSafe = () => {
  try {
    return useParams();
  } catch (e) {
    return { slug: "premium-watch", username: "demo" };
  }
};

const useSearchParamsSafe = () => {
  try {
    return useSearchParams();
  } catch (e) {
    return [new URLSearchParams(window.location.search), () => {}] as const;
  }
};

// تحميل مكتبة DOMPurify بشكل كفء عند الحاجة فقط لعرض الوصف
let DOMPurifyModule: typeof import("dompurify") | null = null;
const loadDOMPurify = async () => {
  if (!DOMPurifyModule) {
    try {
      DOMPurifyModule = (await import("dompurify")).default as any;
    } catch (e) {
      DOMPurifyModule = {
        sanitize: (html: string) => html,
      } as any;
    }
  }
  return DOMPurifyModule!;
};

// تعريف المكونات الأساسية لواجهة المستخدم محلياً لضمان عدم حدوث أخطاء في مسارات الاستيراد
const Button = ({ className, children, ...props }: any) => (
  <button
    {...props}
    className={`inline-flex items-center justify-center rounded-xl text-sm font-semibold ring-offset-background transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 h-12 px-6 active:scale-95 shadow-md ${className}`}
  >
    {children}
  </button>
);

const Input = ({ className, ...props }: any) => (
  <input
    {...props}
    className={`flex h-12 w-full rounded-xl border border-border/80 bg-background/50 backdrop-blur-sm px-4 py-2 text-sm transition-all duration-200 placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:border-transparent disabled:cursor-not-allowed disabled:opacity-50 shadow-inner ${className}`}
  />
);

const Label = ({ className, children, ...props }: any) => (
  <label
    {...props}
    className={`text-sm font-semibold text-foreground/90 leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-75 ${className}`}
  >
    {children}
  </label>
);

const Textarea = ({ className, ...props }: any) => (
  <textarea
    {...props}
    className={`flex min-h-[100px] w-full rounded-xl border border-border/80 bg-background/50 backdrop-blur-sm px-4 py-3 text-sm transition-all duration-200 placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:border-transparent disabled:cursor-not-allowed disabled:opacity-50 shadow-inner ${className}`}
  />
);

const Skeleton = ({ className, ...props }: any) => (
  <div className={`animate-pulse rounded-2xl bg-muted/40 ${className}`} {...props} />
);

// ترويسة المتجر مدمجة ومصممة بأناقة فائقة وفخمة لتفادي مشاكل الاستيراد الخارجي
const StoreHeader = ({ ownerId }: { ownerId?: string | null }) => {
  return (
    <header className="bg-background/85 border-b border-border/60 py-4 px-6 flex justify-between items-center sticky top-0 z-50 backdrop-blur-xl shadow-sm">
      <div className="flex items-center gap-3">
        <div className="bg-primary/10 p-2 rounded-xl border border-primary/20">
          <ShoppingBag className="w-5 h-5 text-primary animate-pulse" />
        </div>
        <span className="font-bold text-lg tracking-wider text-foreground bg-clip-text bg-gradient-to-r from-primary to-accent">
          متجر النخبة الفاخر
        </span>
      </div>
      <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/70 px-3 py-1.5 rounded-full border border-border/50">
        <Sparkles className="w-3.5 h-3.5 text-amber-500 animate-spin" />
        <span className="font-semibold text-[11px]">
          رمز الموثوقية: {ownerId ? ownerId.slice(0, 8).toUpperCase() : "PREMIUM"}
        </span>
      </div>
    </header>
  );
};

// بيانات تجريبية افتراضية للمنتج عند تعذر الاتصال بقاعدة البيانات
const fallbackProduct = {
  id: "demo-prod-123",
  name: "ساعة النخبة الأوتوماتيكية الكلاسيكية - تصميم فاخر ومقاوم للماء والمؤثرات",
  slug: "premium-watch",
  price: "150",
  original_price: "250",
  description: `<p>ارتقِ بأناقتك إلى آفاق غير مسبوقة مع ساعة النخبة الاستثنائية. تُجسد هذه القطعة التحفة الفنية مزيجاً ساحراً بين الدقة الهندسية السويسرية والجمال الخالد.</p>
                <div style="margin: 20px 0; padding: 15px; background: rgba(245,158,11,0.05); border-right: 4px solid #f59e0b; border-radius: 8px;">
                  <strong style="color: #d97706;">✨ مميزات ملكية خاصة:</strong>
                  <ul style="margin-top: 8px; padding-right: 20px; list-style-type: square;">
                    <li>زجاج مقاوم للخدش فائق النقاوة والصلابة.</li>
                    <li>هيكل متين من الفولاذ المقاوم للصدأ المطلي بالذهب عيار 18.</li>
                    <li>مقاومة تامة للماء حتى عمق 50 متراً تحت سطح البحر.</li>
                  </ul>
                </div>`,
  images: [
    "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&q=80&w=800",
    "https://images.unsplash.com/photo-1542496658-e33a6d0d50f6?auto=format&fit=crop&q=80&w=800",
  ],
  product_codes: ["W-100", "W-200"],
  colors: ["الأسود الملكي الداكن", "الذهبي اللامع الفخم"],
  sizes: ["مقاس قياسي مريح"],
  upsell_enabled: true,
  upsell_title: "🎁 عروض النخبة الحصرية والمخفضة",
  upsell_offers: [
    { quantity: 2, price: 260, label: "اقتن قطعتين (لك ولمن تحب) ووفر 40 دينار بالكامل" },
    { quantity: 3, price: 350, label: "العرض العائلي الملكي: 3 قطع بخصم 100 دينار مع شحن مجاني" },
  ],
  order_form_on_top: false,
  show_quantity: true,
  stock: 6,
  size_chart_url: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&q=80&w=800",
  reviews: [
    {
      name: "سعد الدين المصراتي",
      rating: 5,
      comment: "ما شاء الله دقة في الصنع وسرعة خيالية في التوصيل لطرابلس. الساعة تبدو أفخم بكثير من الصور.",
    },
    {
      name: "فاطمة عبد المولى",
      rating: 5,
      comment: "اشتريتها كهدية لزوجي وتفاجأ بجمال التعبئة والتغليف وجودة الخامات الفاخرة.",
    },
  ],
  faqs: [
    {
      question: "كيف يمكنني التأكد من جودة الساعة ومعاينتها؟",
      answer:
        "نحن نضمن رضاك بالكامل. يمكنك فحص وتجربة الساعة بحضور مندوب الشحن قبل سداد أي مبلغ، ولديك ضمان استبدال مجاني فوري.",
    },
    {
      question: "هل تتوفر خدمة التوصيل السريع لكافة مدن ليبيا؟",
      answer:
        "نعم بالتأكيد! لدينا شبكة توزيع حصرية تغطي طرابلس، بنغازي، مصراتة، الزاوية، سبها، وكافة المدن الليبية الكبرى خلال 48 ساعة فقط.",
    },
  ],
};

// محاكاة ذكية لـ Supabase لتجنب أخطاء الاتصال الخارجي وتشغيل التطبيق محلياً بكفاءة
const supabaseMock = {
  from: (table: string) => {
    const chain = {
      select: (query?: string) => chain,
      eq: (column: string, value: any) => chain,
      is: (column: string, value: any) => chain,
      limit: (num: number) => chain,
      order: (column: string, options?: any) => ({
        then: (cb: any) =>
          cb({
            data:
              table === "order_form_fields"
                ? [
                    {
                      id: "1",
                      field_key: "name",
                      label: "الاسم الكامل للزبون",
                      placeholder: "أدخل اسمك الثلاثي للتسجيل بالدفتر الملكي",
                      field_type: "text",
                      required: true,
                    },
                    {
                      id: "2",
                      field_key: "phone",
                      label: "رقم الهاتف المباشر",
                      placeholder: "رقم هاتف مفعل لتنسيق موعد التوصيل الفوري",
                      field_type: "phone",
                      required: true,
                    },
                    {
                      id: "3",
                      field_key: "city",
                      label: "المدينة أو المنطقة السكنية",
                      placeholder: "مثال: طرابلس، بنغازي، مصراتة، الزاوية...",
                      field_type: "text",
                      required: true,
                    },
                    {
                      id: "4",
                      field_key: "address",
                      label: "تفاصيل عنوان التوصيل",
                      placeholder: "الحي، الشارع، أو بالقرب من معلم معروف للسرعة",
                      field_type: "textarea",
                      required: false,
                    },
                  ]
                : [],
            error: null,
          }),
      }),
      maybeSingle: async () => {
        if (table === "landing_pages") {
          return {
            data: {
              id: "lp-demo",
              product_id: "demo-prod-123",
              is_visible: true,
              faqs: fallbackProduct.faqs,
              upsell_enabled: true,
              upsell_offers: fallbackProduct.upsell_offers,
              title: fallbackProduct.name,
            },
            error: null,
          };
        }
        if (table === "stores") {
          return { data: { id: "store-demo", owner_id: "owner-123" }, error: null };
        }
        if (table === "store_settings") {
          return {
            data: {
              currency_symbol: "د.ل",
              currency_code: "LYD",
              button_text: "امتلكها الآن - الدفع الآمن عند معاينة طلبك",
            },
            error: null,
          };
        }
        return { data: null, error: null };
      },
      insert: async (data: any) => {
        console.log("Mock analytics event tracked:", data);
        return { data: null, error: null };
      },
    };
    return chain;
  },
  functions: {
    invoke: async (name: string, options: any) => {
      console.log("Mock edge function invoked:", name, options);
      return { data: { success: true }, error: null };
    },
  },
};

const supabase = supabaseMock;

interface Product {
  id: string;
  name: string;
  slug: string;
  price: string;
  original_price?: string;
  description: string;
  images: string[];
  product_codes?: string[];
  colors?: string[];
  sizes?: string[];
  upsell_enabled?: boolean;
  upsell_title?: string;
  upsell_offers?: Array<{ quantity: number; price: number; label: string }>;
  order_form_on_top?: boolean;
  show_quantity?: boolean;
  owner_id?: string;
  stock?: number;
  size_chart_url?: string | null;
  reviews?: Array<{ name: string; rating: number; comment: string }>;
  faqs?: Array<{ question: string; answer: string }>;
}

interface PixelSettings {
  facebook_pixel_id: string | null;
  facebook_enabled: boolean;
  tiktok_pixel_id: string | null;
  tiktok_enabled: boolean;
  google_analytics_id: string | null;
  google_enabled: boolean;
  snapchat_pixel_id: string | null;
  snapchat_enabled: boolean;
}

interface FormField {
  id: string;
  field_key: string;
  label: string;
  placeholder: string;
  field_type: string;
  required: boolean;
}

interface StoreSettings {
  currency_symbol: string;
  currency_code: string;
  button_text?: string;
}

declare global {
  interface Window {
    fbq: any;
    _fbq: any;
    ttq: any;
    gtag: any;
    dataLayer: any[];
    snaptr: any;
  }
}

const CURRENCY_ISO_MAP: Record<string, string> = {
  "د.ل": "LYD",
  "ل.د": "LYD",
  دينار: "LYD",
  LYD: "LYD",
  "د.إ": "AED",
  AED: "AED",
  درهم: "AED",
  "ر.س": "SAR",
  SAR: "SAR",
  ريال: "SAR",
  "د.ك": "KWD",
  KWD: "KWD",
  "ج.م": "EGP",
  EGP: "EGP",
  جنيه: "EGP",
  "د.أ": "JOD",
  JOD: "JOD",
  "د.ت": "TND",
  TND: "TND",
  "د.ج": "DZD",
  DZD: "DZD",
  "د.ب": "BHD",
  BHD: "BHD",
  "ر.ع": "OMR",
  OMR: "OMR",
  "ر.ق": "QAR",
  QAR: "QAR",
  "د.ع": "IQD",
  IQD: "IQD",
  "ل.س": "SYP",
  SYP: "SYP",
  "ل.ل": "LBP",
  LBP: "LBP",
  "د.م": "MAD",
  MAD: "MAD",
  $: "USD",
  USD: "USD",
  "€": "EUR",
  EUR: "EUR",
  "£": "GBP",
  GBP: "GBP",
};

function toISOCurrency(code?: string, symbol?: string): string {
  const c = (code || "").trim();
  if (/^[A-Z]{3}$/.test(c)) return c;
  if (c && CURRENCY_ISO_MAP[c]) return CURRENCY_ISO_MAP[c];
  const s = (symbol || "").trim();
  if (s && CURRENCY_ISO_MAP[s]) return CURRENCY_ISO_MAP[s];
  return "LYD";
}

const CACHE_KEYS = {
  STORE_SETTINGS: "libya_store_settings",
  PIXEL_SETTINGS: "libya_pixel_settings",
  FORM_FIELDS: "libya_form_fields",
  PRODUCT: "libya_product_",
};

const CACHE_DURATION = 5 * 60 * 1000;

function getFromCache(key: string): any {
  try {
    const cached = sessionStorage.getItem(key);
    if (cached) {
      const { data, timestamp } = JSON.parse(cached);
      if (Date.now() - timestamp < CACHE_DURATION) {
        return data;
      }
    }
  } catch {}
  return null;
}

function setToCache(key: string, data: any) {
  try {
    sessionStorage.setItem(key, JSON.stringify({ data, timestamp: Date.now() }));
  } catch {}
}

const LandingPage = () => {
  const { slug, username } = useParamsSafe();
  const navigate = useNavigateSafe();
  const [searchParams] = useSearchParamsSafe();
  const [product, setProduct] = useState<Product | null>(null);
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [storeId, setStoreId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [showSizeChart, setShowSizeChart] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formFields, setFormFields] = useState<FormField[]>([]);
  const [toastMessage, setToastMessage] = useState<{ type: string; msg: string } | null>(null);
  const [storeSettings, setStoreSettings] = useState<StoreSettings>({
    currency_symbol: "د.ل",
    currency_code: "LYD",
    button_text: "اطلب الآن - الدفع عند الاستلام",
  });
  const [formData, setFormData] = useState<Record<string, string>>({});

  const [honeypot, setHoneypot] = useState("");
  const formLoadedAtRef = useRef<number>(Date.now());
  const [quantity, setQuantity] = useState<number>(1);
  const [selectedUpsellIndex, setSelectedUpsellIndex] = useState<number | null>(null);
  const [sanitizedDescription, setSanitizedDescription] = useState<string>("");
  const [checkoutTracked, setCheckoutTracked] = useState(false);

  const showToast = (title: string, description: string, variant = "success") => {
    setToastMessage({ type: variant, msg: `${title}: ${description}` });
    setTimeout(() => setToastMessage(null), 4000);
  };

  useEffect(() => {
    const root = document.documentElement;
    const wasDark = root.classList.contains("dark");
    if (wasDark) root.classList.remove("dark");
    return () => {
      if (wasDark) root.classList.add("dark");
    };
  }, []);

  interface ItemVariant {
    color: string;
    size: string;
    productCode: string;
  }
  const [itemVariants, setItemVariants] = useState<ItemVariant[]>([{ color: "", size: "", productCode: "" }]);

  const getUtmSource = () => {
    const utmSource = searchParams.get("utm_source");
    if (utmSource) return utmSource;

    const referrer = document.referrer;
    if (referrer.includes("facebook.com") || referrer.includes("fb.com")) return "facebook";
    if (referrer.includes("instagram.com")) return "instagram";
    if (referrer.includes("tiktok.com")) return "tiktok";
    if (referrer.includes("google.com")) return "google";
    if (referrer.includes("twitter.com") || referrer.includes("x.com")) return "twitter";
    if (referrer.includes("snapchat.com")) return "snapchat";

    return "direct";
  };

  const getAttribution = () => {
    const fbclid = searchParams.get("fbclid") || "";
    const inferredSource = fbclid && !searchParams.get("utm_source") ? "facebook" : getUtmSource();
    return {
      utm_source: inferredSource,
      utm_medium: searchParams.get("utm_medium") || (fbclid ? "paid" : null),
      utm_campaign: searchParams.get("utm_campaign") || null,
      utm_content: searchParams.get("utm_content") || null,
      utm_term: searchParams.get("utm_term") || null,
      fb_campaign_id: searchParams.get("fb_campaign_id") || searchParams.get("utm_campaign") || null,
      fb_adset_id: searchParams.get("fb_adset_id") || searchParams.get("utm_term") || null,
      fb_ad_id: searchParams.get("fb_ad_id") || searchParams.get("utm_content") || null,
      fbclid: fbclid || null,
    };
  };

  useEffect(() => {
    const ac = new AbortController();
    const loadData = async () => {
      setProduct(fallbackProduct);
      setOwnerId("owner-demo");
      setStoreId("store-demo");
      setLoading(false);

      try {
        let loadedCurrency = "LYD";

        const productCacheKey = CACHE_KEYS.PRODUCT + (username || "_") + slug;
        const cachedProduct = getFromCache(productCacheKey);
        if (cachedProduct) {
          setProduct(cachedProduct.product);
          if (cachedProduct.ownerId) setOwnerId(cachedProduct.ownerId);
        }

        const profilePromise: any = username
          ? (supabase as any).from("profiles").select("*").eq("username", username).maybeSingle()
          : Promise.resolve({ data: null, error: null } as any);

        const storeBySlugPromise = username
          ? supabase.from("stores").select("id, owner_id").eq("slug", username).maybeSingle()
          : Promise.resolve({ data: null } as any);

        const landingPromise = supabase
          .from("landing_pages")
          .select("*")
          .eq("slug", slug || "premium-watch")
          .maybeSingle();

        const [profileRes, landingRes, storeBySlugRes] = await Promise.all([
          profilePromise,
          landingPromise,
          storeBySlugPromise,
        ]);
        const landingPage: any = landingRes && (landingRes as any).data ? (landingRes as any).data : null;
        const storeBySlug: any = storeBySlugRes && (storeBySlugRes as any).data ? (storeBySlugRes as any).data : null;

        if (ac.signal.aborted) return;

        let resolvedOwnerId = storeBySlug?.owner_id || "owner-demo";
        let resolvedStoreId = storeBySlug?.id || "store-demo";

        setOwnerId(resolvedOwnerId);
        setStoreId(resolvedStoreId);

        supabase
          .from("order_form_fields")
          .select("*")
          .order("sort_order", { ascending: true })
          .then((res: any) => {
            if (res.data && res.data.length > 0) {
              setFormFields(res.data);
              const initialFormData: Record<string, string> = {};
              res.data.forEach((field: FormField) => {
                initialFormData[field.field_key] = "";
              });
              setFormData((prev) => ({ ...initialFormData, ...prev }));
            } else {
              const defaultFields = [
                {
                  id: "1",
                  field_key: "name",
                  label: "الاسم الكامل",
                  placeholder: "الرجاء كتابة الاسم الثلاثي",
                  field_type: "text",
                  required: true,
                },
                {
                  id: "2",
                  field_key: "phone",
                  label: "رقم الهاتف",
                  placeholder: "رقم الهاتف لتأكيد الشحن الفوري",
                  field_type: "phone",
                  required: true,
                },
                {
                  id: "3",
                  field_key: "city",
                  label: "المدينة / المنطقة السكنية",
                  placeholder: "مثال: طرابلس، مصراتة، بنغازي...",
                  field_type: "text",
                  required: true,
                },
                {
                  id: "4",
                  field_key: "address",
                  label: "العنوان بالتفصيل",
                  placeholder: "الحي، الشارع أو علامة مميزة قريبة للتوصيل السريع",
                  field_type: "textarea",
                  required: false,
                },
              ];
              setFormFields(defaultFields);
              const initialFormData: Record<string, string> = {};
              defaultFields.forEach((field) => {
                initialFormData[field.field_key] = "";
              });
              setFormData((prev) => ({ ...initialFormData, ...prev }));
            }
          });
      } catch (error) {
        console.error("Error loading data:", error);
      }
    };

    loadData();
    return () => ac.abort();
  }, [slug]);

  useEffect(() => {
    if (!product?.description) {
      setSanitizedDescription("");
      return;
    }
    let cancelled = false;
    const run = async () => {
      const dp = await loadDOMPurify();
      if (cancelled) return;
      let html = (dp as any).sanitize(product.description) as string;

      html = html
        .replace(/<img\b(?![^>]*\bloading=)/gi, '<img loading="lazy" decoding="async"')
        .replace(/<iframe\b(?![^>]*\bloading=)/gi, '<iframe loading="lazy"');

      html = html.replace(/\s(width|height)="[^"]*"/gi, "").replace(/style="([^"]*)"/gi, (_m, s) => {
        const cleaned = s
          .replace(
            /(?:^|;)\s*(width|min-width|max-width|height|min-height|max-height|position|top|left|right|bottom|float|margin[^:]*|padding[^:]*|transform)\s*:[^;]*/gi,
            "",
          )
          .replace(/^;+|;+$/g, "")
          .trim();
        return cleaned ? `style="${cleaned}"` : "";
      });
      setSanitizedDescription(html);
    };
    if (typeof (window as any).requestIdleCallback === "function") {
      (window as any).requestIdleCallback(run, { timeout: 1500 });
    } else {
      setTimeout(run, 300);
    }
    return () => {
      cancelled = true;
    };
  }, [product?.description]);

  const handleInputChange = (fieldKey: string, value: string) => {
    let cleanedValue = value;
    const isPhoneField = formFields.find((f) => f.field_key === fieldKey)?.field_type === "phone";
    if (isPhoneField) {
      cleanedValue = value.replace(/[^0-9+]/g, "");
      if (cleanedValue.startsWith("+")) {
        cleanedValue = "+" + cleanedValue.slice(1).replace(/[^0-9]/g, "");
      } else {
        cleanedValue = cleanedValue.replace(/[^0-9]/g, "");
      }
    }
    setFormData({ ...formData, [fieldKey]: cleanedValue });

    if (!checkoutTracked && value.length > 0) {
      setCheckoutTracked(true);

      if (product) {
        const val = parseFloat(product.price);
        const currency = toISOCurrency(storeSettings.currency_code, storeSettings.currency_symbol);
        console.log("Tracked Checkout Initiation", { val, currency });
      }
    }
  };

  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();

    if (honeypot.trim() !== "") {
      navigate("/thank-you", { state: { orderData: { productName: product?.name } } });
      return;
    }

    const elapsedMs = Date.now() - formLoadedAtRef.current;
    if (elapsedMs < 3000) {
      showToast("تنبيه أمان", "يرجى التروي ومراجعة بياناتك قبل الإرسال لتفادي أي خطأ بالطلب", "destructive");
      return;
    }

    const missingFields = formFields.filter((f) => f.required && !formData[f.field_key]);
    if (missingFields.length > 0) {
      showToast("خطأ بالبيانات", "يرجى ملء جميع الحقول التي تحتوي على علامة النجمة (*)", "destructive");
      return;
    }

    const phoneField = formFields.find((f) => f.field_type === "phone");
    if (phoneField) {
      const phoneValue = formData[phoneField.field_key] || "";
      const digitsOnly = phoneValue.replace(/\D/g, "");
      if (digitsOnly.length < 9 || digitsOnly.length > 10) {
        showToast("خطأ في التحقق", "رقم الهاتف يجب أن يتكون من 9 أو 10 أرقام فقط (مثال: 091XXXXXXX)", "destructive");
        return;
      }
    }

    setIsSubmitting(true);

    try {
      const customer_name = formData.name || formData.customer_name || "زبون متميز";
      const phone = formData.phone || "لا يوجد";
      const city = formData.city || "عام";
      const address = formData.address || "غير محدد";

      const { error } = await supabase.functions.invoke("create-order", {
        body: {
          customer_name,
          phone,
          address,
          city,
          product_id: product?.id,
          quantity: quantity,
          selected_color:
            itemVariants
              .map((v) => v.color)
              .filter(Boolean)
              .join(", ") || null,
          selected_size:
            itemVariants
              .map((v) => v.size)
              .filter(Boolean)
              .join(", ") || null,
          upsell_index: selectedUpsellIndex,
          landing_slug: slug || "premium-watch",
          elapsed_ms: elapsedMs,
          ...getAttribution(),
        },
      });

      if (error) throw error;

      showToast("تم الحجز بنجاح", "تم تسجيل طلبك كطلب ممتاز! جاري تحويلك لصفحة الاستقبال", "success");

      setTimeout(() => {
        navigate("/thank-you", {
          state: {
            orderData: {
              productName: product?.name,
              price: product?.price,
              currencySymbol: storeSettings.currency_symbol,
              currencyCode: storeSettings.currency_code,
              productId: product?.id,
              quantity,
              customerName: customer_name,
              phone,
              city,
              address,
              ownerId: product?.owner_id || ownerId || null,
            },
          },
        });
      }, 1200);
    } catch (error) {
      console.error("Error submitting order:", error);
      showToast("مشكلة في الإرسال", "لم نتمكن من إرسال الطلب، يرجى التحقق من الشبكة والمحاولة مرة أخرى", "destructive");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen w-full bg-slate-50 font-cairo overflow-x-hidden" dir="rtl">
        <header className="bg-white border-b border-slate-100 py-4 px-6 text-center w-full">
          <Skeleton className="h-6 w-32 mx-auto" />
        </header>
        <section className="bg-gradient-to-l from-slate-900 via-emerald-950 to-slate-900 py-16 px-4 text-center w-full">
          <Skeleton className="h-10 w-80 mx-auto mb-3 bg-white/10" />
          <Skeleton className="h-5 w-48 mx-auto bg-white/10" />
        </section>
        <main className="w-full max-w-6xl mx-auto px-4 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <Skeleton className="aspect-square rounded-2xl" />
            <div className="space-y-4">
              <Skeleton className="h-40 rounded-xl" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-center p-4">
        <div className="bg-white p-8 rounded-3xl shadow-xl border max-w-md">
          <div className="bg-red-50 text-red-600 p-4 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
            <X className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-slate-800 mb-2">عرض غير متاح حالياً</h1>
          <p className="text-slate-500 mb-4">الصفحة المقصودة أو المنتج لم يعد متوفراً في الوقت الحالي.</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen w-full bg-[#fdfdfd] text-slate-900 font-cairo overflow-x-hidden pb-[calc(7rem+env(safe-area-inset-bottom))]"
      dir="rtl"
    >
      {/* خلفية تزيينية راقية من الإضاءات الخفيفة والناعمة */}
      <div className="absolute top-0 right-0 left-0 h-[600px] bg-gradient-to-b from-amber-500/5 via-primary/5 to-transparent -z-10 pointer-events-none" />

      {/* ترويسة المتجر الفخمة والثابتة بالقمة */}
      <StoreHeader ownerId={product?.owner_id} />

      {/* تنبيه منبثق بديل للتوست مصمم على الطراز الفاخر */}
      {toastMessage && (
        <div
          className={`fixed top-20 left-4 right-4 z-50 p-4 rounded-2xl shadow-2xl transition-all duration-300 border backdrop-blur-md flex items-center gap-3 animate-pulse ${
            toastMessage.type === "destructive"
              ? "bg-rose-950/95 text-rose-200 border-rose-800"
              : "bg-emerald-950/95 text-emerald-200 border-emerald-800"
          }`}
        >
          <div className="p-1 rounded-full bg-white/10 shrink-0">
            {toastMessage.type === "destructive" ? <X className="w-4 h-4" /> : <Check className="w-4 h-4" />}
          </div>
          <div className="font-semibold text-sm flex-1 leading-snug">{toastMessage.msg}</div>
          <button onClick={() => setToastMessage(null)} className="text-white/60 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* قسم الاستقبال الجذاب (Hero Section) مع تدرجات لونية ملكية دافئة */}
      <section className="relative overflow-hidden bg-gradient-to-l from-[#0f172a] via-[#111c30] to-[#0f172a] py-8 sm:py-16 px-4 text-center text-white w-full border-b border-amber-500/15">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none opacity-40" />
        <div className="max-w-3xl mx-auto relative z-10">
          <div className="inline-flex items-center gap-1.5 bg-amber-500/10 text-amber-400 border border-amber-500/30 px-3.5 py-1.5 rounded-full text-xs font-bold mb-4 tracking-wide shadow-sm animate-bounce">
            <Sparkles className="w-3.5 h-3.5" />
            <span>عرض ملكي متاح لفترة وجيزة</span>
          </div>
          <h1 className="text-xl sm:text-3xl md:text-5xl font-black mb-3 sm:mb-4 leading-tight bg-clip-text bg-gradient-to-b from-white via-slate-100 to-slate-300">
            {product.name}
          </h1>
          <div className="flex items-center justify-center gap-3 text-xs sm:text-base text-slate-300">
            <span className="flex items-center gap-1.5 bg-white/5 border border-white/10 px-3 py-1.5 rounded-xl">
              <Award className="w-4 h-4 text-amber-400" />
              ضمان الجودة الفائقة
            </span>
            <span className="flex items-center gap-1.5 bg-white/5 border border-white/10 px-3 py-1.5 rounded-xl">
              <Truck className="w-4 h-4 text-amber-400" />
              توصيل مجاني فوري
            </span>
          </div>
        </div>
      </section>

      <main className="w-full max-w-6xl mx-auto px-3 sm:px-6 py-6 sm:py-12">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
          {/* معرض الصور التفاعلي - فخم وذو أبعاد أنيقة */}
          <div className={product.order_form_on_top ? "order-2 lg:order-1" : ""}>
            <div className="aspect-[4/5] sm:aspect-square rounded-2xl sm:rounded-3xl overflow-hidden bg-white shadow-[0_15px_40px_-15px_rgba(0,0,0,0.12)] mb-4 relative border border-slate-100 group gpu">
              <div className="absolute top-3 right-3 z-10 bg-[#0f172a]/80 backdrop-blur-md text-amber-400 text-[10px] sm:text-xs font-bold px-3 py-1.5 rounded-full border border-amber-500/20">
                ⭐ الأكثر مبيعاً في ليبيا
              </div>
              {product.images && product.images.length > 0 ? (
                <button
                  type="button"
                  onClick={() => setLightboxOpen(true)}
                  className="relative w-full h-full flex items-center justify-center cursor-zoom-in"
                  aria-label="تكبير تفاصيل المنتج"
                >
                  <img
                    src={product.images[selectedImage]}
                    alt={product.name}
                    className="w-full h-full object-contain p-4 transition-transform duration-500 group-hover:scale-105"
                    loading="eager"
                  />
                  <div className="absolute bottom-3 left-3 bg-[#0f172a]/70 backdrop-blur-md text-white p-2.5 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 border border-white/10">
                    <ZoomIn className="w-4 h-4" />
                  </div>
                </button>
              ) : (
                <Skeleton className="w-full h-full" />
              )}
            </div>

            {/* مؤشرات الصور المصغرة بحدود متفاعلة وراقية */}
            {product.images && product.images.length > 1 && (
              <div className="flex gap-2.5 sm:gap-4 justify-center flex-wrap">
                {product.images.map((image, index) => (
                  <button
                    key={index}
                    onClick={() => setSelectedImage(index)}
                    className={`w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden border-2 bg-white transition-all duration-300 transform active:scale-95 ${
                      selectedImage === index
                        ? "border-amber-500 ring-4 ring-amber-500/15 shadow-md scale-105"
                        : "border-slate-200/80 hover:border-slate-300 hover:scale-102 shadow-sm"
                    }`}
                  >
                    <img src={image} alt="" className="w-full h-full object-contain p-1" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* استمارة تسجيل الطلبات بتأثيرات بصرية راقية وفاخرة */}
          <div className={`lg:sticky lg:top-24 h-fit ${product.order_form_on_top ? "order-1 lg:order-2" : ""}`}>
            <div className="bg-white/80 backdrop-blur-md rounded-2xl sm:rounded-3xl p-4 sm:p-8 shadow-[0_20px_50px_rgba(0,0,0,0.06)] border border-slate-100 relative overflow-hidden">
              {/* تزيين الاستمارة بشريط ذهبي جانبي ناعم */}
              <div className="absolute top-0 right-0 left-0 h-1.5 bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600" />

              <div className="text-center mb-6 sm:mb-8">
                {/* عرض الأسعار بشكل بارز مع الخصم الفعلي */}
                <div className="mb-3 flex flex-wrap items-center justify-center gap-3">
                  {product.original_price && Number(product.original_price) > Number(product.price) && (
                    <span className="text-slate-400 line-through text-lg sm:text-xl font-medium">
                      {product.original_price} {storeSettings.currency_symbol}
                    </span>
                  )}
                  <span className="text-3xl sm:text-5xl font-black text-slate-900 bg-clip-text bg-gradient-to-b from-slate-900 to-slate-850">
                    {product.price}{" "}
                    <span className="text-2xl sm:text-3xl font-bold text-amber-500">
                      {storeSettings.currency_symbol}
                    </span>
                  </span>
                </div>

                <div className="inline-flex items-center gap-2 bg-emerald-500/10 text-emerald-700 border border-emerald-500/20 px-4 py-2 rounded-full text-xs sm:text-sm font-bold">
                  <Check className="w-4 h-4 text-emerald-600" />
                  <span>الطلب مضمون ومتوفر بالمخزن الرئيسي</span>
                </div>

                {typeof product.stock === "number" && product.stock > 0 && product.stock <= 20 && (
                  <div className="mt-3 inline-flex items-center gap-1.5 bg-amber-500/10 text-amber-700 border border-amber-500/20 px-4 py-1.5 rounded-full text-xs font-bold animate-pulse">
                    🔥 تبقت {product.stock} قطع فقط في مستودع التوزيع!
                  </div>
                )}

                {product.size_chart_url && product.sizes && product.sizes.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowSizeChart(true)}
                    className="mt-3 inline-flex items-center gap-1.5 text-slate-600 text-xs font-semibold hover:text-amber-600 transition-colors hover:underline"
                  >
                    <Ruler className="w-4 h-4" /> عرض تفاصيل ودليل المقاسات للطلب
                  </button>
                )}

                {/* شريط الأمان والضمانات الفاخرة للعملاء */}
                <div className="mt-6 grid grid-cols-3 gap-2 sm:gap-3 text-xs">
                  <div className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-slate-50 border border-slate-100/80 shadow-sm transition-all hover:shadow-md hover:bg-white">
                    <span className="text-xl">💵</span>
                    <span className="font-bold text-slate-800 leading-none">معاينة قبل الدفع</span>
                  </div>
                  <div className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-slate-50 border border-slate-100/80 shadow-sm transition-all hover:shadow-md hover:bg-white">
                    <span className="text-xl">🚚</span>
                    <span className="font-bold text-slate-800 leading-none">شحن آمن وفوري</span>
                  </div>
                  <div className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-slate-50 border border-slate-100/80 shadow-sm transition-all hover:shadow-md hover:bg-white">
                    <span className="text-xl">🔄</span>
                    <span className="font-bold text-slate-800 leading-none">استبدال مرن</span>
                  </div>
                </div>
              </div>

              {/* فورم الطلب */}
              <form id="order-form" onSubmit={handleSubmitOrder} className="space-y-5">
                {/* حقل الطعم للوقاية القصوى من البوتات */}
                <div
                  aria-hidden="true"
                  style={{ position: "absolute", left: "-9999px", width: "1px", height: "1px", overflow: "hidden" }}
                >
                  <label htmlFor="website_url">Website (leave empty)</label>
                  <input
                    type="text"
                    id="website_url"
                    name="website_url"
                    tabIndex={-1}
                    autoComplete="off"
                    value={honeypot}
                    onChange={(e) => setHoneypot(e.target.value)}
                  />
                </div>

                {/* خيار تعديل الكمية بتصميم راقي وسهل التفاعل */}
                {product.show_quantity !== false && (
                  <div className="space-y-2">
                    <Label className="text-sm font-bold text-slate-800">تعديل كمية طلبك</Label>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          const base = selectedUpsellIndex !== null ? 1 : quantity;
                          const newQty = Math.max(1, base - 1);
                          setQuantity(newQty);
                          setItemVariants((prev) => {
                            const next = [...prev];
                            while (next.length < newQty) next.push({ color: "", size: "", productCode: "" });
                            return next.slice(0, newQty);
                          });
                          const matchIdx =
                            product.upsell_enabled && Array.isArray(product.upsell_offers)
                              ? product.upsell_offers.findIndex((o) => Number(o.quantity) === newQty)
                              : -1;
                          setSelectedUpsellIndex(matchIdx >= 0 ? matchIdx : null);
                        }}
                        className="w-12 h-12 rounded-xl border border-slate-200 bg-white flex items-center justify-center text-xl font-bold hover:bg-slate-50 active:scale-95 transition-all shadow-sm"
                      >
                        -
                      </button>
                      <span className="text-2xl font-black min-w-[50px] text-center text-slate-900">{quantity}</span>
                      <button
                        type="button"
                        onClick={() => {
                          const base = selectedUpsellIndex !== null ? 1 : quantity;
                          const newQty = base + 1;
                          setQuantity(newQty);
                          setItemVariants((prev) => {
                            const next =
                              selectedUpsellIndex !== null ? [{ color: "", size: "", productCode: "" }] : [...prev];
                            while (next.length < newQty) next.push({ color: "", size: "", productCode: "" });
                            return next.slice(0, newQty);
                          });
                          const matchIdx =
                            product.upsell_enabled && Array.isArray(product.upsell_offers)
                              ? product.upsell_offers.findIndex((o) => Number(o.quantity) === newQty)
                              : -1;
                          setSelectedUpsellIndex(matchIdx >= 0 ? matchIdx : null);
                        }}
                        className="w-12 h-12 rounded-xl border border-slate-200 bg-white flex items-center justify-center text-xl font-bold hover:bg-slate-50 active:scale-95 transition-all shadow-sm"
                      >
                        +
                      </button>
                    </div>
                    {(quantity > 1 || selectedUpsellIndex !== null) && (
                      <p className="text-sm font-bold text-primary bg-primary/5 border border-primary/10 px-4 py-2 rounded-xl">
                        💰 الإجمالي المستحق للطلب:{" "}
                        {selectedUpsellIndex !== null && product.upsell_offers?.[selectedUpsellIndex]
                          ? product.upsell_offers[selectedUpsellIndex].price.toFixed(2)
                          : (parseFloat(product.price) * quantity).toFixed(2)}{" "}
                        {storeSettings.currency_symbol}
                      </p>
                    )}
                  </div>
                )}

                {/* باقات العروض الخاصة وتخفيضات الكمية الفخمة */}
                {product.upsell_enabled && product.upsell_offers && product.upsell_offers.length > 0 && (
                  <div className="space-y-3 p-4 rounded-2xl border-2 border-amber-500/20 bg-amber-500/[0.02] shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 left-0 bg-amber-500 text-[#0f172a] text-[9px] font-black px-3 py-1 rounded-br-xl uppercase tracking-wider">
                      موصى به
                    </div>
                    <Label className="text-sm font-black text-amber-700 block mt-1">
                      {product.upsell_title || "🎁 عروض وهدايا حصرية"}
                    </Label>
                    <div className="space-y-2.5">
                      {product.upsell_offers.map((offer, idx) => {
                        const selected = selectedUpsellIndex === idx;
                        return (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => {
                              if (selected) {
                                setSelectedUpsellIndex(null);
                              } else {
                                setSelectedUpsellIndex(idx);
                                setQuantity(offer.quantity);
                                setItemVariants((prev) => {
                                  const next = [...prev];
                                  while (next.length < offer.quantity)
                                    next.push({ color: "", size: "", productCode: "" });
                                  return next.slice(0, offer.quantity);
                                });
                              }
                            }}
                            className={`w-full text-right p-3.5 rounded-xl border-2 transition-all duration-300 flex items-center justify-between gap-3 ${
                              selected
                                ? "border-amber-500 bg-amber-500 text-slate-950 shadow-md transform scale-[1.01]"
                                : "border-slate-200 bg-white hover:border-amber-500/50 hover:bg-amber-500/[0.01]"
                            }`}
                          >
                            <div
                              className={`w-6 h-6 rounded-full flex items-center justify-center border ${
                                selected
                                  ? "bg-[#0f172a] text-amber-400 border-[#0f172a]"
                                  : "border-slate-300 bg-white text-transparent"
                              }`}
                            >
                              {selected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="font-bold text-sm sm:text-base leading-snug">
                                {offer.label || `عرض ${offer.quantity} قطع`}
                              </div>
                              <div
                                className={`text-[11px] font-semibold ${selected ? "text-slate-900/80" : "text-slate-500"}`}
                              >
                                {offer.quantity} قطع تليق بك
                              </div>
                            </div>
                            <div
                              className={`text-base sm:text-xl font-black ${selected ? "text-slate-950" : "text-amber-600"}`}
                            >
                              {offer.price} {storeSettings.currency_symbol}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* خيارات القطع بالتفصيل */}
                {itemVariants.map((item, index) => {
                  const hasVariants =
                    (product.colors && product.colors.length > 0) || (product.sizes && product.sizes.length > 0);

                  if (!hasVariants) return null;

                  return (
                    <div
                      key={index}
                      className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-3.5 shadow-sm"
                    >
                      {quantity > 1 && (
                        <div className="text-xs font-black text-amber-600 uppercase tracking-widest">
                          تخصيص القطعة {index + 1}:
                        </div>
                      )}

                      {product.colors && product.colors.length > 0 && (
                        <div className="space-y-1.5">
                          <Label className="text-xs font-bold text-slate-600">اللون المفضل للقطعة:</Label>
                          <div className="flex flex-wrap gap-2">
                            {product.colors.map((color) => (
                              <button
                                key={color}
                                type="button"
                                onClick={() => {
                                  const newVariants = [...itemVariants];
                                  newVariants[index] = { ...newVariants[index], color };
                                  setItemVariants(newVariants);
                                }}
                                className={`px-3.5 py-2 rounded-xl border text-xs font-bold transition-all duration-200 ${
                                  item.color === color
                                    ? "border-amber-500 bg-amber-500/10 text-amber-800 ring-2 ring-amber-500/20"
                                    : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                                }`}
                              >
                                {color}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {product.sizes && product.sizes.length > 0 && (
                        <div className="space-y-1.5">
                          <Label className="text-xs font-bold text-slate-600">المقاس المناسب للقطعة:</Label>
                          <div className="flex flex-wrap gap-2">
                            {product.sizes.map((size) => (
                              <button
                                key={size}
                                type="button"
                                onClick={() => {
                                  const newVariants = [...itemVariants];
                                  newVariants[index] = { ...newVariants[index], size };
                                  setItemVariants(newVariants);
                                }}
                                className={`px-3.5 py-2 rounded-xl border text-xs font-bold transition-all duration-200 ${
                                  item.size === size
                                    ? "border-amber-500 bg-amber-500/10 text-amber-800 ring-2 ring-amber-500/20"
                                    : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                                }`}
                              >
                                {size}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* حقول نموذج البيانات للزبون */}
                <div className="space-y-4">
                  {formFields.map((field) => (
                    <div key={field.id} className="space-y-2">
                      <Label className="flex items-center gap-2 text-sm font-bold text-slate-800">
                        {field.field_type === "phone" ? (
                          <Phone className="w-4 h-4 text-amber-500" />
                        ) : field.field_type === "email" ? (
                          <Mail className="w-4 h-4 text-amber-500" />
                        ) : (
                          <User className="w-4 h-4 text-amber-500" />
                        )}
                        <span>{field.label}</span>
                        {field.required && <span className="text-rose-500 font-bold">*</span>}
                      </Label>
                      {field.field_type === "textarea" ? (
                        <Textarea
                          value={formData[field.field_key] || ""}
                          onChange={(e) => handleInputChange(field.field_key, e.target.value)}
                          placeholder={field.placeholder}
                          rows={3}
                          required={field.required}
                          className="text-base shadow-sm focus:shadow-md"
                        />
                      ) : (
                        <Input
                          value={formData[field.field_key] || ""}
                          onChange={(e) => handleInputChange(field.field_key, e.target.value)}
                          placeholder={field.placeholder}
                          type={field.field_type === "phone" ? "tel" : "text"}
                          inputMode={field.field_type === "phone" ? "tel" : "text"}
                          dir={field.field_type === "phone" ? "ltr" : "rtl"}
                          required={field.required}
                          className="text-base h-12 shadow-sm focus:shadow-md"
                        />
                      )}
                    </div>
                  ))}
                </div>

                {/* زر الإرسال الملكي */}
                <Button
                  type="submit"
                  className="w-full bg-gradient-to-r from-amber-500 via-amber-600 to-amber-700 hover:from-amber-600 hover:to-amber-800 text-[#0f172a] text-base py-6 sm:py-7 rounded-xl font-black transition-all duration-300 transform active:scale-95 shadow-[0_10px_30px_rgba(245,158,11,0.25)] hover:shadow-[0_12px_35px_rgba(245,158,11,0.35)]"
                  disabled={isSubmitting}
                >
                  {isSubmitting
                    ? "جاري تسجيل طلبك الممتاز..."
                    : storeSettings.button_text || "اطلب الآن - الدفع عند المعاينة"}
                </Button>

                <p className="text-center text-slate-500 text-xs font-bold">
                  ⚡ سنقوم بالاتصال بك هاتفياً لتأكيد موعد الشحن السريع
                </p>
              </form>
            </div>
          </div>
        </div>

        {/* وصف تفاصيل السلعة ومميزاتها */}
        {product.description && sanitizedDescription && (
          <section className="mt-12 sm:mt-20 overflow-hidden bg-white p-6 sm:p-10 rounded-3xl shadow-[0_15px_45px_rgba(0,0,0,0.03)] border border-slate-100/80">
            <div className="flex items-center gap-3 mb-6">
              <div className="bg-amber-500/10 p-2.5 rounded-xl">
                <Sparkles className="w-5 h-5 text-amber-600" />
              </div>
              <h2 className="text-xl sm:text-3xl font-black text-slate-900">أسرار وتفاصيل الفخامة</h2>
            </div>
            <div
              className="prose prose-sm sm:prose-lg max-w-none text-slate-700 leading-relaxed break-words [&_p]:mb-5 [&_strong]:text-slate-900 [&_strong]:font-black [&_ul]:list-disc [&_ul]:mr-5 [&_ul]:mb-5 [&_li]:mb-2 [&_img]:rounded-2xl [&_img]:shadow-lg [&_img]:my-6 [&_img]:object-contain"
              dangerouslySetInnerHTML={{ __html: sanitizedDescription }}
            />
          </section>
        )}

        {/* آراء وتقييمات العملاء الموثوقة */}
        {product.reviews && product.reviews.length > 0 && (
          <section className="mt-12 sm:mt-20">
            <div className="flex items-center gap-3 mb-6 sm:mb-8">
              <div className="bg-amber-500/10 p-2.5 rounded-xl">
                <Star className="w-5 h-5 text-amber-500 fill-amber-500" />
              </div>
              <h2 className="text-xl sm:text-3xl font-black text-slate-900">آراء زبائننا المتميزين</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
              {product.reviews.map((rv, i) => (
                <div
                  key={i}
                  className="p-5 sm:p-6 rounded-2xl border border-slate-100 bg-white shadow-[0_10px_30px_rgba(0,0,0,0.02)] flex flex-col justify-between hover:shadow-[0_15px_35px_rgba(0,0,0,0.04)] transition-shadow duration-300"
                >
                  <div>
                    <div className="flex items-center justify-between mb-3 border-b border-slate-50 pb-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center font-bold text-xs text-slate-600">
                          {rv.name.charAt(0)}
                        </div>
                        <span className="font-bold text-sm text-slate-900">{rv.name}</span>
                      </div>
                      <span className="text-amber-500 text-[10px] bg-amber-500/10 px-2 py-1 rounded-full font-bold">
                        {"⭐".repeat(Math.max(1, Math.min(5, rv.rating || 5)))}
                      </span>
                    </div>
                    <p className="text-sm text-slate-600 leading-relaxed font-medium">“{rv.comment}”</p>
                  </div>
                  <div className="mt-4 flex items-center gap-1.5 text-[10px] font-bold text-emerald-600">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>مشتري مؤكد وموثق بالمنصة</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* الأسئلة المتكررة الشائعة حول الخدمة والمنتج */}
        {product.faqs && product.faqs.length > 0 && (
          <section className="mt-12 sm:mt-20">
            <div className="flex items-center gap-3 mb-6">
              <div className="bg-amber-500/10 p-2.5 rounded-xl">
                <Award className="w-5 h-5 text-amber-600" />
              </div>
              <h2 className="text-xl sm:text-3xl font-black text-slate-900">الأسئلة الشائعة</h2>
            </div>
            <div className="space-y-3 sm:space-y-4">
              {product.faqs.map((faq, i) => (
                <div
                  key={i}
                  className="border border-slate-100 rounded-2xl overflow-hidden bg-white shadow-sm transition-all duration-300"
                >
                  <button
                    type="button"
                    onClick={() => setOpenFaq(openFaq === i ? null : i)}
                    className="w-full flex items-center justify-between gap-4 p-5 text-right hover:bg-slate-50/50 transition-colors"
                  >
                    <span className="font-bold text-sm sm:text-base flex-1 text-slate-900">{faq.question}</span>
                    <div
                      className={`p-1 rounded-lg bg-slate-50 transition-transform duration-300 ${openFaq === i ? "rotate-180 bg-amber-500/10 text-amber-600" : "text-slate-400"}`}
                    >
                      <ChevronDown className="w-5 h-5" />
                    </div>
                  </button>
                  {openFaq === i && (
                    <div className="px-5 pb-5 text-sm text-slate-600 leading-relaxed border-t border-slate-50 pt-4">
                      <p className="whitespace-pre-wrap font-medium">{faq.answer}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}
      </main>

      {/* نافذة تكبير وتدقيق الصور (Lightbox) */}
      {lightboxOpen && product.images && product.images.length > 0 && (
        <div
          className="fixed inset-0 z-[100] bg-[#0f172a]/95 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setLightboxOpen(false)}
        >
          <button
            type="button"
            className="absolute top-4 left-4 bg-white/10 hover:bg-white/20 text-white p-3 rounded-full transition-colors border border-white/10"
            onClick={() => setLightboxOpen(false)}
          >
            <X className="w-6 h-6" />
          </button>
          <img
            src={product.images[selectedImage]}
            alt={product.name}
            className="max-w-full max-h-full object-contain rounded-2xl shadow-2xl p-2"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {/* دليل المقاسات ومودال العرض */}
      {showSizeChart && product.size_chart_url && (
        <div
          className="fixed inset-0 z-[100] bg-[#0f172a]/90 backdrop-blur-md flex items-center justify-center p-4"
          onClick={() => setShowSizeChart(false)}
        >
          <button
            type="button"
            className="absolute top-4 left-4 bg-white/10 hover:bg-white/20 text-white p-3 rounded-full transition-colors border border-white/10"
            onClick={() => setShowSizeChart(false)}
          >
            <X className="w-6 h-6" />
          </button>
          <img
            src={product.size_chart_url}
            alt="جدول المقاسات ودليل العميل"
            className="max-w-full max-h-full object-contain bg-white rounded-2xl p-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {/* الزر السفلي العائم لسرعة التنقل والحجز (Sticky CTA) مع لمسات وتأثير زجاج بلوري فخم */}
      <div className="fixed bottom-0 inset-x-0 z-40 bg-white/80 backdrop-blur-lg border-t border-slate-100/80 px-4 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-[0_-10px_30px_rgba(0,0,0,0.05)]">
        <div className="flex items-center gap-4 max-w-md mx-auto">
          <div className="flex flex-col shrink-0">
            <span className="text-xl sm:text-2xl font-black text-slate-900 leading-tight">
              {product.price} {storeSettings.currency_symbol}
            </span>
            {product.original_price && Number(product.original_price) > Number(product.price) && (
              <span className="text-xs text-slate-400 line-through leading-none">
                {product.original_price} {storeSettings.currency_symbol}
              </span>
            )}
          </div>
          <Button
            type="button"
            onClick={() => {
              const el = document.getElementById("order-form");
              if (el) {
                el.scrollIntoView({ behavior: "smooth", block: "center" });
                const firstInput = el.querySelector<HTMLInputElement>("input, textarea");
                setTimeout(() => firstInput?.focus({ preventScroll: true }), 500);
              }
            }}
            className="flex-1 min-w-0 bg-gradient-to-r from-amber-500 via-amber-600 to-amber-700 text-[#0f172a] font-black text-sm sm:text-base py-5 rounded-xl transition-all duration-300 shadow-[0_8px_25px_rgba(245,158,11,0.2)]"
          >
            اضغط هنا لطلب المنتج الآن
          </Button>
        </div>
      </div>
    </div>
  );
};

export default LandingPage;
