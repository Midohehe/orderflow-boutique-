import { hslToHex } from "@/lib/themeColors";
import type { StoreThemeTokens } from "@/lib/themeTokens";
import type { PuckData } from "./types";

const STYLE = {
  padding_top: 16,
  padding_bottom: 16,
  padding_left: 0,
  padding_right: 0,
  margin_top: 0,
  margin_bottom: 0,
  max_width: "container" as const,
  min_height: 0,
  text_align: "center" as const,
  bg_color: "",
  bg_gradient: "",
  bg_image: "",
  bg_size: "cover" as const,
  border_width: 0,
  border_color: "",
  border_radius: 0,
  shadow: "none" as const,
  animation: "fade-up" as const,
  custom_class: "",
  custom_id: "",
  hide_mobile: false,
  hide_tablet: false,
  hide_desktop: false,
};

function uid(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
}

export function buildStoreHomeLayout(
  tokens: StoreThemeTokens,
  opts: { promoText?: string; heroTitle?: string; heroSubtitle?: string } = {}
): PuckData {
  const primary = hslToHex(tokens.primary || "217 91% 50%");
  const accent = hslToHex(tokens.accent || tokens.primary || "217 91% 45%");
  const bg = hslToHex(tokens.background || "220 20% 97%");

  return {
    content: [
      {
        type: "PromoBar",
        props: {
          id: uid("PromoBar"),
          text: opts.promoText || "🚚 شحن لكل المدن • 💵 الدفع عند الاستلام",
          bg: primary,
          color: "#ffffff",
          ...STYLE,
          padding_top: 0,
          padding_bottom: 0,
          max_width: "full",
          animation: "none",
        },
      },
      {
        type: "Hero",
        props: {
          id: uid("Hero"),
          image: "",
          title: opts.heroTitle || "مرحباً بكم في متجرنا",
          subtitle: opts.heroSubtitle || "تسوق أفضل المنتجات بأسعار منافسة — جودة مضمونة وتوصيل سريع",
          button_text: "تصفح المنتجات",
          button_link: "#products",
          text_color: "#ffffff",
          overlay: 0.5,
          min_height: 420,
          max_width: "full",
          bg_gradient: `linear-gradient(135deg, ${primary} 0%, ${accent} 100%)`,
          padding_top: 0,
          padding_bottom: 0,
          animation: "fade-in",
        },
      },
      {
        type: "CategoriesGrid",
        props: {
          id: uid("Categories"),
          title: "تسوق حسب الفئة",
          items: [
            { label: "الأكثر مبيعاً", image: "", link: "#" },
            { label: "وصل حديثاً", image: "", link: "#" },
            { label: "عروض خاصة", image: "", link: "#" },
            { label: "هدايا", image: "", link: "#" },
          ],
          ...STYLE,
          padding_top: 48,
          padding_bottom: 24,
        },
      },
      {
        type: "ProductsGrid",
        props: {
          id: uid("Products"),
          title: "منتجاتنا المميزة",
          limit: 8,
          columns: 4,
          ...STYLE,
          padding_top: 24,
          padding_bottom: 48,
          custom_id: "products",
        },
      },
      {
        type: "Features",
        props: {
          id: uid("Features"),
          title: "لماذا نحن؟",
          items: [
            { icon: "🚚", title: "شحن سريع", desc: "توصيل لكل مدن ليبيا" },
            { icon: "💵", title: "الدفع عند الاستلام", desc: "ادفع عند استلام طلبك" },
            { icon: "✅", title: "جودة مضمونة", desc: "منتجات أصلية 100%" },
            { icon: "💬", title: "دعم واتساب", desc: "فريقنا جاهز لمساعدتك" },
          ],
          ...STYLE,
          bg_color: bg,
          padding_top: 56,
          padding_bottom: 56,
        },
      },
      {
        type: "Reviews",
        props: {
          id: uid("Reviews"),
          title: "آراء عملائنا",
          items: [
            { name: "سارة", text: "تجربة رائعة وتوصيل سريع!", rating: 5 },
            { name: "خالد", text: "منتجات أصلية بأسعار ممتازة.", rating: 5 },
            { name: "نور", text: "أنصح بهذا المتجر بشدة.", rating: 5 },
          ],
          ...STYLE,
          padding_top: 48,
          padding_bottom: 48,
        },
      },
      {
        type: "SocialIcons",
        props: {
          id: uid("Social"),
          facebook: "",
          instagram: "",
          whatsapp: "",
          tiktok: "",
          youtube: "",
          email: "",
          size: 28,
          color: primary,
          ...STYLE,
          padding_top: 24,
          padding_bottom: 48,
        },
      },
    ],
    root: { props: {} },
  };
}

