import type { LucideIcon } from "lucide-react";
import {
  Image as ImageIcon,
  Type,
  ShoppingBag,
  Grid3x3,
  HelpCircle,
  Star,
  Megaphone,
  Sparkles,
  Video,
} from "lucide-react";

export type SectionType =
  | "hero"
  | "banner"
  | "products_grid"
  | "categories_grid"
  | "rich_text"
  | "video"
  | "faq"
  | "features"
  | "promo_bar"
  | "reviews";

export interface SectionMeta {
  type: SectionType;
  label: string;
  icon: LucideIcon;
  color: string;
  defaults: Record<string, any>;
}

export const SECTION_REGISTRY: SectionMeta[] = [
  {
    type: "hero",
    label: "بانر رئيسي (Hero)",
    icon: ImageIcon,
    color: "from-blue-500 to-indigo-600",
    defaults: {
      image: "",
      title: "أهلاً بك في متجرنا",
      subtitle: "أفضل المنتجات بأفضل الأسعار",
      button_text: "تسوّق الآن",
      button_link: "#products",
      text_color: "#ffffff",
      overlay: 0.4,
    },
  },
  {
    type: "banner",
    label: "بانر صورة",
    icon: ImageIcon,
    color: "from-cyan-500 to-blue-500",
    defaults: { image: "", link: "", alt: "بانر" },
  },
  {
    type: "products_grid",
    label: "شبكة منتجات",
    icon: ShoppingBag,
    color: "from-pink-500 to-rose-600",
    defaults: { title: "منتجاتنا", limit: 8, columns: 4 },
  },
  {
    type: "categories_grid",
    label: "شبكة الفئات",
    icon: Grid3x3,
    color: "from-red-500 to-orange-500",
    defaults: {
      title: "الفئات",
      items: [
        { label: "فئة 1", image: "", link: "" },
        { label: "فئة 2", image: "", link: "" },
      ],
    },
  },
  {
    type: "rich_text",
    label: "نص حر",
    icon: Type,
    color: "from-slate-500 to-slate-700",
    defaults: { html: "<h2>عنوان</h2><p>اكتب هنا...</p>", align: "center" },
  },
  {
    type: "video",
    label: "فيديو",
    icon: Video,
    color: "from-purple-500 to-pink-500",
    defaults: { url: "", title: "" },
  },
  {
    type: "faq",
    label: "أسئلة شائعة",
    icon: HelpCircle,
    color: "from-amber-500 to-orange-500",
    defaults: {
      title: "الأسئلة الشائعة",
      items: [{ q: "سؤال؟", a: "إجابة." }],
    },
  },
  {
    type: "features",
    label: "مميزات المتجر",
    icon: Sparkles,
    color: "from-emerald-500 to-teal-600",
    defaults: {
      title: "لماذا نحن؟",
      items: [
        { icon: "🚚", title: "شحن سريع", desc: "توصيل لكل المدن" },
        { icon: "✅", title: "ضمان الجودة", desc: "منتجات أصلية 100%" },
        { icon: "💬", title: "دعم على مدار الساعة", desc: "تواصل معنا في أي وقت" },
      ],
    },
  },
  {
    type: "promo_bar",
    label: "شريط ترويجي",
    icon: Megaphone,
    color: "from-fuchsia-500 to-purple-600",
    defaults: { text: "🎉 خصم 20% على كل المنتجات!", bg: "#7c3aed", color: "#ffffff" },
  },
  {
    type: "reviews",
    label: "تقييمات العملاء",
    icon: Star,
    color: "from-yellow-500 to-amber-500",
    defaults: {
      title: "آراء عملائنا",
      items: [
        { name: "أحمد", text: "خدمة ممتازة وسرعة في التوصيل", rating: 5 },
        { name: "سارة", text: "منتجات بجودة عالية", rating: 5 },
      ],
    },
  },
];

export const getMeta = (type: string) =>
  SECTION_REGISTRY.find((s) => s.type === type);

export interface HomeSectionRow {
  id: string;
  store_id: string;
  section_type: SectionType;
  position: number;
  is_visible: boolean;
  config: Record<string, any>;
}