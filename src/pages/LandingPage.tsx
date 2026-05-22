import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Check, ShoppingBag, Phone, MapPin, User, Mail, Ruler, ZoomIn, X, Star, ChevronDown } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { isolateLatin } from "@/lib/bidi";
import StoreHeader from "@/components/StoreHeader";

// Lazy-load DOMPurify only when description is rendered
let DOMPurifyModule: typeof import("dompurify") | null = null;
const loadDOMPurify = async () => {
  if (!DOMPurifyModule) DOMPurifyModule = (await import("dompurify")).default as any;
  return DOMPurifyModule!;
};

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
  enabled: boolean;
  sort_order: number;
}

interface StoreSettings {
  currency_symbol: string;
  currency_code: string;
  button_text?: string;
}

// Declare fbq for TypeScript
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

// Map Arabic currency symbols / non-ISO codes to ISO 4217 codes required by Facebook/TikTok/GA
const CURRENCY_ISO_MAP: Record<string, string> = {
  "د.ل": "LYD", "ل.د": "LYD", "دينار": "LYD", "LYD": "LYD",
  "د.إ": "AED", "AED": "AED", "درهم": "AED",
  "ر.س": "SAR", "SAR": "SAR", "ريال": "SAR",
  "د.ك": "KWD", "KWD": "KWD",
  "ج.م": "EGP", "EGP": "EGP", "جنيه": "EGP",
  "د.أ": "JOD", "JOD": "JOD",
  "د.ت": "TND", "TND": "TND",
  "د.ج": "DZD", "DZD": "DZD",
  "د.ب": "BHD", "BHD": "BHD",
  "ر.ع": "OMR", "OMR": "OMR",
  "ر.ق": "QAR", "QAR": "QAR",
  "د.ع": "IQD", "IQD": "IQD",
  "ل.س": "SYP", "SYP": "SYP",
  "ل.ل": "LBP", "LBP": "LBP",
  "د.م": "MAD", "MAD": "MAD",
  "$": "USD", "USD": "USD",
  "€": "EUR", "EUR": "EUR",
  "£": "GBP", "GBP": "GBP",
};
function toISOCurrency(code?: string, symbol?: string): string {
  const c = (code || "").trim();
  if (/^[A-Z]{3}$/.test(c)) return c;
  if (c && CURRENCY_ISO_MAP[c]) return CURRENCY_ISO_MAP[c];
  const s = (symbol || "").trim();
  if (s && CURRENCY_ISO_MAP[s]) return CURRENCY_ISO_MAP[s];
  return "LYD"; // sensible default for this Libya-focused platform
}

// Cache keys
const CACHE_KEYS = {
  STORE_SETTINGS: 'libya_store_settings',
  PIXEL_SETTINGS: 'libya_pixel_settings',
  FORM_FIELDS: 'libya_form_fields',
  PRODUCT: 'libya_product_',
};