export function buildProductLandingLayout(
  tokens: StoreThemeTokens,
  opts: { heroTitle?: string; accentWord?: string } = {}
): PuckData {
  const primary = hslToHex(tokens.primary || "217 91% 50%");

  return {
    content: [
      {
        type: "PromoBar",
        props: {
          id: uid("Promo"),
          text: "⚡ عرض محدود — اطلب الآن قبل نفاد الكمية!",
          bg: primary,
          color: "#ffffff",
          ...STYLE,
          padding_top: 0,
          padding_bottom: 0,
          max_width: "full",
          animation: "none",
        },
      },
      {
        type: "Hero",
        props: {
          id: uid("Hero"),
          image: "",
          title: opts.heroTitle || "اطلب الآن واحصل على عرض حصري",
          subtitle: "جودة عالية • شحن سريع • الدفع عند الاستلام",
          button_text: "اطلب الآن",
          button_link: "#order-form",
          text_color: "#ffffff",
          overlay: 0.45,
          min_height: 360,
          max_width: "full",
          bg_gradient: `linear-gradient(160deg, ${primary} 0%, ${hslToHex(tokens.accent || tokens.primary || "217 91% 45%")} 100%)`,
          padding_top: 0,
          padding_bottom: 0,
        },
      },
      {
        type: "Countdown",
        props: {
          id: uid("Countdown"),
          title: "ينتهي العرض خلال",
          target: new Date(Date.now() + 3 * 86400000).toISOString(),
          color: primary,
          ...STYLE,
          padding_top: 24,
          padding_bottom: 24,
        },
      },
      {
        type: "ProductImages",
        props: { id: uid("Images"), ...STYLE, padding_top: 16, padding_bottom: 16 },
      },
      {
        type: "Features",
        props: {
          id: uid("Features"),
          title: opts.accentWord ? `لماذا ${opts.accentWord}؟` : "لماذا هذا المنتج؟",
          items: [
            { icon: "⭐", title: "جودة عالية", desc: "مواد ممتازة وتصنيع دقيق" },
            { icon: "🚚", title: "توصيل سريع", desc: "2-4 أيام لمعظم المدن" },
            { icon: "💵", title: "COD", desc: "ادفع عند الاستلام" },
            { icon: "🔄", title: "استبدال", desc: "سياسة استبدال مرنة" },
          ],
          ...STYLE,
          padding_top: 40,
          padding_bottom: 40,
        },
      },
      {
        type: "OrderForm",
        props: { id: uid("OrderForm"), ...STYLE, padding_top: 16, padding_bottom: 16, custom_id: "order-form" },
      },
      {
        type: "ProductDescription",
        props: { id: uid("Desc"), ...STYLE, padding_top: 24, padding_bottom: 24 },
      },
      {
        type: "Reviews",
        props: {
          id: uid("Reviews"),
          title: "ماذا يقول عملاؤنا",
          items: [
            { name: "أحمد", text: "منتج ممتاز أنصح به!", rating: 5 },
            { name: "فاطمة", text: "وصلني بسرعة والتغليف رائع.", rating: 5 },
            { name: "محمد", text: "تجربة شراء مميزة.", rating: 5 },
          ],
          ...STYLE,
          padding_top: 40,
          padding_bottom: 40,
        },
      },
      {
        type: "Faq",
        props: {
          id: uid("Faq"),
          title: "الأسئلة الشائعة",
          items: [
            { q: "هل الدفع عند الاستلام؟", a: "نعم، تدفع للمندوب عند الاستلام." },
            { q: "كم يستغرق التوصيل؟", a: "2-4 أيام حسب المدينة." },
            { q: "هل يمكن الإرجاع؟", a: "نعم خلال 7 أيام بالحالة الأصلية." },
          ],
          ...STYLE,
          padding_top: 30,
          padding_bottom: 48,
          max_width: "narrow",
        },
      },
    ],
    root: { props: {} },
  };
}

const FASHION_HERO_IMAGE =
  "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?ixlib=rb-4.0.3&auto=format&fit=crop&w=2000&q=80";
