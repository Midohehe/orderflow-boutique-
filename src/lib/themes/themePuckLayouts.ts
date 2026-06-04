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
