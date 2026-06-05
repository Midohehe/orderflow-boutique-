import type { StoreThemeTokens } from "@/lib/themeTokens";
import {
  buildFashionProductLandingLayout,
  buildFashionStoreHomeLayout,
  type FashionStoreLayoutConfig,
} from "./themePuckLayouts";
import type { ExportedStoreTheme } from "./types";

export const VIBRANT_BOUTIQUE_TOKENS: StoreThemeTokens = {
  preset: "vibrant-boutique",
  primary: "280 85% 58%",
  primaryForeground: "0 0% 100%",
  accent: "340 88% 55%",
  secondary: "168 72% 42%",
  background: "270 45% 98%",
  foreground: "260 28% 12%",
  card: "0 0% 100%",
  cardForeground: "260 28% 12%",
  muted: "270 35% 95%",
  mutedForeground: "260 15% 42%",
  border: "270 20% 90%",
  headerBg: "0 0% 100%",
  buttonRadius: "1.25rem",
  sectionRadius: "1.5rem",
  fontFamily: "Cairo, 'Outfit', system-ui, sans-serif",
  headingFont: "Cairo, 'Outfit', system-ui, sans-serif",
  buttonStyle: "gradient",
  headerStyle: "blur",
  shadow: "medium",
};

export const VIBRANT_BOUTIQUE_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&family=Outfit:wght@400;600;700;800&display=swap');
.store-theme-scope {
  letter-spacing: -0.01em;
}
.store-theme-scope h1, .store-theme-scope h2, .store-theme-scope h3, .store-theme-scope .store-heading {
  letter-spacing: -0.03em;
  font-weight: 800;
}
.store-theme-scope .fashion-btn-primary,
.store-theme-scope a.fashion-btn-primary,
.store-theme-scope button.fashion-btn-primary,
.store-theme-scope .store-btn-gradient {
  background: linear-gradient(135deg, hsl(var(--store-primary)), hsl(var(--store-accent))) !important;
  color: hsl(var(--store-primary-fg)) !important;
  border-radius: var(--store-radius);
  box-shadow: 0 10px 28px hsl(var(--store-primary) / 0.25);
  transition: all 0.35s cubic-bezier(0.16, 1, 0.3, 1);
  font-weight: 700;
  border: none;
}
.store-theme-scope .fashion-btn-primary:hover,
.store-theme-scope .store-btn-gradient:hover {
  transform: translateY(-3px) scale(1.02);
  box-shadow: 0 16px 40px hsl(var(--store-accent) / 0.35);
  filter: brightness(1.05);
}
.store-theme-scope .fashion-btn-secondary,
.store-theme-scope a.fashion-btn-secondary {
  background: hsl(var(--store-card));
  color: hsl(var(--store-primary));
  border: 2px solid hsl(var(--store-primary) / 0.35);
  border-radius: var(--store-radius);
  transition: all 0.35s ease;
  font-weight: 700;
  text-decoration: none;
}
.store-theme-scope .fashion-btn-secondary:hover {
  background: hsl(var(--store-primary) / 0.08);
  border-color: hsl(var(--store-primary));
  transform: translateY(-2px);
}
.store-theme-scope .fashion-btn-glass,
.store-theme-scope a.fashion-btn-glass {
  background: rgba(255,255,255,0.12);
  backdrop-filter: blur(16px);
  color: #fff;
  border: 1px solid rgba(255,255,255,0.35);
  border-radius: var(--store-radius);
  transition: all 0.3s ease;
}
.store-theme-scope .fashion-btn-glass:hover {
  background: rgba(255,255,255,0.22);
  transform: translateY(-2px);
}
.store-theme-scope .product-card, .store-theme-scope .fashion-product-card, .store-theme-scope .store-card {
  border-radius: var(--store-section-radius);
  border: 1px solid hsl(var(--store-border));
  background: hsl(var(--store-card));
  transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.4s ease;
  overflow: hidden;
}
.store-theme-scope .product-card:hover, .store-theme-scope .fashion-product-card:hover {
  transform: translateY(-10px);
  box-shadow: 0 20px 48px hsl(var(--store-primary) / 0.18);
  border-color: hsl(var(--store-accent) / 0.3);
}
.store-theme-scope .product-image {
  transition: transform 0.65s cubic-bezier(0.16, 1, 0.3, 1);
}
.store-theme-scope .product-card:hover .product-image {
  transform: scale(1.06);
}
.store-theme-scope .fashion-category-pill {
  background: linear-gradient(145deg, hsl(var(--store-primary) / 0.06), hsl(var(--store-accent) / 0.04));
  border: 1px solid hsl(var(--store-border));
  border-radius: 1.25rem;
  transition: all 0.35s ease;
}
.store-theme-scope .fashion-category-pill:hover {
  background: linear-gradient(135deg, hsl(var(--store-primary)), hsl(var(--store-accent)));
  color: #fff;
  transform: translateY(-4px);
  box-shadow: 0 12px 32px hsl(var(--store-primary) / 0.25);
}
.store-theme-scope .fashion-hero-highlight {
  background: linear-gradient(90deg, hsl(var(--store-accent)), hsl(var(--store-secondary)), hsl(var(--store-primary)));
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}
.store-theme-scope .fashion-footer {
  background: linear-gradient(165deg, hsl(var(--store-fg)), hsl(260 28% 18%));
}
@keyframes vibrant-rise {
  from { opacity: 0; transform: translateY(24px); }
  to { opacity: 1; transform: translateY(0); }
}
.store-theme-scope .animate-fade-in, .store-theme-scope [class*="fade-in"] {
  animation: vibrant-rise 0.85s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}