const FASHION_EDITORIAL_IMAGE =
  "https://images.unsplash.com/photo-1483985988355-763728e1935b?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80";

const AURA_MENS_HERO_IMAGE =
  "https://images.unsplash.com/photo-1617137968427-85924c800a22?ixlib=rb-4.0.3&auto=format&fit=crop&w=2000&q=80";
const AURA_MENS_EDITORIAL_IMAGE =
  "https://images.unsplash.com/photo-1490578474895-699bc4e3f444?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80";

export type FashionCategoryPill = { count: string; label: string };

export type FashionStoreLayoutConfig = {
  promoText?: string;
  heroImage?: string;
  editorialImage?: string;
  eyebrow?: string;
  heroTitle?: string;
  heroTitleHighlight?: string;
  heroSubtitle?: string;
  buttonText?: string;
  buttonText2?: string;
  buttonLink2?: string;
  categoryPills?: FashionCategoryPill[];
  productsEyebrow?: string;
  productsTitle?: string;
  viewAllText?: string;
  seasonLabel?: string;
  editorialTitle?: string;
  editorialHighlight?: string;
  editorialBody?: string;
  editorialBullets?: string[];
  featuresTitle?: string;
  reviewsTitle?: string;
  storeName?: string;
  footerDesc?: string;
  footerShopLinks?: string[];
  footerNewsletterHint?: string;
};

function buildCategoryPillsHtml(pills: FashionCategoryPill[]): string {
  return `<div class="fashion-category-row">${pills
    .map(
      (p) =>
        `<div class="fashion-category-pill"><span class="fashion-category-count">${p.count}</span><span class="fashion-category-label">${p.label}</span></div>`
    )
    .join("")}</div>`;
}

function buildEditorialCol2(primary: string, cfg: FashionStoreLayoutConfig): string {
  const bullets = (cfg.editorialBullets || []).map(
    (item) =>
      `<li style="display:flex;align-items:center;gap:0.75rem;"><span style="width:1.5rem;height:1.5rem;border-radius:9999px;background:${primary}15;color:${primary};display:inline-flex;align-items:center;justify-content:center;">✓</span><span>${item}</span></li>`
  ).join("");
  return `<p style="color:${primary};font-weight:700;text-transform:uppercase;letter-spacing:0.1em;font-size:0.875rem;margin-bottom:0.5rem;">${cfg.seasonLabel || "أزياء مستدامة"}</p><h2 style="font-size:2.5rem;font-weight:900;line-height:1.15;margin-bottom:1.5rem;">${cfg.editorialTitle || "أزياء واعية"}<br/><span style="color:${primary}">${cfg.editorialHighlight || "لمستقبل أفضل"}</span></h2><p style="color:#4b5563;line-height:1.75;margin-bottom:2rem;">${cfg.editorialBody || ""}</p><ul style="list-style:none;padding:0;margin:0 0 2rem;display:flex;flex-direction:column;gap:1rem;">${bullets}</ul><a href="#editorial" class="fashion-btn-primary" style="display:inline-block;padding:1rem 2rem;text-decoration:none;">اقرأ قصتنا</a>`;
}

export function buildFashionFooterHtml(
  storeName = "متجرنا",
  opts: { desc?: string; shopLinks?: string[]; newsletterHint?: string } = {}
): string {
  const initial = storeName.trim().charAt(0) || "م";
  const desc = opts.desc || "أزياء عصرية مستدامة — جودة، أناقة، ومسؤولية.";
  const shopLinks = opts.shopLinks || ["وصل حديثاً", "تشكيلة الصيف", "إكسسوارات", "تخفيضات"];
  const newsletterHint = opts.newsletterHint || "اشترك للحصول على عروض حصرية وخصومات.";
  return `
<footer class="fashion-footer">
  <div class="fashion-footer-grid">
    <div>
      <div class="fashion-footer-brand">
        <span class="fashion-footer-logo">${initial}</span>
        <span class="fashion-footer-name">${storeName}</span>
      </div>
      <p class="fashion-footer-desc">${desc}</p>
      <div class="fashion-footer-socials">
        <span>IG</span><span>TW</span><span>FB</span>
      </div>
    </div>
    <div>
      <h4 class="fashion-footer-heading">تسوق</h4>
      <ul class="fashion-footer-links">
        ${shopLinks.map((l) => `<li><a href="#products">${l}</a></li>`).join("")}
      </ul>
    </div>
    <div>
      <h4 class="fashion-footer-heading">الشركة</h4>
      <ul class="fashion-footer-links">
        <li><a href="#editorial">من نحن</a></li>
        <li><a href="#editorial">الاستدامة</a></li>
        <li><a href="#">اتصل بنا</a></li>
      </ul>
    </div>
    <div>
      <h4 class="fashion-footer-heading">النشرة البريدية</h4>
      <p class="fashion-footer-desc">${newsletterHint}</p>
      <div class="fashion-footer-newsletter">
        <input type="email" placeholder="أدخل بريدك الإلكتروني" dir="rtl" />
        <button type="button" class="fashion-btn-primary fashion-footer-submit" aria-label="اشتراك">←</button>
      </div>
    </div>
  </div>
  <div class="fashion-footer-bottom">
    <p>© ${new Date().getFullYear()} ${storeName}. جميع الحقوق محفوظة.</p>
    <div class="fashion-footer-legal">
      <a href="#">سياسة الخصوصية</a>
      <a href="#">شروط الخدمة</a>
    </div>
  </div>
</footer>`.trim();
}

