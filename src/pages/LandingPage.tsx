import { useState, useEffect, useLayoutEffect, useMemo, useCallback, useRef, lazy, Suspense, memo } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Check, ShoppingBag, Phone, MapPin, User, Mail, Ruler, ZoomIn, X, Star, ChevronDown, ShieldCheck, Sparkles, Award, Truck, Loader2, Gift } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { isolateLatin } from "@/lib/bidi";
import StoreHeader, { type HeaderSettings } from "@/components/StoreHeader";
import { StoreThemeScope } from "@/components/StoreThemeScope";
import { parseThemeTokens, type StoreThemeTokens } from "@/lib/themeTokens";
import {
  resolveAttributionFromUrl,
  getAnalyticsSessionId,
  hasTrackedPageView,
  markPageViewTracked,
} from "@/lib/analyticsAttribution";
import {
  autocompleteForField,
  fetchPublicOrderFormFields,
  inputTypeForField,
  isDeliverySelectField,
  landingFormFieldsCacheKey,
  mapCreateOrderError,
  normalizeLibyanPhone,
  normalizePublicFormFields,
  resolveOrderFields,
  validateDeliveryCity,
  validateOrderPayload,
} from "@/lib/landingOrderForm";
import {
  fetchPublicDeliveryPrices,
  lookupDeliveryFee,
  orderFormUsesDeliverySelect,
  type StoreDeliveryPrice,
} from "@/lib/storeDeliveryPrices";
import { getEdgeFunctionErrorMessage } from "@/lib/edgeFunctionError";
import { LandingImage } from "@/components/LandingImage";
import { landingHeroPreloadHref, buildLandingSrcSet, isOptimizableLandingImage } from "@/lib/landingImageUrl";
import { hasLandingSsrShell, dismissLandingSsrShell } from "@/lib/landingSsrDetect";
import { deferMarketingPixels } from "@/lib/deferMarketingPixels";
import {
  getProductVariantKeys,
  getSingleVariantSelection,
  isCodeKeyOutOfStock,
  isColorOptionOutOfStock,
  isSizeOptionOutOfStock,
  isVariantSelectionOutOfStock,
  parseVariantKey,
  productHasVariants,
  productUsesColorOrSize,
} from "@/lib/productVariants";

const OUT_OF_STOCK_MESSAGE = "الكمية غير متوفرة، اختر منتجاً آخر";
const ORDER_FORM_MIN_HEIGHT = "min-h-[720px]";

const PuckRender = lazy(() =>
  import("@/components/PuckRender").then((m) => ({ default: m.PuckRender }))
);

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
  variant_stock?: Record<string, number>;
  size_chart_url?: string | null;
  reviews?: Array<{ name: string; rating: number; comment: string }>;
  faqs?: Array<{ question: string; answer: string }>;
}

interface SizeChartData {
  enabled: boolean;
  title?: string;
  description?: string;
  columns: string[];
  rows: Array<{ enabled: boolean; values: string[]; note?: string }>;
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
  theme_tokens?: StoreThemeTokens;
  theme_custom_css?: string | null;
}

function ensureFormFieldKeys(
  prev: Record<string, string>,
  fields: Pick<FormField, "field_key">[]
): Record<string, string> {
  let changed = false;
  const next = { ...prev };
  for (const field of fields) {
    if (!(field.field_key in next)) {
      next[field.field_key] = "";
      changed = true;
    }
  }
  return changed ? next : prev;
}

