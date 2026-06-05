import type { ThemePackage } from "./types";
import {
  buildAuraMensStoreHomeLayout,
  buildFashionProductLandingLayout,
  buildFashionStoreHomeLayout,
  buildFlashSaleLanding,
  buildProductLandingLayout,
  buildStoreHomeLayout,
} from "./themePuckLayouts";
import { AURA_FASHION_COLORS } from "./fashionTheme";
import {
  VIBRANT_BOUTIQUE_CSS,
  VIBRANT_BOUTIQUE_TOKENS,
  buildVibrantBoutiqueProductLanding,
  buildVibrantBoutiqueStoreHome,
} from "./vibrantBoutique";

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

const AURA_FASHION_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&family=Outfit:wght@400;600;700;800;900&display=swap');
.store-theme-scope h1, .store-theme-scope h2, .store-theme-scope h3, .store-theme-scope .store-heading {
  letter-spacing: -0.03em;
  font-weight: 800;
}
.store-theme-scope .fashion-btn-primary,
.store-theme-scope a.fashion-btn-primary,
.store-theme-scope button.fashion-btn-primary {
  background: hsl(var(--store-primary));
  color: hsl(var(--store-primary-fg));
  border-radius: var(--store-radius);
  box-shadow: 0 8px 24px rgba(0,0,0,0.08);
  transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  border: none;
  cursor: pointer;
}
.store-theme-scope .fashion-btn-primary:hover {
  background: hsl(var(--store-accent));
  transform: translateY(-3px) scale(1.02);
  box-shadow: 0 12px 32px hsl(var(--store-accent) / 0.25);
  filter: brightness(1.05);
}
.store-theme-scope .fashion-btn-secondary,
.store-theme-scope a.fashion-btn-secondary {
  background: transparent;
  color: hsl(var(--store-fg));
  border: 2px solid hsl(var(--store-primary));
  border-radius: var(--store-radius);
  transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  text-decoration: none;
  display: inline-block;
}
.store-theme-scope .fashion-btn-secondary:hover {
  background: hsl(var(--store-primary) / 0.1);
  transform: translateY(-2px);
}
.store-theme-scope .fashion-btn-glass,
.store-theme-scope a.fashion-btn-glass {
  background: rgba(255,255,255,0.1);
  backdrop-filter: blur(12px);
  color: #fff;
  border: 1px solid rgba(255,255,255,0.3);
  border-radius: var(--store-radius);
  text-decoration: none;
  transition: all 0.3s ease;
}
.store-theme-scope .fashion-btn-glass:hover {
  background: rgba(255,255,255,0.2);
}
.store-theme-scope .fashion-hero {
  border-radius: 0 !important;
  min-height: min(100dvh, 820px);
}
.store-theme-scope .fashion-hero-gradient {
  background: linear-gradient(to top, hsl(var(--store-primary) / 0.35), transparent);
}
.store-theme-scope .fashion-hero-highlight {
  background: linear-gradient(to right, hsl(var(--store-accent)), hsl(var(--store-secondary)));
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}
.store-theme-scope .store-card, .store-theme-scope .product-card {
  border-radius: var(--store-section-radius);
  transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
  border: 1px solid hsl(var(--store-border));
  overflow: hidden;
  background: hsl(var(--store-card));
}
.store-theme-scope .product-card:hover, .store-theme-scope .store-card:hover,
.store-theme-scope .fashion-product-card:hover {
  transform: translateY(-8px);
  box-shadow: 0 12px 32px hsl(var(--store-accent) / 0.15);
  border-color: transparent;
}
.store-theme-scope .product-image {
  transition: transform 0.6s cubic-bezier(0.16, 1, 0.3, 1);
}
.store-theme-scope .product-card:hover .product-image,
.store-theme-scope .fashion-product-card:hover .product-image {
  transform: scale(1.08);
}
.store-theme-scope .store-btn-primary {
  text-transform: uppercase;
  letter-spacing: 0.05em;
  font-weight: 600;
  box-shadow: 0 8px 24px rgba(0,0,0,0.08);
}
.store-theme-scope .store-btn-primary:hover {
  background: hsl(var(--store-accent)) !important;
  transform: translateY(-3px) scale(1.02);
  filter: brightness(1.1);
}
.store-theme-scope .store-btn-outline:hover {
  background: hsl(var(--store-primary) / 0.1);
  transform: translateY(-2px);
}
.store-theme-scope .fashion-category-row {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 1rem;
}
.store-theme-scope .fashion-category-pill {
  background: hsl(var(--store-primary) / 0.05);
  border-radius: 1rem;
  padding: 1rem 1.5rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-width: 150px;
  cursor: pointer;
  transition: all 0.3s ease;
}
.store-theme-scope .fashion-category-pill:hover {
  background: hsl(var(--store-primary));
  color: hsl(var(--store-primary-fg));
}
.store-theme-scope .fashion-category-pill:hover .fashion-category-count,
.store-theme-scope .fashion-category-pill:hover .fashion-category-label {
  color: hsl(var(--store-primary-fg));
}
.store-theme-scope .fashion-category-count {
  font-size: 1.5rem;
  font-weight: 900;
  color: hsl(var(--store-primary));
  line-height: 1.2;
}
.store-theme-scope .fashion-category-label {
  font-size: 0.875rem;
  font-weight: 500;
  color: hsl(var(--store-muted-fg));
  margin-top: 0.25rem;
}
.store-theme-scope .fashion-footer {
  background: hsl(var(--store-fg));
  color: #fff;
  padding: 4rem 1.5rem 2rem;
}
.store-theme-scope .fashion-footer-grid {
  max-width: 1200px;
  margin: 0 auto;
  display: grid;
  grid-template-columns: 1fr;
  gap: 2.5rem;
}
@media (min-width: 768px) {
  .store-theme-scope .fashion-footer-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
@media (min-width: 1024px) {
  .store-theme-scope .fashion-footer-grid {
    grid-template-columns: repeat(4, 1fr);
  }
}
.store-theme-scope .fashion-footer-brand {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 1rem;
}
.store-theme-scope .fashion-footer-logo {
  width: 2rem;
  height: 2rem;
  border-radius: 9999px;
  background: hsl(var(--store-primary));
  color: #fff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-weight: 800;
}
.store-theme-scope .fashion-footer-name {
  font-size: 1.5rem;
  font-weight: 900;
}
.store-theme-scope .fashion-footer-desc {
  color: rgba(255,255,255,0.65);
  font-size: 0.875rem;
  line-height: 1.6;
  margin-bottom: 1rem;
}
.store-theme-scope .fashion-footer-socials {
  display: flex;
  gap: 0.75rem;
}
.store-theme-scope .fashion-footer-socials span {
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 9999px;
  background: rgba(255,255,255,0.1);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  cursor: pointer;
  transition: background 0.2s;
}
.store-theme-scope .fashion-footer-socials span:hover {
  background: hsl(var(--store-primary));
}
.store-theme-scope .fashion-footer-heading {
  font-weight: 700;
  font-size: 1.125rem;
  margin-bottom: 1rem;
}
.store-theme-scope .fashion-footer-links {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  color: rgba(255,255,255,0.65);
  font-size: 0.875rem;
}
.store-theme-scope .fashion-footer-links a {
  color: inherit;
  text-decoration: none;
  transition: color 0.2s;
}
.store-theme-scope .fashion-footer-links a:hover {
  color: #fff;
}
.store-theme-scope .fashion-footer-newsletter {
  display: flex;
  gap: 0.5rem;
}
.store-theme-scope .fashion-footer-newsletter input {
  flex: 1;
  background: rgba(255,255,255,0.1);
  border: 1px solid rgba(255,255,255,0.2);
  border-radius: 0.5rem;
  padding: 0.75rem 1rem;
  color: #fff;
}
.store-theme-scope .fashion-footer-submit {
  padding: 0.75rem 1rem !important;
  min-width: 3rem;
}
.store-theme-scope .fashion-footer-bottom {
  max-width: 1200px;
  margin: 3rem auto 0;
  padding-top: 2rem;
  border-top: 1px solid rgba(255,255,255,0.1);
  display: flex;
  flex-direction: column;
  gap: 1rem;
  align-items: center;
  justify-content: space-between;
  color: rgba(255,255,255,0.5);
  font-size: 0.875rem;
}
@media (min-width: 768px) {
  .store-theme-scope .fashion-footer-bottom {
    flex-direction: row;
  }
}
.store-theme-scope .fashion-footer-legal {
  display: flex;
  gap: 1.5rem;
}
.store-theme-scope .fashion-footer-legal a {
  color: inherit;
  text-decoration: none;
}
.store-theme-scope .fashion-footer-legal a:hover {
  color: #fff;
}
.store-theme-scope.fashion-store-layout {
  padding-top: 0;
}
.store-theme-scope.fashion-store-layout .fashion-store-header {
  position: sticky;
  top: 0;
  z-index: 40;
  background: hsl(var(--store-header-bg) / 0.92);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid hsl(var(--store-border) / 0.5);
  margin-bottom: 0;
  border-radius: 0;
}
@keyframes aura-fade-in {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}
.store-theme-scope [class*="fade-in"], .store-theme-scope .animate-fade-in {
  animation: aura-fade-in 0.8s ease-out forwards;
}
`.trim();

const AURA_FASHION_TOKENS = {
  preset: "aura-fashion",
  ...AURA_FASHION_COLORS,
  fontFamily: "'Outfit', Cairo, system-ui, sans-serif",
  headingFont: "'Outfit', Cairo, system-ui, sans-serif",
};

const AURA_MENS_TOKENS = {
  preset: "aura-mens-store",
  ...AURA_FASHION_COLORS,
  fontFamily: "Cairo, 'Outfit', system-ui, sans-serif",
  headingFont: "Cairo, 'Outfit', system-ui, sans-serif",
};

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
    id: "aura-fashion",
    name: "Aura Fashion",
    nameAr: "أورا فاشن",
    description: "بنفسجي ووردي عصري — للأزياء والموضة مع هيرو كامل و بطاقات منتجات أنيقة",
    category: "fashion",
    tags: ["أزياء", "موضة", "أورا"],
    previewGradient: "linear-gradient(135deg, hsl(250,85%,60%) 0%, hsl(340,82%,52%) 100%)",
    tokens: AURA_FASHION_TOKENS,
    customCss: AURA_FASHION_CSS,
    storeHome: buildFashionStoreHomeLayout(AURA_FASHION_TOKENS),
    productLanding: buildFashionProductLandingLayout(AURA_FASHION_TOKENS, {
      heroTitle: "قطعة تليق",
      heroTitleHighlight: "بأناقتك",
      promoText: "✨ عرض حصري — اطلبي الآن قبل نفاد الكمية",
      buttonText: "اطلبي الآن",
    }),
    extraLanding: [
      {
        name: "قالب منتج — أورا فاشن",
        description: "صفحة هبوط منتج بأسلوب AURA",
        puckData: buildFashionProductLandingLayout(AURA_FASHION_TOKENS, {
          heroTitle: "اطلبي الآن",
          heroTitleHighlight: "عرض حصري",
          promoText: "✨ عرض محدود — اطلبي الآن",
          buttonText: "اطلبي الآن",
        }),
        isDefault: true,
      },
      {
        name: "تخفيضات — أورا فاشن",
        description: "صفحة عروض سريعة",
        puckData: buildFlashSaleLanding(AURA_FASHION_TOKENS),
      },
    ],
  }),
  pkg({
    id: "aura-mens-store",
    name: "Aura Store",
    nameAr: "أورا — متجر الأزياء",
    description: "ثيم AURA v3 كامل بالعربية — أزياء رجالية، هيرو، بطاقات، فوتر، وأزرار متكاملة مع المتجر",
    category: "fashion",
    tags: ["أزياء", "رجالي", "AURA", "عربي"],
    previewGradient: "linear-gradient(135deg, hsl(250,85%,60%) 0%, hsl(45,93%,60%) 50%, hsl(340,82%,52%) 100%)",
    tokens: AURA_MENS_TOKENS,
    customCss: AURA_FASHION_CSS,
    storeHome: buildAuraMensStoreHomeLayout(AURA_MENS_TOKENS),
    productLanding: buildFashionProductLandingLayout(AURA_MENS_TOKENS),
    extraLanding: [
      {
        name: "قالب منتج — أورا",
        description: "صفحة هبوط منتج بأسلوب AURA v3",
        puckData: buildFashionProductLandingLayout(AURA_MENS_TOKENS),
        isDefault: true,
      },
      {
        name: "تخفيضات — أورا",
        description: "صفحة عروض سريعة",
        puckData: buildFlashSaleLanding(AURA_MENS_TOKENS),
      },
    ],
  }),
  pkg({
    id: "vibrant-boutique",
    name: "Vibrant Boutique",
    nameAr: "بوتيك عصري",
    description: "ألوان حيوية وتدرجات عصرية — مساحات واسعة، بطاقات تفاعلية، وتجربة تسوق premium",
    category: "fashion",
    tags: ["عصري", "حيوي", "2026"],
    previewGradient: "linear-gradient(135deg, hsl(280,85%,58%) 0%, hsl(340,88%,55%) 50%, hsl(168,72%,42%) 100%)",
    tokens: VIBRANT_BOUTIQUE_TOKENS,
    customCss: VIBRANT_BOUTIQUE_CSS,
    storeHome: buildVibrantBoutiqueStoreHome(),
    productLanding: buildVibrantBoutiqueProductLanding(),
    extraLanding: [
      {
        name: "قالب منتج — بوتيك عصري",
        description: "صفحة هبوط منتج عصرية",
        puckData: buildVibrantBoutiqueProductLanding(),
        isDefault: true,
      },
      {
        name: "تخفيضات — بوتيك",
        description: "صفحة عروض",
        puckData: buildFlashSaleLanding(VIBRANT_BOUTIQUE_TOKENS),
      },
    ],
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