const DEFAULT_FASHION_WOMENS: FashionStoreLayoutConfig = {
  promoText: "✨ ربيع / صيف 2026 — تشكيلة جديدة",
  heroImage: FASHION_HERO_IMAGE,
  editorialImage: FASHION_EDITORIAL_IMAGE,
  eyebrow: "ربيع / صيف 2026",
  heroTitle: "اكتشفي",
  heroTitleHighlight: "أناقتك المثالية",
  heroSubtitle: "تشكيلة نابضة بالحياة — جريئة وعصرية ومصممة لتبرزي في إيقاع الحياة العصري",
  buttonText: "تسوق التشكيلة",
  buttonText2: "شاهدي المجموعة",
  categoryPills: [
    { count: "120+", label: "وصل حديثاً" },
    { count: "85", label: "تشكيلة الصيف" },
    { count: "230+", label: "إكسسوارات" },
    { count: "45%", label: "تخفيضات" },
  ],
  productsEyebrow: "الأكثر رواجاً",
  productsTitle: "وصل حديثاً",
  viewAllText: "عرض كل المنتجات",
  seasonLabel: "أزياء مستدامة",
  editorialTitle: "أزياء واعية",
  editorialHighlight: "لمستقبل أفضل.",
  editorialBody:
    "تشكيلتنا مستوحاة من الطبيعة — كل قطعة مصنوعة من مواد مستدامة وعمالة أخلاقية. نؤمن بأزياء تبدو رائعة وتفعل الخير.",
  editorialBullets: ["قطن عضوي 100%", "تغليف بدون نفايات", "تجارة عادلة معتمدة"],
  featuresTitle: "لماذا تختارينا؟",
  reviewsTitle: "آراء عميلاتنا",
  storeName: "أورا",
  footerDesc: "أزياء عصرية مستدامة للمرأة العصرية — جودة، أناقة، ومسؤولية.",
  footerShopLinks: ["تشكيلة النساء", "وصل حديثاً", "إكسسوارات", "تخفيضات"],
  footerNewsletterHint: "اشتركي للحصول على عروض حصرية وخصومات.",
};