const LandingOrderFormFields = memo(function LandingOrderFormFields({
  fields,
  values,
  onChange,
  deliveryPrices,
  currencySymbol,
}: {
  fields: FormField[];
  values: Record<string, string>;
  onChange: (fieldKey: string, value: string) => void;
  deliveryPrices: StoreDeliveryPrice[];
  currencySymbol: string;
}) {
  return (
    <div className="space-y-4">
      {fields.map((field) => (
        <div key={field.field_key} className="space-y-2">
          <Label className="flex items-center gap-2 text-sm font-bold text-slate-800">
            {field.field_type === "phone" ? (
              <Phone className="w-4 h-4 text-amber-500" />
            ) : field.field_type === "email" ? (
              <Mail className="w-4 h-4 text-amber-500" />
            ) : isDeliverySelectField(field) ? (
              <Truck className="w-4 h-4 text-amber-500" />
            ) : (
              <User className="w-4 h-4 text-amber-500" />
            )}
            <span>{field.label}</span>
            {field.required && <span className="text-rose-500 font-bold">*</span>}
          </Label>
          {field.field_type === "textarea" ? (
            <Textarea
              name={field.field_key}
              value={values[field.field_key] || ""}
              onChange={(e) => onChange(field.field_key, e.target.value)}
              placeholder={field.placeholder}
              rows={3}
              required={field.required}
              autoComplete={autocompleteForField(field)}
              className="text-base shadow-sm focus:shadow-md"
            />
          ) : isDeliverySelectField(field) ? (
            deliveryPrices.length === 0 ? (
              <p className="text-sm text-amber-700 bg-amber-500/10 border border-amber-500/20 rounded-xl px-3 py-2">
                أسعار التوصيل غير متوفرة — أضف المدن من إعدادات نموذج الطلب
              </p>
            ) : (
              <div className="relative">
                <select
                  name={field.field_key}
                  value={values[field.field_key] || ""}
                  onChange={(e) => onChange(field.field_key, e.target.value)}
                  required={field.required}
                  className="flex h-12 w-full appearance-none rounded-md border border-slate-200 bg-white px-3 py-2 text-base shadow-sm focus:shadow-md focus:outline-none focus:ring-2 focus:ring-amber-500/30 pr-10"
                  dir="rtl"
                >
                  <option value="" disabled>
                    {field.placeholder || "اختر المدينة"}
                  </option>
                  {deliveryPrices.map((row) => (
                    <option key={row.city_name} value={row.city_name}>
                      {row.city_name}
                      {row.price > 0 ? ` (+${row.price} ${currencySymbol})` : ""}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              </div>
            )
          ) : (
            <Input
              name={field.field_key}
              value={values[field.field_key] || ""}
              onChange={(e) => onChange(field.field_key, e.target.value)}
              placeholder={field.placeholder}
              type={inputTypeForField(field)}
              inputMode={field.field_type === "phone" ? "tel" : field.field_type === "email" ? "email" : "text"}
              autoComplete={autocompleteForField(field)}
              dir={field.field_type === "phone" ? "ltr" : "rtl"}
              required={field.required}
              className="text-base h-12 shadow-sm focus:shadow-md"
            />
          )}
        </div>
      ))}
    </div>
  );
});

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
  FORM_FIELDS: 'libya_form_fields_v2',
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

// Edge SSR embeds a JSON data seed so the client can render the COMPLETE page
// (incl. the order form) on its first paint — no "shell → loading form → page"
// double load. Parsed once; consumed only when it matches the current slug.
interface LandingSsrSeed {
  v: number;
  slug: string;
  username: string | null;
  ownerId: string | null;
  storeId: string | null;
  product: Product;
  store: {
    currency_symbol: string;
    currency_code: string;
    button_text: string;
    theme_tokens?: unknown;
    theme_custom_css?: string | null;
  };
  formFields: FormField[];
  deliveryPrices?: StoreDeliveryPrice[];
  sizeChart: SizeChartData | null;
  // v2 seed: read data embedded so the client makes ZERO read queries.
  pixelSettings?: PixelSettings | null;
  header?: HeaderSettings | null;
  platformName?: string;
  strictStock?: boolean;
  puckData?: any;
}

function readLandingSsrSeed(): LandingSsrSeed | null {
  if (typeof document === "undefined") return null;
  const el = document.getElementById("landing-ssr-data");
  if (!el?.textContent) return null;
  try {
    const seed = JSON.parse(el.textContent) as LandingSsrSeed;
    return seed && seed.product && seed.slug ? seed : null;
  } catch {
    return null;
  }
}

const LandingPage = () => {
  const { slug, username } = useParams<{ slug: string; username?: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isPreviewMode = searchParams.get("preview") === "1";

  // Hydrate from the edge SSR data seed when it matches this slug (skip in
  // preview mode, which must always fetch the latest unpublished data).
  const ssrSeed = useMemo(() => {
    const seed = readLandingSsrSeed();
    if (!seed || isPreviewMode) return null;
    if (seed.slug !== slug) return null;
    if (username && seed.username && seed.username !== username) return null;
    return seed;
  }, [slug, username, isPreviewMode]);
  // Only a v2+ seed carries ALL read data (theme, description, reviews, pixels,
  // header, platform name). For such seeds we fully trust them and skip the
  // per-visit read queries. Older/partial seeds still hydrate the first paint
  // but fall back to the normal fetch so nothing renders stale during deploys.
  const seedTrusted = !!ssrSeed && (ssrSeed.v ?? 1) >= 2 && !isPreviewMode;
  const seededFirstRunRef = useRef(!!ssrSeed);

  const [product, setProduct] = useState<Product | null>(ssrSeed?.product ?? null);
  const [sizeChartData, setSizeChartData] = useState<SizeChartData | null>(ssrSeed?.sizeChart ?? null);
  const [ownerId, setOwnerId] = useState<string | null>(ssrSeed?.ownerId ?? null);
  const [storeId, setStoreId] = useState<string | null>(ssrSeed?.storeId ?? null);
  const [strictStockEnabled, setStrictStockEnabled] = useState(!!ssrSeed?.strictStock);
  const [toastMessage, setToastMessage] = useState<{ type: string; msg: string } | null>(null);
  const showToast = (title: string, description: string, variant: string = "success") => {
    setToastMessage({ type: variant, msg: `${title}: ${description}` });
    setTimeout(() => setToastMessage(null), 4000);
    try { toast({ title, description, variant: variant === "destructive" ? "destructive" : undefined } as any); } catch {}
  };
  const ssrBootRef = useRef(hasLandingSsrShell());
  const [loading, setLoading] = useState(!ssrSeed);
  const [selectedImage, setSelectedImage] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [showSizeChart, setShowSizeChart] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formFields, setFormFields] = useState<FormField[]>(
    normalizePublicFormFields((ssrSeed?.formFields ?? []) as FormField[]),
  );
  const [formFieldsLoaded, setFormFieldsLoaded] = useState(!!ssrSeed?.formFields?.length);
  const [deliveryPrices, setDeliveryPrices] = useState<StoreDeliveryPrice[]>(ssrSeed?.deliveryPrices ?? []);
  const [storeSettings, setStoreSettings] = useState<StoreSettings>({
    currency_symbol: ssrSeed?.store?.currency_symbol ?? "د.ل",
    currency_code: ssrSeed?.store?.currency_code ?? "LYD",
    button_text: ssrSeed?.store?.button_text ?? "اطلب الآن - الدفع عند الاستلام",
    theme_tokens: parseThemeTokens(ssrSeed?.store?.theme_tokens ?? null),
    theme_custom_css: ssrSeed?.store?.theme_custom_css ?? null,
  });
  const [formData, setFormData] = useState<Record<string, string>>(() =>
    ssrSeed?.formFields?.length ? ensureFormFieldKeys({}, ssrSeed.formFields) : {}
  );
  const [selectedProductCode, setSelectedProductCode] = useState<string>("");
  const [quantity, setQuantity] = useState<number>(1);
  const [selectedUpsellIndex, setSelectedUpsellIndex] = useState<number | null>(null);
  const [sanitizedDescription, setSanitizedDescription] = useState<string>("");
  const checkoutTrackedRef = useRef(false);
  const pageViewTrackedRef = useRef(false);
  const formFieldsRef = useRef<FormField[]>([]);
  const productRef = useRef<Product | null>(null);
  const storeSettingsRef = useRef(storeSettings);
  const ownerIdRef = useRef<string | null>(null);
  const storeIdRef = useRef<string | null>(null);
  const slugRef = useRef<string | undefined>(slug);
  formFieldsRef.current = formFields;
  productRef.current = product;
  storeSettingsRef.current = storeSettings;
  ownerIdRef.current = ownerId;
  storeIdRef.current = storeId;
  slugRef.current = slug;
  const [puckData, setPuckData] = useState<any>(ssrSeed?.puckData ?? null);
  const [puckLoading, setPuckLoading] = useState(false);
  
  // Force light mode — landing pages should always look the same regardless of dashboard theme
  useEffect(() => {
    const root = document.documentElement;
    const wasDark = root.classList.contains("dark");
    if (wasDark) root.classList.remove("dark");
    return () => {
      if (wasDark) root.classList.add("dark");
    };
  }, []);

  // Preload LCP hero image as soon as URL is known (session cache or fetch).
  // Mirror the <img> srcset/sizes so the browser preloads the SAME candidate it
  // will actually render — preventing a wasteful double download on mobile.
  useEffect(() => {
    const href = product?.images?.[selectedImage] ?? product?.images?.[0];
    if (!href) return;
    const optimized = landingHeroPreloadHref(href);
    const heroSizes = "(max-width: 640px) 90vw, (max-width: 1024px) 50vw, 480px";
    const heroSrcSet = isOptimizableLandingImage(href)
      ? buildLandingSrcSet(href, [400, 640, 800, 1080], { height: 800, format: "webp" })
      : "";
    const id = "landing-lcp-preload";
    let link = document.getElementById(id) as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement("link");
      link.id = id;
      link.rel = "preload";
      link.as = "image";
      document.head.appendChild(link);
    }
    if (link.href !== optimized) {
      link.href = optimized;
      link.setAttribute("fetchpriority", "high");
    }
    if (heroSrcSet) {
      link.setAttribute("imagesrcset", heroSrcSet);
      link.setAttribute("imagesizes", heroSizes);
    }
    return () => {
      link?.remove();
    };
  }, [product?.images, selectedImage]);
  
  // For multiple items with different variants
  interface ItemVariant {
    color: string;
    size: string;
    productCode: string;
  }
  const [itemVariants, setItemVariants] = useState<ItemVariant[]>([{ color: "", size: "", productCode: "" }]);

  const variantKeys = useMemo(() => getProductVariantKeys(product), [product]);
  const showVariantPickers = productHasVariants(product);
  const showVariantPickersUI = showVariantPickers && variantKeys.length > 1;
  const useColorSizePickers = productUsesColorOrSize(product);
  const useCodeVariantPickers = showVariantPickers && !useColorSizePickers;
  const variantButtonClass = (selected: boolean, outOfStock: boolean) =>
    `relative px-3.5 py-2 rounded-xl border text-xs font-bold transition-all duration-200 ${
      outOfStock
        ? "opacity-45 border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed"
        : selected
          ? "border-amber-500 bg-amber-500/10 text-amber-800 ring-2 ring-amber-500/20"
          : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
    }`;
  const notifyOutOfStock = () => showToast("غير متوفر", OUT_OF_STOCK_MESSAGE, "destructive");
  const defaultItemVariant = useMemo((): ItemVariant => {
    const single = getSingleVariantSelection(product);
    return single ?? { color: "", size: "", productCode: "" };
  }, [product]);

  useEffect(() => {
    setItemVariants([{ ...defaultItemVariant }]);
  }, [product?.id, defaultItemVariant]);

  const hasUpsellOffers = !!(
    product?.upsell_enabled &&
    Array.isArray(product?.upsell_offers) &&
    product.upsell_offers.length > 0
  );

  const syncItemVariantsForQuantity = useCallback(
    (qty: number) => {
      setItemVariants((prev) => {
        const next = [...prev];
        while (next.length < qty) next.push({ ...defaultItemVariant });
        return next.slice(0, qty);
      });
    },
    [defaultItemVariant],
  );

  const matchUpsellIndexForQuantity = useCallback(
    (qty: number): number | null => {
      if (!hasUpsellOffers || !product?.upsell_offers) return null;
      const idx = product.upsell_offers.findIndex((o) => Number(o.quantity) === qty);
      return idx >= 0 ? idx : null;
    },
    [hasUpsellOffers, product?.upsell_offers],
  );

  const orderProductSubtotal = useMemo(() => {
    if (selectedUpsellIndex !== null && product?.upsell_offers?.[selectedUpsellIndex]) {
      return Number(product.upsell_offers[selectedUpsellIndex].price);
    }
    return parseFloat(String(product?.price || 0)) * quantity;
  }, [selectedUpsellIndex, product?.upsell_offers, product?.price, quantity]);

  const selectedDeliveryCity = useMemo(() => {
    const deliveryField = formFields.find(isDeliverySelectField);
    if (!deliveryField) return "";
    return (formData[deliveryField.field_key] || "").trim();
  }, [formFields, formData]);

  const deliveryFee = useMemo(
    () => lookupDeliveryFee(selectedDeliveryCity, deliveryPrices),
    [selectedDeliveryCity, deliveryPrices],
  );

  const orderTotalDisplay = orderProductSubtotal + deliveryFee;
  const showOrderTotalSummary =
    deliveryFee > 0 || quantity > 1 || selectedUpsellIndex !== null;

  const activeFormFields = formFields;
  const getAttribution = useCallback(() => {
    return resolveAttributionFromUrl(searchParams, typeof document !== "undefined" ? document.referrer : "");
  }, [searchParams]);

  const trackAnalyticsEvent = useCallback(
    (eventType: "page_view" | "checkout_start" | "purchase", productSlug: string, owner: string | null, store: string | null) => {
      const sessionId = getAnalyticsSessionId();
      const attr = getAttribution();
      return supabase.from("analytics_events").insert({
        event_type: eventType,
        product_slug: productSlug,
        owner_id: owner,
        store_id: store,
        session_id: sessionId,
        ...attr,
      } as any);
    },
    [getAttribution]
  );

  useEffect(() => {
    const ac = new AbortController();
    const loadData = async () => {
      if (!slug) {
        setLoading(false);
        return;
      }

      // SEED FAST PATH — the edge-cached SSR HTML already embeds the full page
      // data (product, store, theme, form fields, pixels, header, reviews…),
      // and is purged whenever an owner edits the page. So when a fresh seed is
      // present we TRUST it and skip the ~11 read queries that previously ran on
      // EVERY visit (the main cause of DB overload under landing-page traffic).
      // We keep exactly ONE live read — current stock — so availability stays
      // accurate, plus the page_view write. Everything else is already in state.
      if (seedTrusted && ssrSeed) {
        setLoading(false);
        setFormFieldsLoaded(true);
        setStrictStockEnabled(!!ssrSeed.strictStock);

        // One lightweight live stock check (keeps oversell protection working).
        if (ssrSeed.product?.id) {
          supabase
            .from("products")
            .select("stock, variant_stock")
            .eq("id", ssrSeed.product.id)
            .maybeSingle()
            .then(({ data }) => {
              if (ac.signal.aborted || !data) return;
              setProduct((prev) =>
                prev
                  ? {
                      ...prev,
                      stock: typeof data.stock === "number" ? data.stock : prev.stock,
                      variant_stock:
                        data.variant_stock && typeof data.variant_stock === "object"
                          ? (data.variant_stock as Record<string, number>)
                          : prev.variant_stock,
                    }
                  : prev,
              );
            });
        }

        // Track one page view per session (deduped) — a write, not a read.
        if (!pageViewTrackedRef.current) {
          const sessionId = getAnalyticsSessionId();
          if (!hasTrackedPageView(slug, sessionId)) {
            pageViewTrackedRef.current = true;
            markPageViewTracked(slug, sessionId);
            trackAnalyticsEvent("page_view", slug, ssrSeed.ownerId, ssrSeed.storeId).then(
              ({ error }) => {
                if (error) console.error("page_view tracking:", error);
              },
            );
          }
        }

        // Initialize tracking pixels from the seed (still deferred to first
        // interaction inside deferMarketingPixels — never blocks render).
        if (ssrSeed.pixelSettings) {
          deferMarketingPixels(() =>
            initializePixels(
              ssrSeed.pixelSettings as PixelSettings,
              ssrSeed.product,
              ssrSeed.store?.currency_code || storeSettingsRef.current.currency_code,
            ),
          );
        }

        // Always revalidate form fields + delivery prices (stale SSR/edge cache may
        // embed outdated field types after enabling «نوع التوصيل»).
        if (ssrSeed.ownerId) {
          fetchPublicOrderFormFields(supabase, ssrSeed.ownerId, ssrSeed.storeId).then(
            ({ fields, error }) => {
              if (ac.signal.aborted || error || !fields.length) return;
              const normalized = normalizePublicFormFields(fields) as FormField[];
              setFormFields(normalized);
              setFormData((prev) => ensureFormFieldKeys(prev, normalized));
              setToCache(
                landingFormFieldsCacheKey(ssrSeed.ownerId!, ssrSeed.storeId),
                normalized,
              );
            },
          );
          if (ssrSeed.storeId) {
            fetchPublicDeliveryPrices(supabase, ssrSeed.storeId).then((prices) => {
              if (!ac.signal.aborted) setDeliveryPrices(prices);
            });
          }
        }

        return;
      }

      try {
        // When hydrated from the SSR seed, keep the already-rendered form visible
        // on the first run so it doesn't flash back to a loading state while we
        // revalidate in the background.
        if (seededFirstRunRef.current) {
          seededFirstRunRef.current = false;
        } else {
          setFormFields([]);
          setFormFieldsLoaded(false);
        }
        setStrictStockEnabled(false);

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
        const profilePromise: any = username
          ? (supabase as any).rpc("get_public_profile_by_username", { _username: username })
              .then((res: any) => ({ data: Array.isArray(res.data) ? res.data[0] : res.data, error: res.error }))
          : Promise.resolve({ data: null, error: null } as any);

        // Two-stage fetch: lightweight fields first (fast), heavy fields (description/images/reviews) second
        const productLightSelect = "id, name, slug, price, original_price, product_codes, colors, sizes, owner_id, store_id, upsell_enabled, upsell_title, upsell_offers, order_form_on_top, is_visible, stock, variant_stock, size_chart_url";

        // أولاً: حاول مطابقة username كرابط متجر (slug) لتحديد store_id
        const storeBySlugPromise = username
          ? supabase.from("stores").select("id, owner_id").eq("slug", username).maybeSingle()
          : Promise.resolve({ data: null } as any);

        // ابحث عن صفحة هبوط بهذا الـ slug، فإن وُجدت نأخذ المنتج المرتبط ونطبّق إعدادات الصفحة
        const landingPromise = supabase
          .from("landing_pages")
          .select("id, product_id, store_id, owner_id, slug, title, subtitle, images, price, original_price, upsell_enabled, upsell_title, upsell_offers, order_form_on_top, show_quantity, is_visible, faqs, size_chart")
          .eq("slug", slug)
          .maybeSingle();

        const [profileRes, landingRes, storeBySlugRes] = await Promise.all([profilePromise, landingPromise, storeBySlugPromise]);
        if ((landingRes as any).error) {
          console.error("landing_pages fetch:", (landingRes as any).error);
        }
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

        if (ac.signal.aborted) {
          setLoading(false);
          return;
        }
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
        const rows = Array.isArray(productRes.data)
          ? productRes.data
          : productRes.data
            ? [productRes.data]
            : [];
        const matched = resolvedOwnerId ? rows.find((r) => r.owner_id === resolvedOwnerId) : rows[0];

        // Dashboard preview (?preview=1): allow hidden pages for authenticated store owners
        let allowHiddenPreview = false;
        if (isPreviewMode) {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            const pageOwnerId = landingPage?.owner_id || matched?.owner_id;
            if (pageOwnerId === user.id) {
              allowHiddenPreview = true;
            } else if (pageOwnerId) {
              const { data: effectiveOwnerId } = await (supabase as any).rpc("get_effective_owner_id", {
                _uid: user.id,
              });
              if (effectiveOwnerId && pageOwnerId === effectiveOwnerId) {
                allowHiddenPreview = true;
              }
            }
          }
        }

        // إذا كانت الصفحة مخفية أو المنتج مخفي، أوقف (ما لم تكن معاينة للمالك)
        if (landingPage && landingPage.is_visible === false && !allowHiddenPreview) {
          setLoading(false);
          return;
        }
        if (matched && matched.is_visible === false && !landingPage && !allowHiddenPreview) {
          setLoading(false);
          return;
        }

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
            owner_id: matched.owner_id,
            name: matched.name,
            slug: lp?.slug || matched.slug,
            price: String(lp?.price ?? matched.price),
            original_price: (lp?.original_price ?? matched.original_price) ? String(lp?.original_price ?? matched.original_price) : undefined,
            description: cachedProduct?.product?.description || "",
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
            variant_stock:
              (matched as any).variant_stock && typeof (matched as any).variant_stock === "object"
                ? ((matched as any).variant_stock as Record<string, number>)
                : {},
            size_chart_url: (matched as any).size_chart_url || null,
            reviews: cachedProduct?.product?.reviews || [],
            faqs: Array.isArray(lp?.faqs) ? lp.faqs : [],
          };
          setProduct(loadedProduct);

          // جدول المقاسات الخاص بصفحة الهبوط
          const sc = lp?.size_chart;
          if (sc && typeof sc === "object" && sc.enabled && Array.isArray(sc.rows) && sc.rows.length > 0) {
            setSizeChartData({
              enabled: true,
              title: String(sc.title ?? "جدول المقاسات"),
              description: String(sc.description ?? ""),
              columns: Array.isArray(sc.columns) ? sc.columns.map((c: any) => String(c ?? "")) : [],
              rows: sc.rows
                .filter((r: any) => r?.enabled !== false)
                .map((r: any) => ({
                  enabled: true,
                  values: Array.isArray(r?.values) ? r.values.map((v: any) => String(v ?? "")) : [],
                  note: String(r?.note ?? ""),
                })),
            });
          } else {
            setSizeChartData(null);
          }

          // Fetch heavy fields (images/description/reviews) separately after first paint
          const needProductHeavy = !lpImages.length;
          const heavyProductPromise = needProductHeavy
            ? supabase.from("products").select("images, description, reviews").eq("id", matched.id).maybeSingle()
            : supabase.from("products").select("description, reviews").eq("id", matched.id).maybeSingle();
          const heavyLandingPromise = lp
            ? supabase.from("landing_pages").select("description").eq("id", lp.id).maybeSingle()
            : Promise.resolve({ data: null } as any);

          const puckPromise = lp?.id
            ? supabase.from("landing_pages").select("puck_data").eq("id", lp.id).maybeSingle()
            : Promise.resolve({ data: null } as any);

          if (lp?.id) {
            setPuckLoading(true);
            puckPromise.then(({ data: puckRow }: any) => {
              const pd = puckRow?.puck_data;
              if (pd && Array.isArray(pd?.content) && pd.content.length > 0) {
                setPuckData(pd);
              }
              setPuckLoading(false);
            });
          }

          Promise.all([heavyProductPromise, heavyLandingPromise]).then(([prodHeavy, landingHeavy]: any[]) => {
            const prodData = prodHeavy?.data || {};
            const landingDesc = landingHeavy?.data?.description;
            const finalDesc = (landingDesc ?? prodData.description) || "";
            const finalReviews = Array.isArray(prodData.reviews) ? prodData.reviews : [];
            const finalImages = needProductHeavy && Array.isArray(prodData.images) && prodData.images.length
              ? prodData.images
              : (loadedProduct as Product).images;
            const merged: Product = { ...(loadedProduct as Product), description: finalDesc, reviews: finalReviews, images: finalImages };
            setProduct(merged);
            setToCache(productCacheKey, { product: merged, ownerId: resolvedOwnerId || matched.owner_id });
          });
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
        const formKey = landingFormFieldsCacheKey(ownerForSettings || "", storeForSettings);

        const cachedStoreSettings = getFromCache(storeKey);
        const cachedPixelSettings = getFromCache(pixelKey);
        const cachedFormFields = getFromCache(formKey);

        // Apply cache immediately for snappy paint.
        if (cachedStoreSettings) {
          setStoreSettings(cachedStoreSettings);
          loadedCurrency = cachedStoreSettings.currency_code;
        }
        if (cachedFormFields) {
          const normalized = normalizePublicFormFields(cachedFormFields as FormField[]);
          setFormFields(normalized);
          setFormData((prev) => ensureFormFieldKeys(prev, normalized));
          setFormFieldsLoaded(true);
          if (storeForSettings && orderFormUsesDeliverySelect(normalized)) {
            fetchPublicDeliveryPrices(supabase, storeForSettings).then((prices) => {
              if (!ac.signal.aborted) setDeliveryPrices(prices);
            });
          }
        }

        if (cachedPixelSettings) {
          deferMarketingPixels(() =>
            initializePixels(
              cachedPixelSettings as PixelSettings,
              loadedProduct,
              loadedCurrency || storeSettings.currency_code
            )
          );
        }

        // Stale-while-revalidate: ALWAYS fetch fresh so admin edits show up.
        const pixelPromise: any = ownerForSettings
          ? (supabase as any)
              .rpc("get_pixel_settings_public", { _owner_id: ownerForSettings, _store_id: storeForSettings || null })
              .then((res: any) => ({ data: Array.isArray(res.data) ? res.data[0] : res.data, error: res.error }))
          : Promise.resolve({ data: null, error: null } as any);

        const formFieldsPromise: Promise<{ data: FormField[] | null; error: unknown }> = ownerForSettings
          ? fetchPublicOrderFormFields(supabase, ownerForSettings, storeForSettings || null).then(
              ({ fields, error }) => ({ data: fields, error })
            )
          : Promise.resolve({ data: [], error: null });

        const storeQ = supabase.from("store_settings").select("currency_symbol, currency_code, button_text, theme_tokens, theme_custom_css");
        if (ownerForSettings) storeQ.eq("owner_id", ownerForSettings);
        if (storeForSettings) storeQ.eq("store_id", storeForSettings);
        const storePromise = storeQ.maybeSingle();

        const stockPolicyPromise: Promise<{ data: { strict_stock_enabled?: boolean } | null; error: unknown }> =
          ownerForSettings
            ? (supabase as any)
                .rpc("get_owner_stock_policy", { _owner_id: ownerForSettings })
                .then((res: any) => ({
                  data: Array.isArray(res.data) ? res.data[0] : res.data,
                  error: res.error,
                }))
            : Promise.resolve({ data: null, error: null });

        Promise.all([pixelPromise, formFieldsPromise, storePromise, stockPolicyPromise])
          .then(([pixelResult, formFieldsResult, storeSettingsResult, stockPolicyResult]) => {
          if (!formFieldsResult.error) {
            const fields = normalizePublicFormFields((formFieldsResult.data || []) as FormField[]);
            setFormFields(fields);
            setToCache(formKey, fields);
            setFormData((prev) => ensureFormFieldKeys(prev, fields));
            if (storeForSettings && orderFormUsesDeliverySelect(fields)) {
              fetchPublicDeliveryPrices(supabase, storeForSettings).then((prices) => {
                if (!ac.signal.aborted) setDeliveryPrices(prices);
              });
            } else if (!orderFormUsesDeliverySelect(fields)) {
              setDeliveryPrices([]);
            }
          } else {
            console.error("order form fields:", formFieldsResult.error);
          }
          setFormFieldsLoaded(true);

          if (stockPolicyResult.data) {
            setStrictStockEnabled(!!stockPolicyResult.data.strict_stock_enabled);
          } else if (!stockPolicyResult.error) {
            setStrictStockEnabled(false);
          }

          if (storeSettingsResult.data) {
            loadedCurrency = storeSettingsResult.data.currency_code;
            setStoreSettings({
              currency_symbol: storeSettingsResult.data.currency_symbol,
              currency_code: storeSettingsResult.data.currency_code,
              button_text: (storeSettingsResult.data as any).button_text || "اطلب الآن - الدفع عند الاستلام",
              theme_tokens: parseThemeTokens((storeSettingsResult.data as { theme_tokens?: unknown }).theme_tokens),
              theme_custom_css: (storeSettingsResult.data as { theme_custom_css?: string }).theme_custom_css ?? null,
            });
            setToCache(storeKey, storeSettingsResult.data);
          }

          if (pixelResult.data) {
            setToCache(pixelKey, pixelResult.data);
          }

          // Track one page view per session (deduped)
          if (loadedProduct && slug && !pageViewTrackedRef.current) {
            const sessionId = getAnalyticsSessionId();
            if (!hasTrackedPageView(slug, sessionId)) {
              pageViewTrackedRef.current = true;
              markPageViewTracked(slug, sessionId);
              trackAnalyticsEvent("page_view", slug, ownerForSettings || null, storeForSettings || null).then(({ error }) => {
                if (error) console.error("page_view tracking:", error);
              });
            }
          }

          // Initialize tracking pixels after first paint (never block LCP)
          if (pixelResult.data) {
            deferMarketingPixels(() =>
              initializePixels(pixelResult.data as PixelSettings, loadedProduct, loadedCurrency)
            );
          }
        })
          .catch((err) => {
            console.error("landing settings fetch:", err);
            setFormFieldsLoaded(true);
          });
      } catch (error) {
        console.error("Error loading data:", error);
        setLoading(false);
      }
    };

    pageViewTrackedRef.current = false;
    loadData();
    return () => ac.abort();
  }, [slug, username, isPreviewMode, ssrSeed]);

  useEffect(() => {
    if (!product?.name) return;
    let cancelled = false;
    // When seeded (v2+), the platform name is already embedded — set the title
    // with no DB query (saves one app_settings read per visit).
    if (seedTrusted && ssrSeed?.platformName) {
      const platform = ssrSeed.platformName.trim() || "منصة وصلة";
      document.title = `${product.name} | ${platform}`;
      return;
    }
    // Title is not LCP-critical — defer the extra request off the load path.
    const run = () => {
      supabase
        .from("app_settings")
        .select("system_name")
        .limit(1)
        .maybeSingle()
        .then(({ data }) => {
          if (cancelled) return;
          const platform = (data?.system_name || "منصة وصلة").trim() || "منصة وصلة";
          document.title = `${product.name} | ${platform}`;
        });
    };
    if (typeof (window as any).requestIdleCallback === "function") {
      (window as any).requestIdleCallback(run, { timeout: 3000 });
    } else {
      setTimeout(run, 1200);
    }
    return () => {
      cancelled = true;
    };
  }, [product?.name]);

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
      // Force lazy-loading + async decoding on every embedded image/iframe.
      // Keep intrinsic width/height attributes so the browser can reserve space
      // (aspect-ratio) and avoid layout shift; CSS below makes them responsive.
      html = html
        .replace(/<img\b(?![^>]*\bloading=)/gi, '<img loading="lazy" decoding="async"')
        .replace(/<iframe\b(?![^>]*\bloading=)/gi, '<iframe loading="lazy"');
      // Neutralize pasted HTML from other sites that uses fixed widths,
      // floats, absolute positioning, or huge margins that overflow mobile.
      html = html
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
  const handleInputChange = useCallback((fieldKey: string, value: string) => {
    let cleanedValue = value;
    const fieldMeta = formFieldsRef.current.find((f) => f.field_key === fieldKey);
    const isPhoneField = fieldMeta?.field_type === "phone";
    if (isPhoneField) {
      cleanedValue = value.replace(/[^0-9+]/g, "");
      if (cleanedValue.startsWith("+")) {
        cleanedValue = "+" + cleanedValue.slice(1).replace(/[^0-9]/g, "");
      } else {
        cleanedValue = cleanedValue.replace(/[^0-9]/g, "");
      }
    }
    setFormData((prev) => ({ ...prev, [fieldKey]: cleanedValue }));

    if (!checkoutTrackedRef.current && cleanedValue.length > 0) {
      checkoutTrackedRef.current = true;

      const productData = productRef.current;
      const settings = storeSettingsRef.current;
      if (productData) {
        const orderValue = parseFloat(productData.price);
        const currency = toISOCurrency(settings.currency_code, settings.currency_symbol);
        if (window.fbq) {
          window.fbq("track", "InitiateCheckout", {
            content_name: productData.name,
            content_ids: [productData.id],
            content_type: "product",
            value: orderValue,
            currency,
            num_items: 1,
          });
        }
        if (window.ttq && typeof window.ttq.track === "function") {
          window.ttq.track("InitiateCheckout", {
            value: orderValue,
            currency,
            contents: [{ content_id: productData.id, content_name: productData.name, quantity: 1 }],
          });
        }
        if (window.gtag) {
          window.gtag("event", "begin_checkout", {
            value: orderValue,
            currency,
            items: [{ item_id: productData.id, item_name: productData.name, quantity: 1 }],
          });
        }
        if (window.snaptr) {
          window.snaptr("track", "START_CHECKOUT", {
            price: orderValue,
            currency,
            item_ids: [productData.id],
          });
        }
      }

      trackAnalyticsEvent(
        "checkout_start",
        slugRef.current || slug || "",
        ownerIdRef.current || null,
        storeIdRef.current || null
      ).then(({ error }) => {
        if (error) console.error("Error tracking checkout start:", error);
      });
    }
  }, []);

  const puckHasContent = !!(puckData && Array.isArray(puckData?.content) && puckData.content.length > 0);
  const puckCtx = useMemo(
    () => ({
      ownerId: product?.owner_id || ownerId || undefined,
      storeId: storeId || undefined,
      username,
      currencySymbol: storeSettings.currency_symbol,
    }),
    [product?.owner_id, ownerId, storeId, username, storeSettings.currency_symbol]
  );

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
        currency: toISOCurrency(currencyCode, storeSettings.currency_symbol),
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
    const productValue = orderTotalDisplay;
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

    // Ensure we always log a checkout attempt, even if the user pasted data
    // without firing input events (some autofill flows skip onChange).
    if (!checkoutTrackedRef.current) {
      checkoutTrackedRef.current = true;
      try {
        trackAnalyticsEvent("checkout_start", slug || "", ownerId || null, storeId || null).then(({ error }) => {
          if (error) console.error("Error tracking checkout start (submit):", error);
        });
      } catch (err) {
        console.error("checkout_start submit tracking failed", err);
      }
    }

    // Merge DOM values (browser autofill may skip React onChange)
    const mergedFormData = { ...formData };
    const formEl = document.getElementById("order-form");
    if (formEl) {
      formEl.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
        "input[name], textarea[name], select[name]",
      ).forEach((el) => {
        if (el.name) mergedFormData[el.name] = el.value;
      });
    }

    if (!formFieldsRef.current.length) {
      showToast("خطأ", "جاري تحميل نموذج الطلب، يرجى المحاولة بعد لحظات", "destructive");
      return;
    }

    const validationError = validateOrderPayload(activeFormFields, mergedFormData);
    if (validationError) {
      showToast("خطأ", validationError, "destructive");
      return;
    }

    const deliveryValidationError = validateDeliveryCity(activeFormFields, mergedFormData, deliveryPrices);
    if (deliveryValidationError) {
      showToast("خطأ", deliveryValidationError, "destructive");
      return;
    }

    const { customer_name, phone, city, address } = resolveOrderFields(activeFormFields, mergedFormData);
    const normalizedPhone = normalizeLibyanPhone(phone);

    // Validate per-piece variants when product has colors, sizes, or named codes
    const hasColors = !!(product?.colors && product.colors.length > 0);
    const hasSizes = !!(product?.sizes && product.sizes.length > 0);
    const hasCodeVariants = useCodeVariantPickers;
    if (showVariantPickersUI && (hasColors || hasSizes || hasCodeVariants)) {
      for (let i = 0; i < quantity; i++) {
        const v = itemVariants[i] || { color: "", size: "", productCode: "" };
        if (hasCodeVariants && !v.productCode) {
          showToast("خطأ", `يرجى اختيار المتغير للقطعة ${i + 1}`, "destructive");
          return;
        }
        if ((hasColors && !v.color) || (hasSizes && !v.size)) {
          toast({
            title: "خطأ",
            description: `يرجى اختيار ${[hasColors && "اللون", hasSizes && "المقاس"].filter(Boolean).join(" و ")} للقطعة ${i + 1}`,
            variant: "destructive",
          });
          return;
        }
        if (strictStockEnabled && isVariantSelectionOutOfStock(product, v, true)) {
          showToast("غير متوفر", OUT_OF_STOCK_MESSAGE, "destructive");
          return;
        }
      }
    }

    setIsSubmitting(true);

    try {
      // Auto-use single code when variants are not shown (single variant or no picker)
      const singleCode =
        !showVariantPickersUI && product?.product_codes && product.product_codes.length === 1
          ? product.product_codes[0]
          : null;
      // Pad variants to match quantity
      const variantsForSubmit = [...itemVariants];
      while (variantsForSubmit.length < quantity) {
        variantsForSubmit.push({ ...defaultItemVariant });
      }
      const activeVariants = variantsForSubmit.slice(0, quantity);

      const colorsArray = activeVariants.map((v) => v.color || "");
      const sizesArray = activeVariants.map((v) => v.size || "");
      const codesArray = activeVariants.map((v) => v.productCode || singleCode || "");
      const itemsPayload: Array<{
        color: string | null;
        size: string | null;
        product_code: string | null;
        quantity: number;
      }> = [];
      for (const v of activeVariants) {
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

      const { data, error } = await supabase.functions.invoke("create-order", {
        body: {
          customer_name,
          phone: normalizedPhone,
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
          ...getAttribution(),
        },
      });

      if (error) {
        const raw = await getEdgeFunctionErrorMessage(error, data);
        throw new Error(mapCreateOrderError(raw));
      }
      if (data && typeof data === "object" && "error" in data && (data as { error?: string }).error) {
        throw new Error(mapCreateOrderError(String((data as { error: string }).error)));
      }

      // Track purchase event (pixels + internal analytics)
      trackPurchaseEvent();
      trackAnalyticsEvent("purchase", slug || "", ownerId || null, storeId || null).then(({ error }) => {
        if (error) console.error("purchase tracking:", error);
      });

      const orderPrice =
        typeof data === "object" && data && "total" in data && (data as { total?: number }).total != null
          ? Number((data as { total: number }).total)
          : orderTotalDisplay;
      const shippingFeeFromServer =
        typeof data === "object" && data && "shipping_fee" in data
          ? Number((data as { shipping_fee?: number }).shipping_fee) || 0
          : deliveryFee;

      navigate("/thank-you", {
        state: {
          orderData: {
            productName: product?.name,
            price: orderPrice,
            shippingFee: shippingFeeFromServer,
            currencySymbol: storeSettings.currency_symbol,
            currencyCode: toISOCurrency(storeSettings.currency_code, storeSettings.currency_symbol),
            productId: product?.id,
            quantity,
            customerName: customer_name,
            phone: normalizedPhone,
            city,
            address,
            ownerId: product?.owner_id || ownerId || null,
          },
        },
      });
    } catch (error) {
      console.error("Error submitting order:", error);
      const msg =
        error instanceof Error && error.message.includes("يرجى")
          ? error.message
          : error instanceof Error
            ? mapCreateOrderError(error.message)
            : "حدث خطأ أثناء إرسال الطلب، يرجى المحاولة مرة أخرى";
      showToast("خطأ", msg, "destructive");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Remove the edge-rendered SSR shell synchronously, BEFORE the browser paints
  // React's first real content. useLayoutEffect (not useEffect) guarantees the
  // placeholder and the hydrated content never coexist on screen — preventing
  // the brief "duplicated image/price" flash on slower mobile devices.
  useLayoutEffect(() => {
    if (product && !loading) dismissLandingSsrShell();
  }, [product, loading]);

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

  if (loading && !product) {
    if (ssrBootRef.current && hasLandingSsrShell()) {
      return null;
    }
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


  // -------- Section slots (used by both legacy layout and Puck templates) --------
  const heroSlot = (
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
          </div>
        </div>
      </section>
  );
  const productImagesSlot = (
    <>
      <figure className="aspect-[4/5] sm:aspect-square rounded-2xl sm:rounded-3xl overflow-hidden bg-white shadow-[0_15px_40px_-15px_rgba(0,0,0,0.12)] mb-4 relative border border-slate-100 group gpu">
        <span className="absolute top-3 right-3 z-10 bg-[#0f172a]/80 backdrop-blur-md text-amber-400 text-[10px] sm:text-xs font-bold px-3 py-1.5 rounded-full border border-amber-500/20">
          ⭐ الأكثر مبيعاً في ليبيا
        </span>
        {product.images && product.images.length > 0 ? (
          <button
            type="button"
            onClick={() => setLightboxOpen(true)}
            className="relative w-full h-full flex items-center justify-center cursor-zoom-in"
            aria-label="تكبير تفاصيل المنتج"
          >
            <LandingImage
              src={product.images[selectedImage]}
              alt={product.name}
              width={800}
              height={800}
              priority
              sizes="(max-width: 640px) 90vw, (max-width: 1024px) 50vw, 480px"
              className="w-full h-full object-contain p-4 transition-transform duration-500 group-hover:scale-105"
            />
            <span className="absolute bottom-3 left-3 bg-[#0f172a]/70 backdrop-blur-md text-white p-2.5 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 border border-white/10">
              <ZoomIn className="w-4 h-4" />
            </span>
          </button>
        ) : (
          <Skeleton className="w-full h-full" />
        )}
      </figure>

      {product.images && product.images.length > 1 && (
        <ul className="flex gap-2.5 sm:gap-4 justify-center flex-wrap list-none p-0 m-0">
          {product.images.map((image, index) => (
            <li key={index}>
              <button
                type="button"
                onClick={() => setSelectedImage(index)}
                className={`w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden border-2 bg-white transition-all duration-300 transform active:scale-95 ${
                  selectedImage === index
                    ? "border-amber-500 ring-4 ring-amber-500/15 shadow-md scale-105"
                    : "border-slate-200/80 hover:border-slate-300 shadow-sm"
                }`}
              >
                <LandingImage
                  src={image}
                  alt=""
                  width={80}
                  height={80}
                  sizes="80px"
                  className="w-full h-full object-contain p-1"
                />
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  );
  const orderFormSlot = (
    <>
            <div className={`bg-white/80 backdrop-blur-md rounded-2xl sm:rounded-3xl p-4 sm:p-8 shadow-[0_20px_50px_rgba(0,0,0,0.06)] border border-slate-100 relative overflow-hidden ${ORDER_FORM_MIN_HEIGHT}`}>
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

                {(sizeChartData || (product.size_chart_url && product.sizes && product.sizes.length > 0)) && (
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
                {/* 1) الكمية */}
                {product.show_quantity !== false && (
                  <div className="space-y-2">
                    <Label className="text-sm font-bold text-slate-800">تعديل كمية طلبك</Label>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          const newQty = Math.max(1, quantity - 1);
                          setQuantity(newQty);
                          syncItemVariantsForQuantity(newQty);
                          setSelectedUpsellIndex(matchUpsellIndexForQuantity(newQty));
                        }}
                        className="w-12 h-12 rounded-xl border border-slate-200 bg-white flex items-center justify-center text-xl font-bold hover:bg-slate-50 active:scale-95 transition-all shadow-sm"
                      >
                        -
                      </button>
                      <span className="text-2xl font-black min-w-[50px] text-center text-slate-900">{quantity}</span>
                      <button
                        type="button"
                        onClick={() => {
                          const newQty = quantity + 1;
                          setQuantity(newQty);
                          syncItemVariantsForQuantity(newQty);
                          setSelectedUpsellIndex(matchUpsellIndexForQuantity(newQty));
                        }}
                        className="w-12 h-12 rounded-xl border border-slate-200 bg-white flex items-center justify-center text-xl font-bold hover:bg-slate-50 active:scale-95 transition-all shadow-sm"
                      >
                        +
                      </button>
                    </div>
                    {(quantity > 1 || selectedUpsellIndex !== null || deliveryFee > 0) && (
                      <p className="text-sm font-bold text-primary bg-primary/5 border border-primary/10 px-4 py-2 rounded-xl">
                        💰 الإجمالي المستحق للطلب: {orderTotalDisplay.toFixed(2)}{" "}
                        {storeSettings.currency_symbol}
                        {deliveryFee > 0 && (
                          <span className="block text-xs text-muted-foreground mt-1 font-normal">
                            (منتج {orderProductSubtotal.toFixed(2)} + توصيل {deliveryFee.toFixed(2)})
                          </span>
                        )}
                      </p>
                    )}
                  </div>
                )}

                {/* 2) عروض Upsell */}
                {hasUpsellOffers && (
                  <div className="space-y-3 p-4 rounded-2xl border-2 border-amber-500/20 bg-amber-500/[0.02] shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 left-0 bg-amber-500 text-[#0f172a] text-[9px] font-black px-3 py-1 rounded-br-xl uppercase tracking-wider">
                      موصى به
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <Gift className="w-4 h-4 text-amber-600 shrink-0" />
                      <Label className="text-sm font-black text-amber-700">
                        {product.upsell_title || "🎁 عروض خاصة"}
                      </Label>
                    </div>
                    <div className="space-y-2.5">
                      {product.upsell_offers!.map((offer, idx) => {
                        const selected = selectedUpsellIndex === idx;
                        return (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => {
                              if (selected) {
                                setSelectedUpsellIndex(null);
                                setQuantity(1);
                                syncItemVariantsForQuantity(1);
                              } else {
                                setSelectedUpsellIndex(idx);
                                setQuantity(Number(offer.quantity) || 1);
                                syncItemVariantsForQuantity(Number(offer.quantity) || 1);
                              }
                            }}
                            className={`w-full text-right p-3.5 rounded-xl border-2 transition-all duration-300 flex items-center justify-between gap-3 ${
                              selected
                                ? "border-amber-500 bg-amber-500 text-slate-950 shadow-md"
                                : "border-slate-200 bg-white hover:border-amber-500/50 hover:bg-amber-500/[0.01]"
                            }`}
                          >
                            <div
                              className={`w-6 h-6 rounded-full flex items-center justify-center border shrink-0 ${
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
                              className={`text-base sm:text-xl font-black shrink-0 ${selected ? "text-slate-950" : "text-amber-600"}`}
                            >
                              {offer.price} {storeSettings.currency_symbol}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* 3) تخصيص المتغير لكل قطعة — أسفل العروض */}
                {showVariantPickersUI &&
                  itemVariants.map((item, index) => (
                    <div
                      key={index}
                      className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-3.5 shadow-sm"
                    >
                      <div className="text-sm font-bold text-slate-800">
                        {quantity > 1 ? `تخصيص القطعة ${index + 1}` : "اختر المتغير"}
                      </div>

                      {useCodeVariantPickers && (
                        <div className="space-y-1.5">
                          <Label className="text-xs font-bold text-slate-600">اسم المتغير:</Label>
                          <div className="flex flex-wrap gap-2">
                            {variantKeys.map((key) => {
                              const selected = item.productCode === key;
                              const outOfStock = isCodeKeyOutOfStock(product, key, strictStockEnabled);
                              return (
                                <button
                                  key={key}
                                  type="button"
                                  aria-disabled={outOfStock}
                                  title={outOfStock ? OUT_OF_STOCK_MESSAGE : undefined}
                                  onClick={() => {
                                    if (outOfStock) {
                                      notifyOutOfStock();
                                      return;
                                    }
                                    const parsed = parseVariantKey(key, product);
                                    const newVariants = [...itemVariants];
                                    newVariants[index] = parsed;
                                    setItemVariants(newVariants);
                                  }}
                                  className={variantButtonClass(selected, outOfStock)}
                                >
                                  {key}
                                  {outOfStock && (
                                    <span className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                      <X className="w-4 h-4 text-red-500 stroke-[3]" />
                                    </span>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {useColorSizePickers && product.colors && product.colors.length > 0 && (
                        <div className="space-y-1.5">
                          <Label className="text-xs font-bold text-slate-600">
                            {quantity > 1 ? "اللون المفضل للقطعة" : "اللون:"}
                          </Label>
                          <div className="flex flex-wrap gap-2">
                            {product.colors.map((color) => {
                              const outOfStock = isColorOptionOutOfStock(
                                product,
                                color,
                                item,
                                strictStockEnabled,
                              );
                              return (
                              <button
                                key={color}
                                type="button"
                                aria-disabled={outOfStock}
                                title={outOfStock ? OUT_OF_STOCK_MESSAGE : undefined}
                                onClick={() => {
                                  if (outOfStock) {
                                    notifyOutOfStock();
                                    return;
                                  }
                                  const newVariants = [...itemVariants];
                                  newVariants[index] = { ...newVariants[index], color };
                                  setItemVariants(newVariants);
                                }}
                                className={variantButtonClass(item.color === color, outOfStock)}
                              >
                                {color}
                                {outOfStock && (
                                  <span className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                    <X className="w-4 h-4 text-red-500 stroke-[3]" />
                                  </span>
                                )}
                              </button>
                            );
                            })}
                          </div>
                        </div>
                      )}

                      {useColorSizePickers && product.sizes && product.sizes.length > 0 && (
                        <div className="space-y-1.5">
                          <Label className="text-xs font-bold text-slate-600">
                            {quantity > 1 ? "المقاس المناسب للقطعة" : "المقاس:"}
                          </Label>
                          <div className="flex flex-wrap gap-2">
                            {product.sizes.map((size) => {
                              const outOfStock = isSizeOptionOutOfStock(
                                product,
                                size,
                                item,
                                strictStockEnabled,
                              );
                              return (
                              <button
                                key={size}
                                type="button"
                                aria-disabled={outOfStock}
                                title={outOfStock ? OUT_OF_STOCK_MESSAGE : undefined}
                                onClick={() => {
                                  if (outOfStock) {
                                    notifyOutOfStock();
                                    return;
                                  }
                                  const newVariants = [...itemVariants];
                                  newVariants[index] = { ...newVariants[index], size };
                                  setItemVariants(newVariants);
                                }}
                                className={variantButtonClass(item.size === size, outOfStock)}
                              >
                                {size}
                                {outOfStock && (
                                  <span className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                    <X className="w-4 h-4 text-red-500 stroke-[3]" />
                                  </span>
                                )}
                              </button>
                            );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}

                {/* حقول نموذج البيانات للزبون — فقط الحقول المفعّلة في إعدادات المتجر */}
                {formFieldsLoaded && activeFormFields.length > 0 && (
                  <LandingOrderFormFields
                    fields={activeFormFields}
                    values={formData}
                    onChange={handleInputChange}
                    deliveryPrices={deliveryPrices}
                    currencySymbol={storeSettings.currency_symbol}
                  />
                )}

                {showOrderTotalSummary && product.show_quantity === false && (
                  <p className="text-sm font-bold text-primary bg-primary/5 border border-primary/10 px-4 py-2 rounded-xl">
                    💰 الإجمالي المستحق للطلب: {orderTotalDisplay.toFixed(2)}{" "}
                    {storeSettings.currency_symbol}
                    {deliveryFee > 0 && (
                      <span className="block text-xs text-muted-foreground mt-1 font-normal">
                        (منتج {orderProductSubtotal.toFixed(2)} + توصيل {deliveryFee.toFixed(2)})
                      </span>
                    )}
                  </p>
                )}

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
    </>
  );
  const productDescriptionSlot = (
    <>
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
              className="prose prose-sm sm:prose-lg max-w-none text-slate-700 leading-relaxed break-words [&_p]:mb-5 [&_strong]:text-slate-900 [&_strong]:font-black [&_ul]:list-disc [&_ul]:mr-5 [&_ul]:mb-5 [&_li]:mb-2 [&_img]:rounded-2xl [&_img]:shadow-lg [&_img]:my-6 [&_img]:object-contain [&_img]:max-w-full [&_img]:h-auto"
              dangerouslySetInnerHTML={{ __html: sanitizedDescription }}
            />
          </section>
        )}
    </>
  );
  const productReviewsSlot = (
    <>
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
    </>
  );
  const productFaqSlot = (
    <>
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
    </>
  );

  return (
    <StoreThemeScope tokens={storeSettings.theme_tokens} customCss={storeSettings.theme_custom_css}>
    <div
      className="min-h-screen w-full text-slate-900 font-cairo overflow-x-hidden pb-[calc(7rem+env(safe-area-inset-bottom))]"
      dir="rtl"
      style={{ background: "hsl(var(--store-bg))", color: "hsl(var(--store-fg))" }}
    >
      {/* خلفية تزيينية راقية من الإضاءات الخفيفة والناعمة */}
      <div className="absolute top-0 right-0 left-0 h-[600px] bg-gradient-to-b from-amber-500/5 via-primary/5 to-transparent -z-10 pointer-events-none" />

      {/* ترويسة المتجر الفخمة والثابتة بالقمة */}
      <StoreHeader ownerId={product?.owner_id} seeded={seedTrusted} initialSettings={ssrSeed?.header ?? undefined} />

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

      {!puckHasContent && heroSlot}

      {puckHasContent ? (
        <Suspense
          fallback={
            <div className="flex justify-center py-16">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          }
        >
          <PuckRender
            data={puckData}
            ctx={puckCtx}
          slots={{
            hero: heroSlot,
            productImages: productImagesSlot,
            orderForm: orderFormSlot,
            productDescription: productDescriptionSlot,
            productReviews: productReviewsSlot,
            productFaq: productFaqSlot,
          }}
        />
        </Suspense>
      ) : (
      <main className="w-full max-w-6xl mx-auto px-3 sm:px-6 py-6 sm:py-12">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
          <div className={product.order_form_on_top ? "order-2 lg:order-1" : ""}>
              {productImagesSlot}
          </div>
          <div className={`lg:sticky lg:top-24 h-fit ${product.order_form_on_top ? "order-1 lg:order-2" : ""}`}>
              {orderFormSlot}
          </div>
        </div>
        {productDescriptionSlot}
        {productReviewsSlot}
        {productFaqSlot}
      </main>
      )}

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
          <LandingImage
            src={product.images[selectedImage]}
            alt={product.name}
            width={1200}
            height={1200}
            sizes="100vw"
            className="max-w-full max-h-full object-contain rounded-2xl shadow-2xl p-2"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {/* دليل المقاسات ومودال العرض */}
      {showSizeChart && (sizeChartData || product.size_chart_url) && (
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

          {sizeChartData ? (
            <div
              className="max-w-2xl w-full max-h-[85vh] overflow-auto bg-white rounded-2xl shadow-2xl"
              onClick={(e) => e.stopPropagation()}
              dir="rtl"
            >
              <div className="px-5 py-4 border-b bg-gradient-to-l from-amber-50 to-white">
                <h3 className="text-lg font-black text-slate-900">{sizeChartData.title || "جدول المقاسات"}</h3>
                {sizeChartData.description && (
                  <p className="text-xs text-slate-500 mt-1">{sizeChartData.description}</p>
                )}
              </div>
              <div className="p-4 overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-slate-50">
                      {sizeChartData.columns.map((col, i) => (
                        <th key={i} className="px-3 py-2 text-right font-bold text-slate-700 border border-slate-200">
                          {col || `عمود ${i + 1}`}
                        </th>
                      ))}
                      {sizeChartData.rows.some((r) => r.note) && (
                        <th className="px-3 py-2 text-right font-bold text-slate-700 border border-slate-200">ملاحظة</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {sizeChartData.rows.map((row, ri) => (
                      <tr key={ri} className="even:bg-slate-50/50">
                        {sizeChartData.columns.map((_, ci) => (
                          <td key={ci} className="px-3 py-2 text-right text-slate-800 border border-slate-200">
                            {row.values[ci] ?? ""}
                          </td>
                        ))}
                        {sizeChartData.rows.some((r) => r.note) && (
                          <td className="px-3 py-2 text-right text-slate-600 text-xs border border-slate-200">
                            {row.note ?? ""}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <img
              src={product.size_chart_url!}
              alt="جدول المقاسات ودليل العميل"
              className="max-w-full max-h-full object-contain bg-white rounded-2xl p-4 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
          )}
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
    </StoreThemeScope>
  );
};

export default LandingPage;
