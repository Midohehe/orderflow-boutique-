import type { ThemePackage } from "./types";
import {
  buildFlashSaleLanding,
  buildProductLandingLayout,
  buildStoreHomeLayout,
} from "./themePuckLayouts";

const BASE_CSS = `
.store-theme-scope .product-card { transition: transform 0.2s ease, box-shadow 0.2s ease; }
.store-theme-scope .product-card:hover { transform: translateY(-4px); }
.store-theme-scope input, .store-theme-scope select, .store-theme-scope textarea {
  border-radius: var(--store-radius);
  border-color: hsl(var(--store-border));
}
.store-theme-scope .order-form-section {
  background: hsl(var(--store-card));
  border-radius: var(--store-section-radius);
  box-shadow: var(--store-shadow);
}
`.trim();

function pkg(
  partial: Omit<ThemePackage, "version" | "storeHome" | "productLanding"> & {
    storeHomeOpts?: Parameters<typeof buildStoreHomeLayout>[1];
    productOpts?: Parameters<typeof buildProductLandingLayout>[1];
    extraLanding?: ThemePackage["landingTemplates"];
  }
): ThemePackage {
  return {
    version: 1,
    storeHome: buildStoreHomeLayout(partial.tokens, partial.storeHomeOpts),
    productLanding: buildProductLandingLayout(partial.tokens, partial.productOpts),
    landingTemplates: partial.extraLanding ?? [
      {
        name: `قالب منتج — ${partial.nameAr}`,
        description: "صفحة هبوط منتج جاهزة للتعديل",
        puckData: buildProductLandingLayout(partial.tokens, partial.productOpts),
        isDefault: true,
      },
      {
        name: `تخفيضات — ${partial.nameAr}`,
        description: "صفحة عروض سريعة",
        puckData: buildFlashSaleLanding(partial.tokens),
      },
    ],
    ...partial,
    customCss: [BASE_CSS, partial.customCss].filter(Boolean).join("\n"),
  };
}