export const AURA_MENS_LAYOUT_CONFIG: FashionStoreLayoutConfig = {
  promoText: "✨ الربيع / الصيف 2026 — تشكيلة رجالية جديدة",
  heroImage: AURA_MENS_HERO_IMAGE,
  editorialImage: AURA_MENS_EDITORIAL_IMAGE,
  eyebrow: "الربيع / الصيف 2026",
  heroTitle: "اكتشف",
  heroTitleHighlight: "أناقتك المثالية",
  heroSubtitle:
    "اكتشف التشكيلة الحيوية الجديدة. جريئة، مفعمة بالطاقة، ومصممة لتبرز وتتألق في إيقاع الحياة الحديثة.",
  buttonText: "تسوق التشكيلة",
  buttonText2: "استعرض دليل الإطلالات",
  categoryPills: [
    { count: "+120", label: "وصل حديثاً" },
    { count: "85", label: "تشكيلة الصيف" },
    { count: "230", label: "إكسسوارات" },
    { count: "45%", label: "تخفيضات" },
  ],
  productsEyebrow: "رائج الآن",
  productsTitle: "وصل حديثاً",
  viewAllText: "عرض جميع المنتجات",
  seasonLabel: "أزياء مستدامة",
  editorialTitle: "أزياء واعية",
  editorialHighlight: "لمستقبل أفضل.",
  editorialBody:
    "مجموعتنا المستوحاة من المحيط ليست مجرد مظهر جمالي. تم تصميم كل قطعة باستخدام مواد مستدامة وممارسات عمل أخلاقية. نحن نؤمن بالأزياء التي تبدو جيدة وتفعل الخير.",
  editorialBullets: [
    "100% قطن عضوي",
    "بلاستيك محيطات معاد تدويره",
    "تغليف خالي من النفايات",
    "معتمد من التجارة العادلة",
  ],
  featuresTitle: "لماذا تختارنا؟",
  reviewsTitle: "آراء عملائنا",
  storeName: "AURA",
  footerDesc:
    "الارتقاء بالأسلوب اليومي بتصاميم مستدامة ومستوحاة من المحيط للفرد العصري.",
  footerShopLinks: ["الملابس الكاجوال", "البدل الرسمية", "إكسسوارات وعطور", "تخفيضات"],
  footerNewsletterHint: "اشترك للحصول على عروض خاصة، هدايا مجانية، وصفقات لا تُعوّض.",
};

/** Configurable AURA fashion storefront layout. */
export function buildFashionStoreHomeLayout(
  tokens: StoreThemeTokens,
  cfg: FashionStoreLayoutConfig = {}
): PuckData {
  const c = { ...DEFAULT_FASHION_WOMENS, ...cfg };
  const primary = hslToHex(tokens.primary || "250 85% 60%");
  const heroImage = c.heroImage || FASHION_HERO_IMAGE;
  const editorialImage = c.editorialImage || FASHION_EDITORIAL_IMAGE;
  const pills = c.categoryPills || DEFAULT_FASHION_WOMENS.categoryPills!;

  return {
    content: [
      {
        type: "PromoBar",
        props: {
          id: uid("PromoBar"),
          text: c.promoText!,
          bg: primary,
          color: "#ffffff",
          ...STYLE,
          padding_top: 0,
          padding_bottom: 0,
          max_width: "full",
          animation: "none",
        },
      },
      {
        type: "Hero",
        props: {
          id: uid("Hero"),
          image: heroImage,
          eyebrow: c.eyebrow,
          title: c.heroTitle,
          title_highlight: c.heroTitleHighlight,
          subtitle: c.heroSubtitle,
          button_text: c.buttonText,
          button_link: "#products",
          button_text_2: c.buttonText2,
          button_link_2: c.buttonLink2 || "#editorial",
          text_color: "#ffffff",
          overlay: 0.3,
          min_height: 720,
          max_width: "full",
          bg_gradient: `linear-gradient(to top, ${primary}55, transparent)`,
          padding_top: 0,
          padding_bottom: 0,
          animation: "fade-in",
          custom_class: "fashion-hero",
        },
      },
      {
        type: "HtmlBlock",
        props: {
          id: uid("Categories"),
          html: buildCategoryPillsHtml(pills),
          css: "",
          ...STYLE,
          padding_top: 64,
          padding_bottom: 64,
          bg_color: "#ffffff",
        },
      },
      {
        type: "ProductsGrid",
        props: {
          id: uid("Products"),
          eyebrow: c.productsEyebrow,
          title: c.productsTitle,
          limit: 8,
          columns: 4,
          card_style: "fashion",
          view_all_text: c.viewAllText,
          view_all_link: "#products",
          ...STYLE,
          padding_top: 48,
          padding_bottom: 64,
          custom_id: "products",
        },
      },
      {
        type: "Columns",
        props: {
          id: uid("Editorial"),
          count: 2,
          gap: 48,
          col1: `<img src="${editorialImage}" alt="أزياء" style="width:100%;border-radius:1.5rem;box-shadow:0 16px 48px rgba(0,0,0,0.12);aspect-ratio:4/5;object-fit:cover;" />`,
          col2: buildEditorialCol2(primary, c),
          ...STYLE,
          padding_top: 72,
          padding_bottom: 72,
          bg_color: "#ffffff",
          custom_id: "editorial",
        },
      },
      {
        type: "Features",
        props: {
          id: uid("Features"),
          title: c.featuresTitle,
          items: [
            { icon: "🚚", title: "شحن سريع", desc: "توصيل لكل مدن ليبيا" },
            { icon: "💵", title: "الدفع عند الاستلام", desc: "ادفع عند استلام طلبك" },
            { icon: "✨", title: "جودة فاخرة", desc: "خامات مختارة بعناية" },
            { icon: "💬", title: "دعم واتساب", desc: "فريقنا جاهز لمساعدتك" },
          ],
          ...STYLE,
          bg_color: hslToHex(tokens.background || "0 0% 99%"),
          padding_top: 56,
          padding_bottom: 56,
        },
      },
      {
        type: "Reviews",
        props: {
          id: uid("Reviews"),
          title: c.reviewsTitle,
          items: [
            { name: "سارة", text: "جودة رائعة وتصميم عصري!", rating: 5 },
            { name: "خالد", text: "التوصيل سريع والمقاسات مضبوطة.", rating: 5 },
            { name: "نور", text: "أنصح بكل تشكيلاتهم.", rating: 5 },
          ],
          ...STYLE,
          padding_top: 48,
          padding_bottom: 48,
        },
      },
      {
        type: "SocialIcons",
        props: {
          id: uid("Social"),
          facebook: "",
          instagram: "",
          whatsapp: "",
          tiktok: "",
          youtube: "",
          email: "",
          size: 28,
          color: primary,
          ...STYLE,
          padding_top: 24,
          padding_bottom: 24,
        },
      },
      {
        type: "HtmlBlock",
        props: {
          id: uid("Footer"),
          html: buildFashionFooterHtml(c.storeName || "أورا", {
            desc: c.footerDesc,
            shopLinks: c.footerShopLinks,
            newsletterHint: c.footerNewsletterHint,
          }),
          css: "",
          ...STYLE,
          padding_top: 0,
          padding_bottom: 0,
          max_width: "full",
        },
      },
    ],
    root: { props: {} },
  };
}