`.trim();

export const VIBRANT_BOUTIQUE_LAYOUT: FashionStoreLayoutConfig = {
  promoText: "🎨 تشكيلة 2026 — ألوان جريئة وتصاميم عصرية",
  heroImage:
    "https://images.unsplash.com/photo-1445205170230-053b83016050?ixlib=rb-4.0.3&auto=format&fit=crop&w=2000&q=80",
  editorialImage:
    "https://images.unsplash.com/photo-1469334031218-e382a71b716b?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80",
  eyebrow: "وصل حديثاً — 2026",
  heroTitle: "أسلوبك",
  heroTitleHighlight: "بلمسة عصرية",
  heroSubtitle:
    "متجر عصري بألوان حيوية وتجربة تسوق سلسة — منتجات مختارة، توصيل سريع، ودفع عند الاستلام.",
  buttonText: "تسوق الآن",
  buttonText2: "استكشف المجموعة",
  categoryPills: [
    { count: "150+", label: "منتج جديد" },
    { count: "24h", label: "شحن سريع" },
    { count: "COD", label: "دفع عند الاستلام" },
    { count: "30%", label: "عروض الأسبوع" },
  ],
  productsEyebrow: "الأكثر مبيعاً",
  productsTitle: "منتجات مميزة",
  viewAllText: "عرض كل المنتجات",
  seasonLabel: "تصميم عصري",
  editorialTitle: "تجربة تسوق",
  editorialHighlight: "بلا حدود.",
  editorialBody:
    "نصمم متجرك ليكون سريعاً، واضحاً، وجذاباً — مساحات بيضاء سخية، بطاقات ناعمة، وأزرار تحفّز على الشراء من أول نظرة.",
  editorialBullets: [
    "واجهة عصرية متجاوبة",
    "بطاقات منتجات تفاعلية",
    "CTA واضحة في كل قسم",
    "متوافق مع صفحات الهبوط",
  ],
  featuresTitle: "لماذا نحن؟",
  reviewsTitle: "آراء العملاء",
  storeName: "بوتيك",
  footerDesc: "متجر عصري — أزياء ومنتجات مختارة بعناية لتجربة تسوق استثنائية.",
  footerShopLinks: ["الأكثر مبيعاً", "وصل حديثاً", "عروض", "إكسسوارات"],
  footerNewsletterHint: "اشترك للحصول على عروض حصرية وخصومات أسبوعية.",
};

/** Build importable ExportedStoreTheme JSON for dashboard import. */
export function buildVibrantBoutiqueExport(name = "Vibrant Boutique"): ExportedStoreTheme {
  const tokens = VIBRANT_BOUTIQUE_TOKENS;
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    name,
    packageId: "vibrant-boutique",
    tokens,
    customCss: VIBRANT_BOUTIQUE_CSS,
    storeHome: buildFashionStoreHomeLayout(tokens, VIBRANT_BOUTIQUE_LAYOUT),
    landingTemplates: [
      {
        name: "قالب منتج — بوتيك عصري",
        description: "صفحة هبوط منتج بأسلوب عصري",
        isDefault: true,
        puckData: buildFashionProductLandingLayout(tokens, {
          promoText: "⚡ عرض محدود — اطلب قبل نفاد الكمية",
          heroImage: VIBRANT_BOUTIQUE_LAYOUT.heroImage,
          eyebrow: "عرض حصري",
          heroTitle: "منتج",
          heroTitleHighlight: "يستحق التجربة",
          heroSubtitle: "جودة • شحن سريع • الدفع عند الاستلام",
          buttonText: "اطلب الآن",
          buttonText2: "التفاصيل",
        }),
      },
      {
        name: "تخفيضات — بوتيك",
        description: "صفحة عروض",
        puckData: {
          content: [
            {
              type: "Heading",
              props: {
                id: "vib-h1",
                text: "🔥 عروض الأسبوع",
                tag: "h1",
                size: 42,
                weight: 800,
                color: "hsl(280 85% 58%)",
                letter_spacing: -1,
                line_height: 1.2,
                padding_top: 48,
                padding_bottom: 16,
                text_align: "center",
                max_width: "container",
              },
            },
            {
              type: "ProductsGrid",
              props: {
                id: "vib-pg",
                title: "منتجات العرض",
                limit: 8,
                columns: 4,
                card_style: "fashion",
                eyebrow: "خصومات حتى 30%",
                view_all_text: "المزيد",
                view_all_link: "#products",
                padding_top: 32,
                padding_bottom: 48,
                custom_id: "products",
              },
            },
          ],
          root: { props: {} },
        },
      },
    ],
  };
}

export function buildVibrantBoutiqueStoreHome() {
  return buildFashionStoreHomeLayout(VIBRANT_BOUTIQUE_TOKENS, VIBRANT_BOUTIQUE_LAYOUT);
}

export function buildVibrantBoutiqueProductLanding() {
  return buildFashionProductLandingLayout(VIBRANT_BOUTIQUE_TOKENS, {
    promoText: "⚡ عرض محدود — اطلب قبل نفاد الكمية",
    heroImage: VIBRANT_BOUTIQUE_LAYOUT.heroImage,
    eyebrow: "عرض حصري",
    heroTitle: "منتج",
    heroTitleHighlight: "يستحق التجربة",
    buttonText: "اطلب الآن",
  });
}
