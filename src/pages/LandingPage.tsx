import { useState, useEffect, useMemo, useCallback } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Check, ShoppingBag, Phone, MapPin, User, Mail } from "lucide-react";
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
  upsell_offers?: Array<{ quantity: number; price: number; label: string }>;
  owner_id?: string;
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
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formFields, setFormFields] = useState<FormField[]>([]);
  const [storeSettings, setStoreSettings] = useState<StoreSettings>({ currency_symbol: "د.إ", currency_code: "AED" });
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [selectedProductCode, setSelectedProductCode] = useState<string>("");
  const [quantity, setQuantity] = useState<number>(1);
  const [selectedUpsellIndex, setSelectedUpsellIndex] = useState<number | null>(null);
  const [sanitizedDescription, setSanitizedDescription] = useState<string>("");
  
  
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
        const productLightSelect = "id, name, slug, price, original_price, description, product_codes, colors, sizes, owner_id, upsell_enabled, upsell_offers, is_visible";

        // أولاً: ابحث عن صفحة هبوط بهذا الـ slug، فإن وُجدت نأخذ المنتج المرتبط ونطبّق إعدادات الصفحة
        const landingPromise = supabase
          .from("landing_pages")
          .select("id, product_id, slug, title, subtitle, description, images, price, original_price, upsell_enabled, upsell_offers, is_visible")
          .eq("slug", slug)
          .maybeSingle();

        const [profileRes, landingRes] = await Promise.all([profilePromise, landingPromise]);
        const landingPage: any = landingRes && (landingRes as any).data ? (landingRes as any).data : null;

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
        if (username) {
          const prof = (profileRes as any).data;
          if (!prof) { setLoading(false); return; }
          if (!prof.is_active) { setLoading(false); return; }
          resolvedOwnerId = prof.user_id;
          setOwnerId(prof.user_id);
        }

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
            upsell_enabled: lpHasUpsell != null ? !!lpHasUpsell : !!matched.upsell_enabled,
            upsell_offers: Array.isArray(lp?.upsell_offers) && lp.upsell_offers.length
              ? lp.upsell_offers
              : (Array.isArray(matched.upsell_offers) ? matched.upsell_offers : []),
            // عنوان مخصص لصفحة الهبوط (إن وُجد)
            ...(lp?.title ? { name: lp.title } : {}),
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
        const productResult = { data: matched } as any;

        // Owner-scoped cache keys so different stores don't pollute each other's
        // form fields, store currency, or pixel settings.
        const ownerSuffix = ownerForSettings || "_";
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
        const pixelPromise = ownerForSettings
          ? supabase.from("pixel_settings").select("facebook_pixel_id, facebook_enabled, tiktok_pixel_id, tiktok_enabled, google_analytics_id, google_enabled, snapchat_pixel_id, snapchat_enabled").eq("owner_id", ownerForSettings).limit(1).maybeSingle()
          : supabase.from("pixel_settings").select("facebook_pixel_id, facebook_enabled, tiktok_pixel_id, tiktok_enabled, google_analytics_id, google_enabled, snapchat_pixel_id, snapchat_enabled").limit(1).maybeSingle();
        const formFieldsPromise = ownerForSettings
          ? supabase.from("order_form_fields").select("id, field_key, label, placeholder, field_type, required").eq("enabled", true).eq("owner_id", ownerForSettings).order("sort_order", { ascending: true })
          : supabase.from("order_form_fields").select("id, field_key, label, placeholder, field_type, required").eq("enabled", true).order("sort_order", { ascending: true });
        const storePromise = ownerForSettings
          ? supabase.from("store_settings").select("currency_symbol, currency_code").eq("owner_id", ownerForSettings).limit(1).maybeSingle()
          : supabase.from("store_settings").select("currency_symbol, currency_code").limit(1).maybeSingle();

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
            });
            setToCache(storeKey, storeSettingsResult.data);
          }

          if (pixelResult.data) {
            setToCache(pixelKey, pixelResult.data);
          }

          // Track page view in background (non-blocking)
          if (loadedProduct) {
            const utmSource = getUtmSource();
            supabase.from("analytics_events").insert({
              event_type: "page_view",
              product_slug: slug,
              utm_source: utmSource,
            }).then(() => {});
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
    setFormData({ ...formData, [fieldKey]: value });

    // Track checkout start on first input
    if (!checkoutTracked && value.length > 0) {
      setCheckoutTracked(true);
      
      // Track InitiateCheckout for Facebook Pixel
      if (window.fbq && product) {
        window.fbq('track', 'InitiateCheckout', {
          content_name: product.name,
          content_ids: [product.id],
          content_type: 'product',
          value: parseFloat(product.price),
          currency: storeSettings.currency_code,
          num_items: 1,
        });
      }
      
      // Fire-and-forget so input stays buttery smooth
      const utmSource = getUtmSource();
      supabase.from("analytics_events").insert({
        event_type: "checkout_start",
        product_slug: slug,
        utm_source: utmSource,
      }).then(({ error }) => {
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
    const currencyCode = storeSettings.currency_code;
    const productValue = parseFloat(product?.price || "0") * quantity;
    
    // Facebook Purchase Event with full parameters
    if (window.fbq) {
      window.fbq('track', 'Purchase', {
        value: productValue,
        currency: currencyCode,
        content_name: product?.name,
        content_ids: [product?.id || 'unknown'],
        content_type: 'product',
        num_items: quantity,
      });
      console.log('Facebook Purchase event tracked:', {
        value: productValue,
        currency: currencyCode,
        content_name: product?.name,
        content_ids: [product?.id],
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

    setIsSubmitting(true);

    try {
      // Format variants for storage
      const colorsArray = itemVariants.map(v => v.color).filter(Boolean);
      const sizesArray = itemVariants.map(v => v.size).filter(Boolean);
      const codesArray = itemVariants.map(v => v.productCode).filter(Boolean);

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
          selected_color: colorsArray.join(", ") || null,
          selected_size: sizesArray.join(", ") || null,
          selected_product_code: codesArray.join(", ") || null,
          upsell_index: selectedUpsellIndex,
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
            customerName: customer_name,
            phone,
            city,
            address,
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
    <div className="min-h-screen w-full bg-background font-cairo overflow-x-hidden" dir="rtl">
      {/* Header */}
      <StoreHeader ownerId={product?.owner_id} />

      {/* Hero Section */}
      <section className="bg-gradient-to-l from-primary to-accent py-8 sm:py-12 px-4 text-center text-white w-full">
        <h1 className="text-xl sm:text-2xl md:text-4xl font-bold mb-2 sm:mb-3">{product.name}</h1>
        <div className="flex items-center justify-center gap-2 text-sm sm:text-base">
          <ShoppingBag className="w-4 h-4 sm:w-5 sm:h-5" />
          <span>الدفع عند الاستلام</span>
        </div>
      </section>

      <main className="w-full max-w-6xl mx-auto px-4 py-6 sm:py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
          {/* Product Gallery */}
          <div>
            <div className="aspect-square rounded-xl sm:rounded-2xl overflow-hidden bg-muted shadow-lg mb-3 sm:mb-4 gpu">
              {product.images && product.images.length > 0 ? (
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
          <div className="lg:sticky lg:top-8 h-fit">
            <div className="bg-card rounded-xl sm:rounded-2xl p-4 sm:p-6 shadow-lg border border-border">
              <div className="text-center mb-4 sm:mb-6">
                <div className="mb-2 flex flex-wrap items-center justify-center gap-2">
                  {product.original_price && (
                    <span className="text-muted-foreground line-through text-lg sm:text-xl">
                      {product.original_price} {storeSettings.currency_symbol}
                    </span>
                  )}
                  <span className="text-3xl sm:text-4xl font-bold text-primary">{product.price} {storeSettings.currency_symbol}</span>
                </div>
                <div className="inline-flex items-center gap-2 bg-accent/10 text-accent px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-sm sm:text-base">
                  <Check className="w-3 h-3 sm:w-4 sm:h-4" />
                  <span className="font-medium">متوفر في المخزون</span>
                </div>
              </div>

              <form onSubmit={handleSubmitOrder} className="space-y-3 sm:space-y-4">
                {/* Quantity Selection - First */}
                <div className="space-y-1.5 sm:space-y-2">
                  <Label className="text-sm sm:text-base">عدد القطع</Label>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        const newQty = Math.max(1, quantity - 1);
                        setQuantity(newQty);
                        setItemVariants(prev => prev.slice(0, newQty));
                        setSelectedUpsellIndex(null);
                      }}
                      className="w-10 h-10 rounded-lg border-2 border-border hover:border-primary/50 flex items-center justify-center text-xl font-bold transition-all"
                    >
                      -
                    </button>
                    <span className="text-xl font-bold min-w-[40px] text-center">{quantity}</span>
                    <button
                      type="button"
                      onClick={() => {
                        const newQty = quantity + 1;
                        setQuantity(newQty);
                        setItemVariants(prev => [...prev, { color: "", size: "", productCode: "" }]);
                        setSelectedUpsellIndex(null);
                      }}
                      className="w-10 h-10 rounded-lg border-2 border-border hover:border-primary/50 flex items-center justify-center text-xl font-bold transition-all"
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

                {/* Upsell Offers */}
                {product.upsell_enabled && product.upsell_offers && product.upsell_offers.length > 0 && (
                  <div className="space-y-2 p-3 sm:p-4 rounded-xl border-2 border-primary/30 bg-primary/5">
                    <Label className="text-sm sm:text-base font-bold text-primary">🎁 عروض خاصة</Label>
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
                                     (product.sizes && product.sizes.length > 0) || 
                                     (product.product_codes && product.product_codes.length > 0);
                  
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
                                className={`px-4 py-2 rounded-lg border-2 transition-all text-sm ${
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
                                className={`px-4 py-2 rounded-lg border-2 transition-all text-sm ${
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

                      {product.product_codes && product.product_codes.length > 0 && (
                        <div className="space-y-1.5 sm:space-y-2">
                          <Label className="text-sm sm:text-base">اختر الكود</Label>
                          <div className="flex flex-wrap gap-2">
                            {product.product_codes.map((code) => (
                              <button
                                key={code}
                                type="button"
                                onClick={() => {
                                  const newVariants = [...itemVariants];
                                  newVariants[index] = { ...newVariants[index], productCode: code };
                                  setItemVariants(newVariants);
                                }}
                                className={`px-4 py-2 rounded-lg border-2 transition-all text-sm ${
                                  item.productCode === code
                                    ? "border-primary bg-primary/10 text-primary font-medium"
                                    : "border-border hover:border-primary/50"
                                }`}
                                dir="ltr"
                              >
                                {code}
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
                  {isSubmitting ? "جاري إرسال الطلب..." : "اطلب الآن - الدفع عند الاستلام"}
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
          <section className="mt-8 sm:mt-12 cv-auto">
            <h2 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6 text-foreground">وصف المنتج</h2>
            <div
              className="prose prose-sm sm:prose-lg max-w-none text-foreground [&_img]:w-full [&_img]:h-auto [&_img]:rounded-xl [&_img]:my-4 [&_img]:object-contain"
              dangerouslySetInnerHTML={{ __html: sanitizedDescription }}
            />
          </section>
        )}
      </main>
    </div>
  );
};

export default LandingPage;