/** AURA v3 — men's / RTL Arabic fashion store (from fashion_store_landing_page v3). */
export function buildAuraMensStoreHomeLayout(tokens: StoreThemeTokens, overrides: FashionStoreLayoutConfig = {}): PuckData {
  return buildFashionStoreHomeLayout(tokens, { ...AURA_MENS_LAYOUT_CONFIG, ...overrides });
}

export type FashionProductLandingConfig = {
  promoText?: string;
  heroImage?: string;
  eyebrow?: string;
  heroTitle?: string;
  heroTitleHighlight?: string;
  heroSubtitle?: string;
  buttonText?: string;
  buttonText2?: string;
  featuresTitle?: string;
  reviewsTitle?: string;
  faqPayerLabel?: string;
};

const DEFAULT_MENS_PRODUCT: FashionProductLandingConfig = {
  promoText: "✨ عرض حصري — اطلب الآن قبل نفاد الكمية",
  heroImage: AURA_MENS_HERO_IMAGE,
  eyebrow: "عرض حصري",
  heroTitle: "قطعة تليق",
  heroTitleHighlight: "بأناقتك",
  heroSubtitle: "جودة فاخرة • شحن سريع • الدفع عند الاستلام",
  buttonText: "اطلب الآن",
  buttonText2: "تفاصيل المنتج",
  featuresTitle: "لماذا هذا المنتج؟",
  reviewsTitle: "ماذا يقول عملاؤنا",
  faqPayerLabel: "تدفع",
};