// Cache duration: 5 minutes
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
  const { slug, username } = useParams<{ slug: string; username?: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
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
  const [storeSettings, setStoreSettings] = useState<StoreSettings>({ currency_symbol: "د.ل", currency_code: "LYD", button_text: "اطلب الآن - الدفع عند الاستلام" });
  const [formData, setFormData] = useState<Record<string, string>>({});
  // Bot protection: honeypot field + form load time
  const [honeypot, setHoneypot] = useState("");
  const formLoadedAtRef = useRef<number>(Date.now());
  const [selectedProductCode, setSelectedProductCode] = useState<string>("");
  const [quantity, setQuantity] = useState<number>(1);
  const [selectedUpsellIndex, setSelectedUpsellIndex] = useState<number | null>(null);
  const [sanitizedDescription, setSanitizedDescription] = useState<string>("");
  
  // Force light mode — landing pages should always look the same regardless of dashboard theme
  useEffect(() => {
    const root = document.documentElement;
    const wasDark = root.classList.contains("dark");
    if (wasDark) root.classList.remove("dark");
    return () => {
      if (wasDark) root.classList.add("dark");
    };
  }, []);
  
  // For multiple items with different variants
  interface ItemVariant {
    color: string;
    size: string;
    productCode: string;
  }
  const [itemVariants, setItemVariants] = useState<ItemVariant[]>([{ color: "", size: "", productCode: "" }]);
  
  
  // Get UTM source from URL params
  const getUtmSource = () => {
    const utmSource = searchParams.get("utm_source");
    if (utmSource) return utmSource;
    
    // Try to detect from referrer
    const referrer = document.referrer;
    if (referrer.includes("facebook.com") || referrer.includes("fb.com")) return "facebook";
    if (referrer.includes("instagram.com")) return "instagram";
    if (referrer.includes("tiktok.com")) return "tiktok";
    if (referrer.includes("google.com")) return "google";
    if (referrer.includes("twitter.com") || referrer.includes("x.com")) return "twitter";
    if (referrer.includes("snapchat.com")) return "snapchat";
    
    return "direct";
  };

  // Full UTM + FB attribution captured from URL
  const getAttribution = () => {
    const fbclid = searchParams.get("fbclid") || "";
    const inferredSource = (fbclid && !searchParams.get("utm_source")) ? "facebook" : getUtmSource();
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
      if (!slug) {
        setLoading(false);
        return;
      }

      try {
        // Owner-scoped caches will be read after we resolve the product owner.
        let loadedCurrency = "AED";

        // Cached product for instant render
        const productCacheKey = CACHE_KEYS.PRODUCT + (username || '_') + slug;
        const cachedProduct = getFromCache(productCacheKey);
        if (cachedProduct) {
          setProduct(cachedProduct.product);
          if (cachedProduct.ownerId) setOwnerId(cachedProduct.ownerId);
          setLoading(false);
        }

        // Run profile + product in parallel
        const profilePromise = username
          ? supabase.from("profiles").select("user_id, is_active").eq("username", username).maybeSingle()
          : Promise.resolve({ data: null, error: null } as any);

        // Two-stage fetch: lightweight fields first (fast), images second (heavy base64)
        const productLightSelect = "id, name, slug, price, original_price, description, product_codes, colors, sizes, owner_id, store_id, upsell_enabled, upsell_title, upsell_offers, order_form_on_top, is_visible, stock, size_chart_url, reviews";

        // أولاً: حاول مطابقة username كرابط متجر (slug) لتحديد store_id
        const storeBySlugPromise = username
          ? supabase.from("stores").select("id, owner_id").eq("slug", username).maybeSingle()
          : Promise.resolve({ data: null } as any);

        // ابحث عن صفحة هبوط بهذا الـ slug، فإن وُجدت نأخذ المنتج المرتبط ونطبّق إعدادات الصفحة
        const landingPromise = supabase
          .from("landing_pages")
          .select("id, product_id, store_id, slug, title, subtitle, description, images, price, original_price, upsell_enabled, upsell_title, upsell_offers, order_form_on_top, show_quantity, is_visible, faqs")
          .eq("slug", slug)
          .maybeSingle();

        const [profileRes, landingRes, storeBySlugRes] = await Promise.all([profilePromise, landingPromise, storeBySlugPromise]);
        const landingPage: any = landingRes && (landingRes as any).data ? (landingRes as any).data : null;
        const storeBySlug: any = storeBySlugRes && (storeBySlugRes as any).data ? (storeBySlugRes as any).data : null;

        // إن وُجدت صفحة هبوط: نأخذ المنتج بمعرّفه. وإلا نرجع للسلوك القديم (slug في products).
        const productPromise = landingPage
          ? supabase.from("products").select(productLightSelect).eq("id", landingPage.product_id).is("deleted_at", null)
          : supabase
              .from("products")
              .select(productLightSelect)
              .eq("slug", slug)
              .eq("is_visible", true)
              .is("deleted_at", null);

        const productRes = await productPromise;

        if (ac.signal.aborted) return;
        let resolvedOwnerId: string | null = null;
        let resolvedStoreId: string | null = storeBySlug?.id || landingPage?.store_id || null;
        if (storeBySlug) {
          resolvedOwnerId = storeBySlug.owner_id;
          setOwnerId(storeBySlug.owner_id);
        } else if (username) {
          const prof = (profileRes as any).data;
          if (!prof || !prof.is_active) { setLoading(false); return; }
          resolvedOwnerId = prof.user_id;
          setOwnerId(prof.user_id);
        }
        if (resolvedStoreId) setStoreId(resolvedStoreId);

        if (productRes.error) throw productRes.error;
        const rows = (productRes.data as any[]) || [];
        const matched = resolvedOwnerId ? rows.find((r) => r.owner_id === resolvedOwnerId) : rows[0];

        // إذا كانت الصفحة مخفية أو المنتج مخفي، أوقف
        if (landingPage && landingPage.is_visible === false) { setLoading(false); return; }
        if (matched && matched.is_visible === false && !landingPage) { setLoading(false); return; }

        let loadedProduct: Product | null = null;
        if (matched) {
          // طبّق overrides من صفحة الهبوط إن وُجدت
          const lp = landingPage;
          // اضبط مالك المتجر (مهم لتتبع التحليلات وربط الأحداث بالمتجر الصحيح)
          if (!resolvedOwnerId && matched.owner_id) {
            resolvedOwnerId = matched.owner_id;
            setOwnerId(matched.owner_id);
          }
          if (!resolvedStoreId && (matched as any).store_id) {
            resolvedStoreId = (matched as any).store_id;
            setStoreId((matched as any).store_id);
          }
          const lpImages: string[] = Array.isArray(lp?.images) ? lp.images : [];
          const lpHasUpsell = lp ? lp.upsell_enabled : null;
          loadedProduct = {
            id: matched.id,
            name: matched.name,
            slug: lp?.slug || matched.slug,
            price: String(lp?.price ?? matched.price),
            original_price: (lp?.original_price ?? matched.original_price) ? String(lp?.original_price ?? matched.original_price) : undefined,
            description: (lp?.description ?? matched.description) || "",
            images: lpImages.length ? lpImages : (cachedProduct?.product?.images || []),
            product_codes: matched.product_codes || [],
            colors: matched.colors || [],
            sizes: matched.sizes || [],
            // Upsell is controlled exclusively by the landing page.
            upsell_enabled: !!lp?.upsell_enabled,
            upsell_title: (lp?.upsell_title || "🎁 عروض خاصة"),
            upsell_offers: Array.isArray(lp?.upsell_offers) ? lp.upsell_offers : [],
            order_form_on_top: lp?.order_form_on_top != null ? !!lp.order_form_on_top : !!(matched as any).order_form_on_top,
            show_quantity: lp?.show_quantity != null ? !!lp.show_quantity : true,
            // عنوان مخصص لصفحة الهبوط (إن وُجد)
            ...(lp?.title ? { name: lp.title } : {}),
            stock: typeof (matched as any).stock === "number" ? (matched as any).stock : undefined,
            size_chart_url: (matched as any).size_chart_url || null,
            reviews: Array.isArray((matched as any).reviews) ? (matched as any).reviews : [],
            faqs: Array.isArray(lp?.faqs) ? lp.faqs : [],
          };
          setProduct(loadedProduct);

          // Fetch heavy product images separately فقط إذا لم تكن صفحة الهبوط تملك صورها الخاصة
          if (!lpImages.length) {
            supabase.from("products").select("images").eq("id", matched.id).maybeSingle().then(({ data }) => {
              if (data?.images && (data.images as string[]).length) {
                const imgs = data.images as string[];
                setProduct((prev) => prev ? { ...prev, images: imgs } : prev);
                setToCache(productCacheKey, { product: { ...(loadedProduct as Product), images: imgs }, ownerId: resolvedOwnerId || matched.owner_id });
              }
            });
          } else {
            setToCache(productCacheKey, { product: loadedProduct, ownerId: resolvedOwnerId || matched.owner_id });
          }
        }

        setLoading(false);

        // SECONDARY: fetch the rest in the background, prefer cache.
        const ownerForSettings = resolvedOwnerId || matched?.owner_id;
        const storeForSettings = resolvedStoreId || (matched as any)?.store_id || null;
        const productResult = { data: matched } as any;

        // Owner-scoped cache keys so different stores don't pollute each other's
        // form fields, store currency, or pixel settings.
        const ownerSuffix = (ownerForSettings || "_") + "_" + (storeForSettings || "_");
        const storeKey = CACHE_KEYS.STORE_SETTINGS + "_" + ownerSuffix;
        const pixelKey = CACHE_KEYS.PIXEL_SETTINGS + "_" + ownerSuffix;
        const formKey = CACHE_KEYS.FORM_FIELDS + "_" + ownerSuffix;

        const cachedStoreSettings = getFromCache(storeKey);
        const cachedPixelSettings = getFromCache(pixelKey);
        const cachedFormFields = getFromCache(formKey);

        // Apply cache immediately for snappy paint.
        if (cachedStoreSettings) {
          setStoreSettings(cachedStoreSettings);
          loadedCurrency = cachedStoreSettings.currency_code;
        }
        if (cachedFormFields) {
          setFormFields(cachedFormFields);
          const initialFormData: Record<string, string> = {};
          (cachedFormFields as FormField[]).forEach((field) => {
            initialFormData[field.field_key] = "";
          });
          setFormData((prev) => ({ ...initialFormData, ...prev }));
        }

        // Stale-while-revalidate: ALWAYS fetch fresh so admin edits show up.
        const pixelQ = supabase.from("pixel_settings").select("facebook_pixel_id, facebook_enabled, tiktok_pixel_id, tiktok_enabled, google_analytics_id, google_enabled, snapchat_pixel_id, snapchat_enabled");
        if (ownerForSettings) pixelQ.eq("owner_id", ownerForSettings);
        if (storeForSettings) pixelQ.eq("store_id", storeForSettings);
        const pixelPromise = pixelQ.limit(1).maybeSingle();

        const formQ = supabase.from("order_form_fields").select("id, field_key, label, placeholder, field_type, required").eq("enabled", true);
        if (ownerForSettings) formQ.eq("owner_id", ownerForSettings);
        if (storeForSettings) formQ.eq("store_id", storeForSettings);
        const formFieldsPromise = formQ.order("sort_order", { ascending: true });

        const storeQ = supabase.from("store_settings").select("currency_symbol, currency_code, button_text");
        if (ownerForSettings) storeQ.eq("owner_id", ownerForSettings);
        const storePromise = storeQ.limit(1).maybeSingle();

        const catalogPromise = supabase.from("form_field_catalog").select("field_key").eq("admin_enabled", true);

        Promise.all([pixelPromise, formFieldsPromise, storePromise, catalogPromise]).then(([pixelResult, formFieldsResult, storeSettingsResult, catalogResult]) => {
          if (formFieldsResult.data) {
            const allowed = new Set((catalogResult.data || []).map((c: any) => c.field_key));
            const filtered = (formFieldsResult.data as FormField[]).filter(f => allowed.size === 0 || allowed.has(f.field_key));
            setFormFields(filtered);
            setToCache(formKey, filtered);
            const initialFormData: Record<string, string> = {};
            filtered.forEach((field: FormField) => {
              initialFormData[field.field_key] = "";
            });
            setFormData((prev) => ({ ...initialFormData, ...prev }));
          }

          if (storeSettingsResult.data) {
            loadedCurrency = storeSettingsResult.data.currency_code;
            setStoreSettings({
              currency_symbol: storeSettingsResult.data.currency_symbol,
              currency_code: storeSettingsResult.data.currency_code,
              button_text: (storeSettingsResult.data as any).button_text || "اطلب الآن - الدفع عند الاستلام",
            });
            setToCache(storeKey, storeSettingsResult.data);
          }

          if (pixelResult.data) {
            setToCache(pixelKey, pixelResult.data);
          }

          // Track page view in background (non-blocking)
          if (loadedProduct) {
            const attr = getAttribution();
            supabase.from("analytics_events").insert({
              event_type: "page_view",
              product_slug: slug,
              owner_id: ownerForSettings || null,
              store_id: storeForSettings || null,
              ...attr,
            } as any).then(() => {});
          }

          // Initialize tracking pixels when browser is idle
          if (pixelResult.data) {
            const runPixels = () => initializePixels(pixelResult.data as PixelSettings, loadedProduct, loadedCurrency);
            if (typeof (window as any).requestIdleCallback === "function") {
              (window as any).requestIdleCallback(runPixels, { timeout: 2000 });
            } else {
              setTimeout(runPixels, 800);
            }
          }
        });
      } catch (error) {
        console.error("Error loading data:", error);
        setLoading(false);
      }
    };

    loadData();
    return () => ac.abort();
  }, [slug]);

  // Sanitize description in background, after main render
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
      // Force lazy-loading + async decoding on every embedded image/iframe
      html = html
        .replace(/<img\b(?![^>]*\bloading=)/gi, '<img loading="lazy" decoding="async"')
        .replace(/<iframe\b(?![^>]*\bloading=)/gi, '<iframe loading="lazy"');
      // Neutralize pasted HTML from other sites that uses fixed widths,
      // floats, absolute positioning, or huge margins that overflow mobile.
      html = html
        // Drop hard-coded width/height attributes on media + tables
        .replace(/\s(width|height)="[^"]*"/gi, "")
        // Strip problematic CSS declarations from inline styles
        .replace(/style="([^"]*)"/gi, (_m, s) => {
          const cleaned = s
            .replace(/(?:^|;)\s*(width|min-width|max-width|height|min-height|max-height|position|top|left|right|bottom|float|margin[^:]*|padding[^:]*|transform)\s*:[^;]*/gi, "")
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
    return () => { cancelled = true; };
  }, [product?.description]);

  // Track checkout start when user starts filling the form
  const [checkoutTracked, setCheckoutTracked] = useState(false);

  const handleInputChange = (fieldKey: string, value: string) => {
    let cleanedValue = value;
    // Phone field: strip everything except digits and optional leading +
    const isPhoneField = formFields.find(f => f.field_key === fieldKey)?.field_type === "phone";
    if (isPhoneField) {
      cleanedValue = value.replace(/[^0-9+]/g, "");
      if (cleanedValue.startsWith("+")) {
        cleanedValue = "+" + cleanedValue.slice(1).replace(/[^0-9]/g, "");
      } else {
        cleanedValue = cleanedValue.replace(/[^0-9]/g, "");
      }
    }
    setFormData({ ...formData, [fieldKey]: cleanedValue });

    // Track checkout start on first input
    if (!checkoutTracked && value.length > 0) {
      setCheckoutTracked(true);
      
      // Track InitiateCheckout across all enabled pixels
      if (product) {
        const value = parseFloat(product.price);
        const currency = toISOCurrency(storeSettings.currency_code, storeSettings.currency_symbol);
        if (window.fbq) {
          window.fbq('track', 'InitiateCheckout', {
            content_name: product.name,
            content_ids: [product.id],
            content_type: 'product',
            value,
            currency,
            num_items: 1,
          });
        }
        if (window.ttq && typeof window.ttq.track === 'function') {
          window.ttq.track('InitiateCheckout', {
            value,
            currency,
            contents: [{ content_id: product.id, content_name: product.name, quantity: 1 }],
          });
        }
        if (window.gtag) {
          window.gtag('event', 'begin_checkout', {
            value,
            currency,
            items: [{ item_id: product.id, item_name: product.name, quantity: 1 }],
          });
        }
        if (window.snaptr) {
          window.snaptr('track', 'START_CHECKOUT', {
            price: value,
            currency,
            item_ids: [product.id],
          });
        }
      }
      
      // Fire-and-forget so input stays buttery smooth
      const attr = getAttribution();
      supabase.from("analytics_events").insert({
        event_type: "checkout_start",
        product_slug: slug,
          owner_id: ownerId || null,
          store_id: storeId || null,
        ...attr,
      } as any).then(({ error }) => {
        if (error) console.error("Error tracking checkout start:", error);
      });
    }
  };

  const initializePixels = (settings: PixelSettings, productData: Product | null, currencyCode: string) => {
    // Facebook Pixel
    if (settings.facebook_enabled && settings.facebook_pixel_id) {
      initFacebookPixel(settings.facebook_pixel_id, productData, currencyCode);
    }

    // TikTok Pixel
    if (settings.tiktok_enabled && settings.tiktok_pixel_id) {
      initTikTokPixel(settings.tiktok_pixel_id);
    }

    // Google Analytics
    if (settings.google_enabled && settings.google_analytics_id) {
      initGoogleAnalytics(settings.google_analytics_id);
    }

    // Snapchat Pixel
    if (settings.snapchat_enabled && settings.snapchat_pixel_id) {
      initSnapchatPixel(settings.snapchat_pixel_id);
    }
  };

  const initFacebookPixel = (pixelId: string, productData?: Product | null, currencyCode?: string) => {
    // Check if already initialized to prevent duplicate activation
    if (window.fbq && window.fbq.loaded) {
      return;
    }

    // Check if script already exists
    if (document.querySelector('script[src*="fbevents.js"]')) {
      return;
    }

    (function(f: any, b: Document, e: string, v: string, n?: any, t?: any, s?: any) {
      if (f.fbq) return;
      n = f.fbq = function() {
        n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
      };
      if (!f._fbq) f._fbq = n;
      n.push = n;
      n.loaded = !0;
      n.version = '2.0';
      n.queue = [];
      t = b.createElement(e) as HTMLScriptElement;
      t.async = !0;
      t.src = v;
      s = b.getElementsByTagName(e)[0];
      s.parentNode?.insertBefore(t, s);
    })(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');

    window.fbq('init', pixelId);
    window.fbq('track', 'PageView');
    
    // Track ViewContent event for product page
    if (productData) {
      window.fbq('track', 'ViewContent', {
        content_name: productData.name,
        content_ids: [productData.id],
        content_type: 'product',
        value: parseFloat(productData.price),
        currency: currencyCode || 'AED',
      });
    }
  };

  const initTikTokPixel = (pixelId: string) => {
    // Check if already initialized
    if (window.ttq && window.ttq._i) {
      return;
    }

    // Check if script already exists
    if (document.querySelector('script[src*="tiktok.com"]')) {
      return;
    }

    (function(w: any, d: Document, t: string) {
      w.TiktokAnalyticsObject = t;
      var ttq = w[t] = w[t] || [];
      ttq.methods = ["page", "track", "identify", "instances", "debug", "on", "off", "once", "ready", "alias", "group", "enableCookie", "disableCookie"];
      ttq.setAndDefer = function(t: any, e: any) {
        t[e] = function() {
          t.push([e].concat(Array.prototype.slice.call(arguments, 0)));
        };
      };
      for (var i = 0; i < ttq.methods.length; i++) ttq.setAndDefer(ttq, ttq.methods[i]);
      ttq.instance = function(t: any) {
        var e = ttq._i[t] || [];
        for (var n = 0; n < ttq.methods.length; n++) ttq.setAndDefer(e, ttq.methods[n]);
        return e;
      };
      ttq.load = function(e: any, n: any) {
        var i = "https://analytics.tiktok.com/i18n/pixel/events.js";
        ttq._i = ttq._i || {};
        ttq._i[e] = [];
        ttq._i[e]._u = i;
        ttq._t = ttq._t || {};
        ttq._t[e] = +new Date();
        ttq._o = ttq._o || {};
        ttq._o[e] = n || {};
        var o = d.createElement("script") as HTMLScriptElement;
        o.type = "text/javascript";
        o.async = true;
        o.src = i + "?sdkid=" + e + "&lib=" + t;
        var a = d.getElementsByTagName("script")[0];
        a.parentNode?.insertBefore(o, a);
      };
      ttq.load(pixelId);
      ttq.page();
    })(window, document, 'ttq');
  };

  const initGoogleAnalytics = (measurementId: string) => {
    // Check if already initialized
    if (document.querySelector(`script[src*="googletagmanager.com/gtag/js?id=${measurementId}"]`)) {
      return;
    }

    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
    document.head.appendChild(script);

    window.dataLayer = window.dataLayer || [];
    window.gtag = function() {
      window.dataLayer.push(arguments);
    };
    window.gtag('js', new Date());
    window.gtag('config', measurementId);
  };

  const initSnapchatPixel = (pixelId: string) => {
    // Check if already initialized
    if (window.snaptr && window.snaptr.loaded) {
      return;
    }

    // Check if script already exists
    if (document.querySelector('script[src*="scevent.min.js"]')) {
      return;
    }

    (function(e: any, t: Document, n: string) {
      if (e.snaptr) return;
      var a: any = e.snaptr = function() {
        a.handleRequest ? a.handleRequest.apply(a, arguments) : a.queue.push(arguments);
      };
      a.queue = [];
      a.loaded = true;
      var s = 'script';
      var r = t.createElement(s) as HTMLScriptElement;
      r.async = true;
      r.src = n;
      var u = t.getElementsByTagName(s)[0];
      u.parentNode?.insertBefore(r, u);
    })(window, document, 'https://sc-static.net/scevent.min.js');

    window.snaptr('init', pixelId, {});
    window.snaptr('track', 'PAGE_VIEW');
  };

  const trackPurchaseEvent = () => {
    const currencyCode = toISOCurrency(storeSettings.currency_code, storeSettings.currency_symbol);
    const productValue = parseFloat(product?.price || "0") * quantity;
    const eventID = `purchase_${product?.id || 'p'}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    // Persist for thank-you page fallback dedup
    try {
      sessionStorage.setItem('last_purchase_event', JSON.stringify({
        eventID,
        value: productValue,
        currency: currencyCode,
        content_name: product?.name,
        content_ids: [product?.id || 'unknown'],
        num_items: quantity,
        ts: Date.now(),
      }));
    } catch {}
    
    // Facebook Purchase Event with full parameters
    if (window.fbq) {
      window.fbq('track', 'Purchase', {
        value: productValue,
        currency: currencyCode,
        content_name: product?.name,
        content_ids: [product?.id || 'unknown'],
        content_type: 'product',
        num_items: quantity,
      }, { eventID });
      console.log('Facebook Purchase event tracked:', {
        value: productValue,
        currency: currencyCode,
        content_name: product?.name,
        content_ids: [product?.id],
        eventID,
      });
    }

    // TikTok Purchase Event
    if (window.ttq) {
      window.ttq.track('PlaceAnOrder', {
        value: productValue,
        currency: currencyCode,
        contents: [{ content_name: product?.name, quantity: quantity }],
      });
    }

    // Google Analytics Purchase Event
    if (window.gtag) {
      window.gtag('event', 'purchase', {
        value: productValue,
        currency: currencyCode,
        items: [{ name: product?.name, quantity: quantity }],
      });
    }

    // Snapchat Purchase Event
    if (window.snaptr) {
      window.snaptr('track', 'PURCHASE', {
        price: productValue,
        currency: currencyCode,
        item_ids: [product?.id],
      });
    }
  };

  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();

    // Bot protection: honeypot field — real users never fill this.
    // Silently pretend success to avoid telling the bot it was caught.
    if (honeypot.trim() !== "") {
      navigate("/thank-you", { state: { orderData: { productName: product?.name } } });
      return;
    }

    // Bot protection: reject form submitted in less than 3 seconds.
    const elapsedMs = Date.now() - formLoadedAtRef.current;
    if (elapsedMs < 3000) {
      toast({
        title: "خطأ",
        description: "يرجى مراجعة بياناتك قبل الإرسال",
        variant: "destructive",
      });
      return;
    }

    // Check required fields
    const requiredFields = formFields.filter(f => f.required);
    const missingFields = requiredFields.filter(f => !formData[f.field_key]);
    
    if (missingFields.length > 0) {
      toast({
        title: "خطأ",
        description: "يرجى ملء جميع الحقول المطلوبة",
        variant: "destructive",
      });
      return;
    }

    // Validate phone number: 9-10 digits only
    const phoneField = formFields.find(f => f.field_type === "phone");
    if (phoneField) {
      const phoneValue = formData[phoneField.field_key] || "";
      const digitsOnly = phoneValue.replace(/\D/g, "");
      if (digitsOnly.length < 9 || digitsOnly.length > 10) {
        toast({
          title: "خطأ",
          description: "رقم الهاتف يجب أن يكون بين 9 و 10 أرقام",
          variant: "destructive",
        });
        return;
      }
    }

    // Validate per-piece variants: if product has variants, each piece must have its selections
    const hasColors = !!(product?.colors && product.colors.length > 0);
    const hasSizes = !!(product?.sizes && product.sizes.length > 0);
    if (hasColors || hasSizes) {
      for (let i = 0; i < itemVariants.length; i++) {
        const v = itemVariants[i];
        if ((hasColors && !v.color) || (hasSizes && !v.size)) {
          toast({
            title: "خطأ",
            description: `يرجى اختيار ${[hasColors && "اللون", hasSizes && "المقاس"].filter(Boolean).join(" و ")} للقطعة ${i + 1}`,
            variant: "destructive",
          });
          return;
        }
      }
    }

    setIsSubmitting(true);

    try {
      // SKU is hidden from landing page; auto-use the first code if any exist
      const singleCode = product?.product_codes && product.product_codes.length > 0
        ? product.product_codes[0]
        : null;
      // Keep per-piece alignment: do NOT filter, so colors/sizes/codes pair by index
      const colorsArray = itemVariants.map(v => v.color || "");
      const sizesArray = itemVariants.map(v => v.size || "");
      const codesArray = itemVariants.map(v => v.productCode || singleCode || "");
      // Build items array for proper order_items rows on the server.
      // Group consecutive pieces that share the same variant (color/size/code)
      // into a single line with quantity = N instead of N separate rows.
      const itemsPayload: Array<{
        color: string | null;
        size: string | null;
        product_code: string | null;
        quantity: number;
      }> = [];
      for (const v of itemVariants) {
        const color = v.color || null;
        const size = v.size || null;
        const product_code = (v.productCode || singleCode) || null;
        const last = itemsPayload[itemsPayload.length - 1];
        if (
          last &&
          last.color === color &&
          last.size === size &&
          last.product_code === product_code
        ) {
          last.quantity += 1;
        } else {
          itemsPayload.push({ color, size, product_code, quantity: 1 });
        }
      }

      // Map dynamic field_keys (e.g. custom_123) → standard fields by label/key keywords.
      const findField = (...keywords: string[]) => {
        const f = formFields.find((fld) => {
          const hay = `${fld.label || ""} ${fld.field_key || ""}`.toLowerCase();
          return keywords.some((k) => hay.includes(k.toLowerCase()));
        });
        return f ? (formData[f.field_key] || "") : "";
      };
      const customer_name =
        formData.name || findField("name", "اسم");
      const phone =
        formData.phone || findField("phone", "tel", "هاتف", "رقم", "جوال", "موبايل");
      const city =
        formData.city ||
        findField("city", "مدينة", "محافظة", "محافضة", "ولاية", "منطقة");
      const address =
        formData.address ||
        findField("address", "منطقة", "عنوان", "حي", "شارع");

      // Price is recomputed server-side to prevent client-side tampering
      const { error } = await supabase.functions.invoke("create-order", {
        body: {
          customer_name,
          phone,
          address,
          city,
          product_id: product?.id,
          quantity: quantity,
          selected_color: colorsArray.filter(Boolean).join(", ") || null,
          selected_size: sizesArray.filter(Boolean).join(", ") || null,
          selected_product_code: codesArray.filter(Boolean).join(", ") || null,
          items: itemsPayload,
          upsell_index: selectedUpsellIndex,
          landing_slug: slug,
          elapsed_ms: elapsedMs,
          hp: honeypot,
          ...getAttribution(),
        },
      });

      if (error) throw error;

      // Track purchase event
      trackPurchaseEvent();

      // Navigate to thank you page with order data
      navigate("/thank-you", {
        state: {
          orderData: {
            productName: product?.name,
            price: product?.price,
            currencySymbol: storeSettings.currency_symbol,
            currencyCode: toISOCurrency(storeSettings.currency_code, storeSettings.currency_symbol),
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
    } catch (error) {
      console.error("Error submitting order:", error);
      toast({
        title: "خطأ",
        description: "حدث خطأ أثناء إرسال الطلب، يرجى المحاولة مرة أخرى",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getFieldIcon = (fieldType: string) => {
    switch (fieldType) {
      case "phone":
        return <Phone className="w-4 h-4" />;
      case "email":
        return <Mail className="w-4 h-4" />;
      default:
        return <User className="w-4 h-4" />;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen w-full bg-background font-cairo overflow-x-hidden" dir="rtl">
        <header className="bg-card border-b border-border py-3 px-4 text-center w-full">
          <Skeleton className="h-6 w-32 mx-auto" />
        </header>
        <section className="bg-gradient-to-l from-primary to-accent py-8 sm:py-12 px-4 text-center w-full">
          <Skeleton className="h-8 w-64 mx-auto mb-3 bg-white/20" />
          <Skeleton className="h-4 w-40 mx-auto bg-white/20" />
        </section>
        <main className="w-full max-w-6xl mx-auto px-4 py-6 sm:py-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
            <Skeleton className="aspect-square rounded-xl sm:rounded-2xl" />
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
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground mb-2">المنتج غير موجود</h1>
          <p className="text-muted-foreground mb-4">الرابط الذي تبحث عنه غير صحيح</p>
          <p className="text-sm text-muted-foreground">الرابط المطلوب: {slug}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-background font-cairo overflow-x-hidden pb-[calc(6rem+env(safe-area-inset-bottom))]" dir="rtl">
      {/* Header */}
      <StoreHeader ownerId={product?.owner_id} />

      {/* Hero Section */}
      <section className="bg-gradient-to-l from-primary to-accent py-5 sm:py-12 px-3 sm:px-4 text-center text-white w-full">
        <h1 className="text-lg sm:text-2xl md:text-4xl font-bold mb-1.5 sm:mb-3 leading-snug">{product.name}</h1>
        <div className="flex items-center justify-center gap-2 text-xs sm:text-base">
          <ShoppingBag className="w-4 h-4 sm:w-5 sm:h-5" />
          <span>الدفع عند الاستلام</span>
        </div>
      </section>

      <main className="w-full max-w-6xl mx-auto px-3 sm:px-4 py-4 sm:py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-8">
          {/* Product Gallery */}
          <div className={product.order_form_on_top ? "order-2 lg:order-1" : ""}>
            <div className="aspect-[4/5] sm:aspect-square rounded-xl sm:rounded-2xl overflow-hidden bg-muted shadow-lg mb-2.5 sm:mb-4 gpu">
              {product.images && product.images.length > 0 ? (
                <button
                  type="button"
                  onClick={() => setLightboxOpen(true)}
                  className="relative w-full h-full group cursor-zoom-in"
                  aria-label="تكبير الصورة"
                >
                  <img
                    src={product.images[selectedImage]}
                    alt={product.name}
                    className="w-full h-full object-contain"
                    loading="eager"
                    decoding="async"
                    width={800}
                    height={800}
                    {...({ fetchpriority: "high" } as any)}
                  />
                  <div className="absolute top-2 left-2 bg-black/50 text-white p-1.5 rounded-full opacity-70 group-hover:opacity-100 transition-opacity">
                    <ZoomIn className="w-4 h-4" />
                  </div>
                </button>
              ) : (
                <Skeleton className="w-full h-full" />
              )}
            </div>
            {product.images && product.images.length > 1 && (
              <div className="flex gap-2 sm:gap-3 justify-center flex-wrap">
                {product.images.map((image, index) => (
                  <button
                    key={index}
                    onClick={() => setSelectedImage(index)}
                    className={`w-16 h-16 sm:w-20 sm:h-20 rounded-lg sm:rounded-xl overflow-hidden border-2 transition-all ${
                      selectedImage === index
                        ? "border-primary ring-2 ring-primary/30"
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    <img src={image} alt="" className="w-full h-full object-cover" loading="lazy" decoding="async" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Order Form */}
          <div className={`lg:sticky lg:top-8 h-fit ${product.order_form_on_top ? "order-1 lg:order-2" : ""}`}>
            <div className="bg-card rounded-xl sm:rounded-2xl p-3 sm:p-6 shadow-lg border border-border">
              <div className="text-center mb-4 sm:mb-6">
                <div className="mb-2 flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
                  {product.original_price && Number(product.original_price) > Number(product.price) && (
                    <span className="text-muted-foreground line-through text-base sm:text-xl">
                      {product.original_price} {storeSettings.currency_symbol}
                    </span>
                  )}
                  <span className="text-2xl sm:text-4xl font-bold text-primary">{product.price} {storeSettings.currency_symbol}</span>
                </div>
                <div className="inline-flex items-center gap-2 bg-accent/10 text-accent px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-sm sm:text-base">
                  <Check className="w-3 h-3 sm:w-4 sm:h-4" />
                  <span className="font-medium">متوفر في المخزون</span>
                </div>
                {/* عداد المخزون الديناميكي */}
                {typeof product.stock === "number" && product.stock > 0 && product.stock <= 20 && (
                  <div className="mt-2 inline-flex items-center gap-1.5 bg-red-500/10 text-red-600 px-3 py-1 rounded-full text-xs sm:text-sm font-bold animate-pulse">
                    🔥 باقي {product.stock} قطعة فقط!
                  </div>
                )}
                {/* زر جدول المقاسات */}
                {product.size_chart_url && product.sizes && product.sizes.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowSizeChart(true)}
                    className="mt-2 inline-flex items-center gap-1.5 text-primary text-xs sm:text-sm font-medium hover:underline"
                  >
                    <Ruler className="w-4 h-4" /> جدول المقاسات
                  </button>
                )}
                {/* شريط الثقة */}
                <div className="mt-3 grid grid-cols-3 gap-1.5 sm:gap-2 text-[10px] sm:text-xs">
                  <div className="flex flex-col items-center gap-1 p-1.5 sm:p-2 rounded-lg bg-muted/50 border border-border">
                    <span className="text-base sm:text-lg">💵</span>
                    <span className="font-medium text-center leading-tight">الدفع عند الاستلام</span>
                  </div>
                  <div className="flex flex-col items-center gap-1 p-1.5 sm:p-2 rounded-lg bg-muted/50 border border-border">
                    <span className="text-base sm:text-lg">🚚</span>
                    <span className="font-medium text-center leading-tight">شحن لكل ليبيا</span>
                  </div>
                  <div className="flex flex-col items-center gap-1 p-1.5 sm:p-2 rounded-lg bg-muted/50 border border-border">
                    <span className="text-base sm:text-lg">🔄</span>
                    <span className="font-medium text-center leading-tight">استبدال مجاني</span>
                  </div>
                </div>
              </div>

              <form id="order-form" onSubmit={handleSubmitOrder} className="space-y-3 sm:space-y-4">
                {/* Honeypot field — invisible to real users, bots will fill it */}
                <div
                  aria-hidden="true"
                  style={{
                    position: "absolute",
                    left: "-9999px",
                    width: "1px",
                    height: "1px",
                    overflow: "hidden",
                  }}
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
                {/* Quantity Selection - First */}
                {product.show_quantity !== false && (
                  <div className="space-y-1.5 sm:space-y-2">
                    <Label className="text-sm sm:text-base">عدد القطع</Label>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          // If an upsell offer is active, the counter starts
                          // operating on the base price — reset to 1 piece so
                          // the displayed total doesn't jump (offer.quantity-1).
                          const base = selectedUpsellIndex !== null ? 1 : quantity;
                          const newQty = Math.max(1, base - 1);
                          setQuantity(newQty);
                          setItemVariants(prev => {
                            const next = [...prev];
                            while (next.length < newQty) next.push({ color: "", size: "", productCode: "" });
                            return next.slice(0, newQty);
                          });
                          // Auto-apply matching upsell offer if the new quantity
                          // matches one of the configured offer quantities, so
                          // the customer always gets the discount price.
                          const matchIdx = product.upsell_enabled && Array.isArray(product.upsell_offers)
                            ? product.upsell_offers.findIndex((o) => Number(o.quantity) === newQty)
                            : -1;
                          setSelectedUpsellIndex(matchIdx >= 0 ? matchIdx : null);
                        }}
                        className="w-11 h-11 rounded-lg border-2 border-border hover:border-primary/50 flex items-center justify-center text-xl font-bold transition-all active:scale-95"
                      >
                        -
                      </button>
                      <span className="text-xl font-bold min-w-[44px] text-center">{quantity}</span>
                      <button
                        type="button"
                        onClick={() => {
                          const base = selectedUpsellIndex !== null ? 1 : quantity;
                          const newQty = base + 1;
                          setQuantity(newQty);
                          setItemVariants(prev => {
                            const next = selectedUpsellIndex !== null ? [{ color: "", size: "", productCode: "" }] : [...prev];
                            while (next.length < newQty) next.push({ color: "", size: "", productCode: "" });
                            return next.slice(0, newQty);
                          });
                          const matchIdx = product.upsell_enabled && Array.isArray(product.upsell_offers)
                            ? product.upsell_offers.findIndex((o) => Number(o.quantity) === newQty)
                            : -1;
                          setSelectedUpsellIndex(matchIdx >= 0 ? matchIdx : null);
                        }}
                        className="w-11 h-11 rounded-lg border-2 border-border hover:border-primary/50 flex items-center justify-center text-xl font-bold transition-all active:scale-95"
                      >
                        +
                      </button>
                    </div>
                    {(quantity > 1 || selectedUpsellIndex !== null) && (
                      <p className="text-sm text-muted-foreground">
                        الإجمالي:{" "}
                        {selectedUpsellIndex !== null && product.upsell_offers?.[selectedUpsellIndex]
                          ? product.upsell_offers[selectedUpsellIndex].price.toFixed(2)
                          : (parseFloat(product.price) * quantity).toFixed(2)}{" "}
                        {storeSettings.currency_symbol}
                      </p>
                    )}
                  </div>
                )}

                {/* Upsell Offers */}
                {product.upsell_enabled && product.upsell_offers && product.upsell_offers.length > 0 && (
                  <div className="space-y-2 p-3 sm:p-4 rounded-xl border-2 border-primary/30 bg-primary/5">
                    <Label className="text-sm sm:text-base font-bold text-primary">{product.upsell_title || "🎁 عروض خاصة"}</Label>
                    <div className="space-y-2">
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
                                  while (next.length < offer.quantity) next.push({ color: "", size: "", productCode: "" });
                                  return next.slice(0, offer.quantity);
                                });
                              }
                            }}
                            className={`w-full text-right p-3 rounded-lg border-2 transition-all flex items-center justify-between gap-3 ${
                              selected
                                ? "border-primary bg-primary text-primary-foreground"
                                : "border-border bg-background hover:border-primary/50"
                            }`}
                          >
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 border-2 ${selected ? "bg-primary-foreground border-primary-foreground text-primary" : "border-border bg-background text-transparent"}`}>
                              <Check className="w-4 h-4" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="font-bold text-sm sm:text-base">
                                {offer.label || `اشترِ ${offer.quantity} قطع`}
                              </div>
                              <div className={`text-xs ${selected ? "opacity-90" : "text-muted-foreground"}`}>
                                {offer.quantity} قطعة
                              </div>
                            </div>
                            <div className={`text-lg sm:text-xl font-bold whitespace-nowrap ${selected ? "" : "text-primary"}`}>
                              {offer.price} {storeSettings.currency_symbol}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Product Variants Selection for each item */}
                {itemVariants.map((item, index) => {
                   const hasVariants = (product.colors && product.colors.length > 0) || 
                                      (product.sizes && product.sizes.length > 0);
                  
                  if (!hasVariants) return null;
                  
                  return (
                    <div key={index} className="p-3 sm:p-4 bg-muted/50 rounded-lg space-y-3">
                      {quantity > 1 && (
                        <div className="text-sm font-medium text-primary">القطعة {index + 1}</div>
                      )}
                      
                      {product.colors && product.colors.length > 0 && (
                        <div className="space-y-1.5 sm:space-y-2">
                          <Label className="text-sm sm:text-base">اختر اللون</Label>
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
                                className={`px-4 py-2.5 min-h-[44px] rounded-lg border-2 transition-all text-sm ${
                                  item.color === color
                                    ? "border-primary bg-primary/10 text-primary font-medium"
                                    : "border-border hover:border-primary/50"
                                }`}
                              >
                                {color}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {product.sizes && product.sizes.length > 0 && (
                        <div className="space-y-1.5 sm:space-y-2">
                          <Label className="text-sm sm:text-base">اختر المقاس</Label>
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
                                className={`px-4 py-2.5 min-h-[44px] rounded-lg border-2 transition-all text-sm ${
                                  item.size === size
                                    ? "border-primary bg-primary/10 text-primary font-medium"
                                    : "border-border hover:border-primary/50"
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

                {formFields.map((field) => (
                  <div key={field.id} className="space-y-1.5 sm:space-y-2">
                    <Label className="flex items-center gap-2 text-sm sm:text-base">
                      {getFieldIcon(field.field_type)}
                      {field.label} {field.required && "*"}
                    </Label>
                    {field.field_type === "textarea" ? (
                      <Textarea
                        value={formData[field.field_key] || ""}
                        onChange={(e) => handleInputChange(field.field_key, e.target.value)}
                        placeholder={field.placeholder}
                        rows={3}
                        required={field.required}
                        className="text-base"
                      />
                    ) : (
                      <Input
                        value={formData[field.field_key] || ""}
                        onChange={(e) => handleInputChange(field.field_key, e.target.value)}
                        placeholder={field.placeholder}
                        type={field.field_type === "phone" ? "tel" : field.field_type === "email" ? "email" : "text"}
                        dir={field.field_type === "phone" || field.field_type === "email" ? "ltr" : "rtl"}
                        required={field.required}
                        className="text-base h-11 sm:h-10"
                        autoComplete="off"
                      />
                    )}
                  </div>
                ))}

                <Button
                  type="submit"
                  className="w-full bg-gradient-to-l from-primary to-accent hover:opacity-90 text-white text-base sm:text-lg py-5 sm:py-6 rounded-xl font-bold"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "جاري إرسال الطلب..." : (storeSettings.button_text || "اطلب الآن - الدفع عند الاستلام")}
                </Button>

                <p className="text-center text-muted-foreground text-xs sm:text-sm">
                  🚚 شحن سريع خلال 2-5 أيام عمل
                </p>
              </form>
            </div>
          </div>
        </div>

        {/* Description */}
        {product.description && sanitizedDescription && (
          <section className="mt-8 sm:mt-12 cv-auto overflow-hidden">
            <h2 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6 text-foreground">وصف المنتج</h2>
            <div
              className="prose prose-sm sm:prose-lg max-w-none text-foreground break-words [&_*]:max-w-full [&_img]:!w-full [&_img]:!h-auto [&_img]:rounded-xl [&_img]:my-4 [&_img]:object-contain [&_iframe]:!w-full [&_iframe]:aspect-video [&_video]:!w-full [&_video]:!h-auto [&_table]:!w-full [&_table]:!block [&_thead]:!block [&_tbody]:!block [&_tr]:!flex [&_tr]:!flex-wrap [&_tr]:!items-center [&_tr]:!justify-center [&_tr]:!gap-2 [&_td]:!block [&_td]:!w-auto [&_td]:!p-0 [&_th]:!block [&_*]:!float-none [&_*]:!static"
              dangerouslySetInnerHTML={{ __html: sanitizedDescription }}
            />
          </section>
        )}

        {/* Reviews */}
        {product.reviews && product.reviews.length > 0 && (
          <section className="mt-8 sm:mt-12">
            <h2 className="text-xl sm:text-2xl font-bold mb-4 text-foreground flex items-center gap-2">
              <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" /> آراء عملائنا
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {product.reviews.map((rv, i) => (
                <div key={i} className="p-4 rounded-xl border border-border bg-card shadow-sm">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-sm">{rv.name}</span>
                    <span className="text-yellow-500 text-sm">{"⭐".repeat(Math.max(1, Math.min(5, rv.rating || 5)))}</span>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">{rv.comment}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* FAQ */}
        {product.faqs && product.faqs.length > 0 && (
          <section className="mt-8 sm:mt-12">
            <h2 className="text-xl sm:text-2xl font-bold mb-4 text-foreground">الأسئلة الشائعة</h2>
            <div className="space-y-2">
              {product.faqs.map((faq, i) => (
                <div key={i} className="border border-border rounded-xl overflow-hidden bg-card">
                  <button
                    type="button"
                    onClick={() => setOpenFaq(openFaq === i ? null : i)}
                    className="w-full flex items-center justify-between gap-3 p-4 text-right hover:bg-muted/40 transition-colors"
                  >
                    <span className="font-semibold text-sm sm:text-base flex-1">{faq.question}</span>
                    <ChevronDown className={`w-5 h-5 shrink-0 transition-transform ${openFaq === i ? "rotate-180" : ""}`} />
                  </button>
                  {openFaq === i && (
                    <div className="px-4 pb-4 text-sm text-muted-foreground leading-relaxed border-t">
                      <p className="pt-3 whitespace-pre-wrap">{faq.answer}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}
      </main>

      {/* Lightbox */}
      {lightboxOpen && product.images && product.images.length > 0 && (
        <div
          className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4"
          onClick={() => setLightboxOpen(false)}
        >
          <button
            type="button"
            className="absolute top-4 left-4 bg-white/10 hover:bg-white/20 text-white p-2 rounded-full"
            onClick={() => setLightboxOpen(false)}
            aria-label="إغلاق"
          >
            <X className="w-6 h-6" />
          </button>
          <img
            src={product.images[selectedImage]}
            alt={product.name}
            className="max-w-full max-h-full object-contain cursor-zoom-out"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {/* Size Chart Modal */}
      {showSizeChart && product.size_chart_url && (
        <div
          className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4"
          onClick={() => setShowSizeChart(false)}
        >
          <button
            type="button"
            className="absolute top-4 left-4 bg-white/10 hover:bg-white/20 text-white p-2 rounded-full"
            onClick={() => setShowSizeChart(false)}
            aria-label="إغلاق"
          >
            <X className="w-6 h-6" />
          </button>
          <img
            src={product.size_chart_url}
            alt="جدول المقاسات"
            className="max-w-full max-h-full object-contain bg-white rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {/* Sticky CTA (mobile + desktop) */}
      <div className="fixed bottom-0 inset-x-0 z-40 bg-card/95 backdrop-blur border-t border-border p-3 shadow-[0_-4px_16px_rgba(0,0,0,0.08)]">
        <div className="flex items-center gap-3 max-w-md mx-auto">
          <div className="flex flex-col">
            <span className="text-lg font-bold text-primary leading-tight">
              {product.price} {storeSettings.currency_symbol}
            </span>
            {product.original_price && Number(product.original_price) > Number(product.price) && (
              <span className="text-xs text-muted-foreground line-through leading-tight">
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
            className="flex-1 bg-gradient-to-l from-primary to-accent hover:opacity-90 text-white font-bold py-5 rounded-xl"
          >
            اضغط هنا للشراء
          </Button>
        </div>
      </div>
    </div>
  );
};

export default LandingPage;