export const THEME_CATALOG: ThemePackage[] = [
  pkg({
    id: "luxe-noir",
    name: "Luxe Noir",
    nameAr: "فخامة سوداء",
    description: "ثيم فاخر بأسود وذهبي — للمجوهرات والعطور والمنتجات الراقية",
    category: "luxury",
    tags: ["فاخر", "ذهبي", "أنيق"],
    previewGradient: "linear-gradient(135deg, #1a1a1a 0%, #c9a227 100%)",
    tokens: {
      preset: "luxe-noir",
      primary: "43 74% 49%",
      primaryForeground: "0 0% 5%",
      accent: "43 60% 38%",
      secondary: "0 0% 12%",
      background: "0 0% 4%",
      foreground: "0 0% 96%",
      card: "0 0% 8%",
      cardForeground: "0 0% 96%",
      muted: "0 0% 12%",
      mutedForeground: "0 0% 65%",
      border: "0 0% 18%",
      headerBg: "0 0% 6%",
      buttonRadius: "0.25rem",
      sectionRadius: "0.5rem",
      fontFamily: "Cairo, sans-serif",
      headingFont: "Fraunces, Cairo, serif",
      buttonStyle: "solid",
      headerStyle: "blur",
      shadow: "strong",
    },
    customCss: ".store-theme-scope .store-heading { color: hsl(43 74% 49%); }",
    storeHomeOpts: {
      promoText: "✨ تشكيلة حصرية — شحن مجاني للطلبات فوق 500 د.ل",
      heroTitle: "فخامة تليق بك",
      heroSubtitle: "منتجات راقية مختارة بعناية",
    },
    productOpts: { heroTitle: "امتلك قطعة فريدة اليوم" },
  }),
  pkg({
    id: "bloom-beauty",
    name: "Bloom Beauty",
    nameAr: "زهرة الجمال",
    description: "وردي ناعم — للمكياج والعناية والأزياء النسائية",
    category: "beauty",
    tags: ["جمال", "مكياج", "وردي"],
    previewGradient: "linear-gradient(135deg, #fce7f3 0%, #db2777 100%)",
    tokens: {
      preset: "bloom-beauty",
      primary: "330 81% 60%",
      primaryForeground: "0 0% 100%",
      accent: "350 89% 60%",
      secondary: "330 50% 95%",
      background: "330 30% 98%",
      foreground: "330 25% 15%",
      card: "0 0% 100%",
      cardForeground: "330 25% 15%",
      muted: "330 30% 95%",
      mutedForeground: "330 15% 45%",
      border: "330 20% 90%",
      headerBg: "0 0% 100%",
      buttonRadius: "2rem",
      sectionRadius: "1.25rem",
      fontFamily: "Tajawal, Cairo, sans-serif",
      headingFont: "Tajawal, Cairo, sans-serif",
      buttonStyle: "gradient",
      headerStyle: "solid",
      shadow: "soft",
    },
    storeHomeOpts: {
      promoText: "💄 عروض الجمال — خصم 15% على أول طلب",
      heroTitle: "جمالك يبدأ من هنا",
    },
  }),
  pkg({
    id: "tech-pulse",
    name: "Tech Pulse",
    nameAr: "نبض التقنية",
    description: "أزرق عصري — للإلكترونيات والإكسسوارات",
    category: "electronics",
    tags: ["تقنية", "إلكترونيات"],
    previewGradient: "linear-gradient(135deg, #0ea5e9 0%, #1e3a8a 100%)",
    tokens: {
      preset: "tech-pulse",
      primary: "199 89% 48%",
      primaryForeground: "0 0% 100%",
      accent: "217 91% 50%",
      secondary: "199 50% 94%",
      background: "210 25% 98%",
      foreground: "222 47% 11%",
      card: "0 0% 100%",
      cardForeground: "222 47% 11%",
      muted: "210 20% 94%",
      mutedForeground: "215 15% 42%",
      border: "214 20% 88%",
      headerBg: "0 0% 100%",
      buttonRadius: "0.5rem",
      sectionRadius: "0.75rem",
      fontFamily: "'IBM Plex Sans Arabic', Cairo, sans-serif",
      headingFont: "'IBM Plex Sans Arabic', Cairo, sans-serif",
      buttonStyle: "gradient",
      headerStyle: "solid",
      shadow: "medium",
    },
    storeHomeOpts: {
      promoText: "📱 أحدث الإلكترونيات — ضمان سنة",
      heroTitle: "تقنية بأفضل سعر",
    },
  }),
  pkg({
    id: "fresh-market",
    name: "Fresh Market",
    nameAr: "سوق الطازج",
    description: "أخضر طبيعي — للأغذية والمنتجات الصحية",
    category: "food",
    tags: ["طعام", "عضوي"],
    previewGradient: "linear-gradient(135deg, #dcfce7 0%, #15803d 100%)",
    tokens: {
      preset: "fresh-market",
      primary: "142 76% 36%",
      primaryForeground: "0 0% 100%",
      accent: "160 84% 30%",
      secondary: "140 40% 93%",
      background: "120 20% 98%",
      foreground: "140 30% 12%",
      card: "0 0% 100%",
      cardForeground: "140 30% 12%",
      muted: "140 20% 94%",
      mutedForeground: "140 15% 40%",
      border: "140 15% 88%",
      headerBg: "0 0% 100%",
      buttonRadius: "0.875rem",
      sectionRadius: "1rem",
      fontFamily: "Almarai, Cairo, sans-serif",
      headingFont: "Almarai, Cairo, sans-serif",
      buttonStyle: "solid",
      headerStyle: "solid",
      shadow: "soft",
    },
    storeHomeOpts: {
      promoText: "🥬 منتجات طازجة — توصيل يومي",
      heroTitle: "من المزرعة إلى بابك",
    },
  }),
  pkg({
    id: "street-fashion",
    name: "Street Fashion",
    nameAr: "ستريت فاشن",
    description: "جريء وعصري — للأزياء الشبابية",
    category: "fashion",
    tags: ["أزياء", "ستريت"],
    previewGradient: "linear-gradient(135deg, #18181b 0%, #f97316 100%)",
    tokens: {
      preset: "street-fashion",
      primary: "25 95% 53%",
      primaryForeground: "0 0% 100%",
      accent: "0 0% 9%",
      secondary: "0 0% 96%",
      background: "0 0% 98%",
      foreground: "0 0% 9%",
      card: "0 0% 100%",
      cardForeground: "0 0% 9%",
      muted: "0 0% 94%",
      mutedForeground: "0 0% 40%",
      border: "0 0% 88%",
      headerBg: "0 0% 100%",
      buttonRadius: "0.25rem",
      sectionRadius: "0.25rem",
      fontFamily: "Cairo, sans-serif",
      headingFont: "Cairo, sans-serif",
      buttonStyle: "solid",
      headerStyle: "solid",
      shadow: "medium",
    },
    storeHomeOpts: {
      promoText: "👟 DROP جديد — كميات محدودة",
      heroTitle: "أسلوبك.. هويتك",
    },
  }),
  pkg({
    id: "ramadan-gold",
    name: "Ramadan Gold",
    nameAr: "رمضان ذهبي",
    description: "أخضر وذهبي — للعروض الموسمية",
    category: "promo",
    tags: ["رمضان", "عروض"],
    previewGradient: "linear-gradient(135deg, #065f46 0%, #d97706 100%)",
    tokens: {
      preset: "ramadan-gold",
      primary: "160 84% 25%",
      primaryForeground: "0 0% 100%",
      accent: "38 92% 50%",
      secondary: "160 30% 92%",
      background: "45 30% 97%",
      foreground: "160 30% 12%",
      card: "0 0% 100%",
      cardForeground: "160 30% 12%",
      muted: "45 25% 93%",
      mutedForeground: "160 15% 38%",
      border: "45 20% 85%",
      headerBg: "160 84% 20%",
      buttonRadius: "0.75rem",
      sectionRadius: "1rem",
      fontFamily: "Tajawal, Cairo, sans-serif",
      headingFont: "Tajawal, Cairo, sans-serif",
      buttonStyle: "gradient",
      headerStyle: "solid",
      shadow: "medium",
    },
    customCss: ".store-theme-scope .store-header-solid { color: #fff; }",
    storeHomeOpts: {
      promoText: "🌙 عروض رمضان — خصومات حتى 40%",
      heroTitle: "رمضان كريم",
    },
  }),
  pkg({
    id: "minimal-studio",
    name: "Minimal Studio",
    nameAr: "استوديو Minimal",
    description: "نظيف وبسيط — مثل ثيمات Shopify Minimal",
    category: "minimal",
    tags: ["minimal", "نظيف"],
    previewGradient: "linear-gradient(135deg, #fafafa 0%, #171717 100%)",
    tokens: {
      preset: "minimal-studio",
      primary: "0 0% 9%",
      primaryForeground: "0 0% 100%",
      accent: "0 0% 25%",
      secondary: "0 0% 96%",
      background: "0 0% 100%",
      foreground: "0 0% 9%",
      card: "0 0% 100%",
      cardForeground: "0 0% 9%",
      muted: "0 0% 97%",
      mutedForeground: "0 0% 45%",
      border: "0 0% 92%",
      headerBg: "0 0% 100%",
      buttonRadius: "0.375rem",
      sectionRadius: "0.375rem",
      fontFamily: "'IBM Plex Sans Arabic', Cairo, sans-serif",
      headingFont: "'IBM Plex Sans Arabic', Cairo, sans-serif",
      buttonStyle: "outline",
      headerStyle: "solid",
      shadow: "none",
    },
    storeHomeOpts: { heroTitle: "Less is More" },
  }),
  pkg({
    id: "ocean-pro",
    name: "Ocean Pro",
    nameAr: "محيط Pro",
    description: "متوازن لكل أنواع المتاجر",
    category: "general",
    tags: ["عام", "احترافي"],
    previewGradient: "linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)",
    tokens: {
      preset: "ocean-pro",
      primary: "217 91% 50%",
      primaryForeground: "0 0% 100%",
      accent: "217 91% 40%",
      secondary: "217 40% 92%",
      background: "220 20% 97%",
      foreground: "222 47% 11%",
      card: "0 0% 100%",
      cardForeground: "222 47% 11%",
      muted: "220 14% 94%",
      mutedForeground: "220 10% 40%",
      border: "220 13% 88%",
      headerBg: "0 0% 100%",
      buttonRadius: "0.75rem",
      sectionRadius: "1rem",
      fontFamily: "Cairo, system-ui, sans-serif",
      headingFont: "Cairo, system-ui, sans-serif",
      buttonStyle: "gradient",
      headerStyle: "solid",
      shadow: "soft",
    },
  }),
];

export function getThemeById(id: string): ThemePackage | undefined {
  return THEME_CATALOG.find((t) => t.id === id);
}

export function parseThemePackageJson(raw: unknown): ThemePackage | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (o.version !== 1) return null;
  if (typeof o.id !== "string" || typeof o.nameAr !== "string") return null;
  if (!o.tokens || typeof o.tokens !== "object") return null;
  return raw as ThemePackage;
}

export function parseExportedThemeJson(raw: unknown): import("./types").ExportedStoreTheme | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (o.version !== 1 || !o.tokens) return null;
  return raw as import("./types").ExportedStoreTheme;
}