/** Fashion product landing — hero + gallery + order form with AURA styling. */
export function buildFashionProductLandingLayout(
  tokens: StoreThemeTokens,
  opts: FashionProductLandingConfig = {}
): PuckData {
  const c = { ...DEFAULT_MENS_PRODUCT, ...opts };
  const primary = hslToHex(tokens.primary || "250 85% 60%");
  const accent = hslToHex(tokens.accent || "340 82% 52%");
  const heroImage = c.heroImage || FASHION_HERO_IMAGE;

  return {
    content: [
      {
        type: "PromoBar",
        props: {
          id: uid("Promo"),
          text: c.promoText!,
          bg: primary,
          color: "#ffffff",
          ...STYLE,
          padding_top: 0,
          padding_bottom: 0,
          max_width: "full",
          animation: "none",
        },
      },
      {
        type: "Hero",
        props: {
          id: uid("Hero"),
          image: heroImage,
          eyebrow: c.eyebrow,
          title: c.heroTitle,
          title_highlight: c.heroTitleHighlight,
          subtitle: c.heroSubtitle,
          button_text: c.buttonText,
          button_link: "#order-form",
          button_text_2: c.buttonText2,
          button_link_2: "#product-desc",
          text_color: "#ffffff",
          overlay: 0.4,
          min_height: 480,
          max_width: "full",
          bg_gradient: `linear-gradient(160deg, ${primary} 0%, ${accent} 100%)`,
          padding_top: 0,
          padding_bottom: 0,
          animation: "fade-in",
          custom_class: "fashion-hero",
        },
      },
      {
        type: "ProductImages",
        props: { id: uid("Images"), ...STYLE, padding_top: 24, padding_bottom: 24 },
      },
      {
        type: "Features",
        props: {
          id: uid("Features"),
          title: c.featuresTitle,
          items: [
            { icon: "✨", title: "خامات فاخرة", desc: "جودة عالية وتفاصيل دقيقة" },
            { icon: "🚚", title: "توصيل سريع", desc: "2-4 أيام لمعظم المدن" },
            { icon: "💵", title: "COD", desc: "ادفع عند الاستلام" },
            { icon: "🔄", title: "استبدال", desc: "سياسة استبدال مرنة" },
          ],
          ...STYLE,
          padding_top: 40,
          padding_bottom: 40,
        },
      },
      {
        type: "OrderForm",
        props: { id: uid("OrderForm"), ...STYLE, padding_top: 16, padding_bottom: 16, custom_id: "order-form" },
      },
      {
        type: "ProductDescription",
        props: { id: uid("Desc"), ...STYLE, padding_top: 24, padding_bottom: 24, custom_id: "product-desc" },
      },
      {
        type: "Reviews",
        props: {
          id: uid("Reviews"),
          title: c.reviewsTitle,
          items: [
            { name: "أحمد", text: "منتج ممتاز أنصح به!", rating: 5 },
            { name: "فاطمة", text: "وصلني بسرعة والتغليف رائع.", rating: 5 },
            { name: "محمد", text: "تجربة شراء مميزة.", rating: 5 },
          ],
          ...STYLE,
          padding_top: 40,
          padding_bottom: 40,
        },
      },
      {
        type: "Faq",
        props: {
          id: uid("Faq"),
          title: "الأسئلة الشائعة",
          items: [
            { q: "هل الدفع عند الاستلام؟", a: `نعم، ${c.faqPayerLabel} للمندوب عند الاستلام.` },
            { q: "كم يستغرق التوصيل؟", a: "2-4 أيام حسب المدينة." },
            { q: "هل يمكن الاستبدال؟", a: "نعم خلال 7 أيام بالحالة الأصلية." },
          ],
          ...STYLE,
          padding_top: 30,
          padding_bottom: 48,
          max_width: "narrow",
        },
      },
    ],
    root: { props: {} },
  };
}

export function buildFlashSaleLanding(tokens: StoreThemeTokens): PuckData {
  const primary = hslToHex(tokens.primary || "24 95% 53%");
  return {
    content: [
      {
        type: "Heading",
        props: {
          id: uid("H1"),
          text: "🔥 تخفيضات خاطفة",
          tag: "h1",
          size: 42,
          weight: 800,
          color: primary,
          letter_spacing: -1,
          line_height: 1.2,
          ...STYLE,
          padding_top: 48,
          padding_bottom: 16,
          text_align: "center",
        },
      },
      {
        type: "Countdown",
        props: {
          id: uid("Cd"),
          title: "العرض ينتهي خلال",
          target: new Date(Date.now() + 2 * 86400000).toISOString(),
          color: primary,
          ...STYLE,
        },
      },
      {
        type: "ProductsGrid",
        props: {
          id: uid("Pg"),
          title: "منتجات العرض",
          limit: 12,
          columns: 3,
          ...STYLE,
          padding_top: 32,
          padding_bottom: 48,
        },
      },
      {
        type: "ButtonBlock",
        props: {
          id: uid("Btn"),
          text: "تصفح كل العروض",
          link: "/store",
          variant: "gradient",
          size: "lg",
          bg: primary,
          color: "#fff",
          rounded: 12,
          full_width: false,
          new_tab: false,
          ...STYLE,
          padding_bottom: 48,
        },
      },
    ],
    root: { props: {} },
  };
}
