import type { Config } from "@measured/puck";
import DOMPurify from "dompurify";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Star, ShoppingBag, ChevronDown, Facebook, Instagram, Twitter, Youtube, Send, Phone, Mail } from "lucide-react";

export type PuckContext = {
  ownerId?: string;
  storeId?: string;
  username?: string;
  currencySymbol?: string;
};

/* ---------- Shared style props (applied to every component) ---------- */
type StyleProps = {
  padding_top?: number;
  padding_bottom?: number;
  padding_left?: number;
  padding_right?: number;
  margin_top?: number;
  margin_bottom?: number;
  max_width?: "full" | "container" | "narrow";
  bg_color?: string;
  bg_gradient?: string;
  bg_image?: string;
  bg_size?: "cover" | "contain" | "auto";
  min_height?: number;
  text_align?: "right" | "center" | "left";
  border_width?: number;
  border_color?: string;
  border_radius?: number;
  shadow?: "none" | "sm" | "md" | "lg" | "xl";
  animation?: "none" | "fade-in" | "fade-up" | "fade-down" | "zoom-in" | "slide-right" | "slide-left";
  custom_class?: string;
  custom_id?: string;
  hide_mobile?: boolean;
  hide_desktop?: boolean;
  hide_tablet?: boolean;
};

const SHADOW_MAP: Record<string, string> = {
  none: "none",
  sm: "0 1px 2px rgba(0,0,0,0.08)",
  md: "0 4px 12px rgba(0,0,0,0.12)",
  lg: "0 10px 25px rgba(0,0,0,0.15)",
  xl: "0 20px 50px rgba(0,0,0,0.25)",
};

const STYLE_FIELDS = {
  // --- Spacing ---
  padding_top:    { type: "number" as const, label: "حشو علوي (px)",  min: 0, max: 400 },
  padding_bottom: { type: "number" as const, label: "حشو سفلي (px)",  min: 0, max: 400 },
  padding_left:   { type: "number" as const, label: "حشو يسار (px)",  min: 0, max: 200 },
  padding_right:  { type: "number" as const, label: "حشو يمين (px)",  min: 0, max: 200 },
  margin_top:     { type: "number" as const, label: "هامش علوي (px)", min: 0, max: 200 },
  margin_bottom:  { type: "number" as const, label: "هامش سفلي (px)", min: 0, max: 200 },
  // --- Layout ---
  max_width: { type: "select" as const, label: "العرض الأقصى", options: [
    { label: "كامل العرض", value: "full" },
    { label: "حاوية (1200)", value: "container" },
    { label: "ضيق (768)", value: "narrow" },
  ]},
  min_height: { type: "number" as const, label: "ارتفاع أدنى (px)", min: 0, max: 1200 },
  text_align: { type: "select" as const, label: "محاذاة النص", options: [
    { label: "وسط", value: "center" }, { label: "يمين", value: "right" }, { label: "يسار", value: "left" },
  ]},
  // --- Background ---
  bg_color:    { type: "text" as const, label: "لون الخلفية (hex)" },
  bg_gradient: { type: "text" as const, label: "تدرّج CSS مثل: linear-gradient(...)" },
  bg_image:    { type: "text" as const, label: "رابط صورة الخلفية" },
  bg_size: { type: "select" as const, label: "حجم خلفية الصورة", options: [
    { label: "تغطية", value: "cover" }, { label: "احتواء", value: "contain" }, { label: "تلقائي", value: "auto" },
  ]},
  // --- Border / Effects ---
  border_width:  { type: "number" as const, label: "سماكة الحدّ (px)", min: 0, max: 20 },
  border_color:  { type: "text" as const, label: "لون الحدّ (hex)" },
  border_radius: { type: "number" as const, label: "تدوير الزوايا (px)", min: 0, max: 100 },
  shadow: { type: "select" as const, label: "ظِل", options: [
    { label: "بدون", value: "none" }, { label: "خفيف", value: "sm" }, { label: "متوسط", value: "md" },
    { label: "كبير", value: "lg" }, { label: "ضخم", value: "xl" },
  ]},
  animation: { type: "select" as const, label: "حركة الدخول", options: [
    { label: "بدون", value: "none" }, { label: "ظهور", value: "fade-in" },
    { label: "من الأسفل", value: "fade-up" }, { label: "من الأعلى", value: "fade-down" },
    { label: "تكبير", value: "zoom-in" }, { label: "من اليمين", value: "slide-right" },
    { label: "من اليسار", value: "slide-left" },
  ]},
  // --- Advanced ---
  custom_class: { type: "text" as const, label: "CSS Class مخصص" },
  custom_id:    { type: "text" as const, label: "ID مخصص (للروابط)" },
  // --- Responsive ---
  hide_mobile:  { type: "radio" as const, label: "إخفاء على الجوال",   options: [{ label: "لا", value: false }, { label: "نعم", value: true }] },
  hide_tablet:  { type: "radio" as const, label: "إخفاء على التابلت",  options: [{ label: "لا", value: false }, { label: "نعم", value: true }] },
  hide_desktop: { type: "radio" as const, label: "إخفاء على الكمبيوتر", options: [{ label: "لا", value: false }, { label: "نعم", value: true }] },
};

const STYLE_DEFAULTS: StyleProps = {
  padding_top: 16, padding_bottom: 16, padding_left: 0, padding_right: 0,
  margin_top: 0, margin_bottom: 0,
  max_width: "container", min_height: 0, text_align: "center",
  bg_color: "", bg_gradient: "", bg_image: "", bg_size: "cover",
  border_width: 0, border_color: "", border_radius: 0, shadow: "none",
  animation: "none", custom_class: "", custom_id: "",
  hide_mobile: false, hide_tablet: false, hide_desktop: false,
};

const StyleWrap = ({ s, children }: { s: StyleProps; children: React.ReactNode }) => {
  const maxW = s.max_width === "full" ? "100%" : s.max_width === "narrow" ? "768px" : "1200px";
  const hideCls = [
    s.hide_mobile ? "max-md:hidden" : "",
    s.hide_tablet ? "max-lg:max-md:hidden md:max-lg:hidden" : "",
    s.hide_desktop ? "lg:hidden" : "",
    s.custom_class || "",
    s.animation && s.animation !== "none" ? `puck-anim-${s.animation}` : "",
  ].filter(Boolean).join(" ");
  const bg: React.CSSProperties = {
    backgroundColor: s.bg_color || undefined,
    backgroundImage: s.bg_gradient
      ? s.bg_gradient
      : s.bg_image ? `url(${s.bg_image})` : undefined,
    backgroundSize: s.bg_image ? s.bg_size || "cover" : undefined,
    backgroundPosition: "center",
  };
  return (
    <div
      id={s.custom_id || undefined}
      className={hideCls}
      style={{
        ...bg,
        width: "100%",
        marginTop: s.margin_top || undefined,
        marginBottom: s.margin_bottom || undefined,
      }}
    >
      <div style={{
        maxWidth: maxW, marginInline: "auto",
        paddingTop: s.padding_top, paddingBottom: s.padding_bottom,
        paddingLeft: s.padding_left, paddingRight: s.padding_right,
        minHeight: s.min_height || undefined,
        textAlign: s.text_align as any,
        borderWidth: s.border_width || undefined,
        borderStyle: s.border_width ? "solid" : undefined,
        borderColor: s.border_color || undefined,
        borderRadius: s.border_radius || undefined,
        boxShadow: s.shadow && s.shadow !== "none" ? SHADOW_MAP[s.shadow] : undefined,
        overflow: s.border_radius ? "hidden" : undefined,
      }}>
        {children}
      </div>
    </div>
  );
};

const pickStyle = (p: any): StyleProps => ({
  padding_top: p.padding_top, padding_bottom: p.padding_bottom,
  padding_left: p.padding_left, padding_right: p.padding_right,
  margin_top: p.margin_top, margin_bottom: p.margin_bottom,
  max_width: p.max_width, min_height: p.min_height, text_align: p.text_align,
  bg_color: p.bg_color, bg_gradient: p.bg_gradient, bg_image: p.bg_image, bg_size: p.bg_size,
  border_width: p.border_width, border_color: p.border_color, border_radius: p.border_radius,
  shadow: p.shadow, animation: p.animation, custom_class: p.custom_class, custom_id: p.custom_id,
  hide_mobile: p.hide_mobile, hide_tablet: p.hide_tablet, hide_desktop: p.hide_desktop,
});

/* ---------- Products grid (live data) ---------- */
const ProductsGrid = ({
  title, limit, columns, ctx,
}: { title: string; limit: number; columns: number; ctx?: PuckContext }) => {
  const [products, setProducts] = useState<any[]>([]);
  useEffect(() => {
    if (!ctx?.ownerId || !ctx?.storeId) return;
    let cancel = false;
    supabase.from("products")
      .select("id, name, slug, price, original_price, images")
      .eq("owner_id", ctx.ownerId)
      .eq("store_id", ctx.storeId)
      .eq("is_visible", true)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(limit || 8)
      .then(({ data }) => { if (!cancel && data) setProducts(data); });
    return () => { cancel = true; };
  }, [ctx?.ownerId, ctx?.storeId, limit]);

  const gridCls = columns === 2 ? "sm:grid-cols-2"
    : columns === 3 ? "sm:grid-cols-2 md:grid-cols-3"
    : "sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4";

  return (
    <section className="my-6" id="products">
      {title && <h2 className="text-2xl font-bold text-center mb-5">{title}</h2>}
      <div className={`grid grid-cols-1 ${gridCls} gap-4`}>
        {products.length === 0 && (
          <div className="col-span-full text-center text-muted-foreground py-8 border-2 border-dashed rounded-lg">
            ستظهر المنتجات هنا في المتجر
          </div>
        )}
        {products.map((p) => (
          <a key={p.id} href={ctx?.username ? `/p/${ctx.username}/${p.slug}` : `/p/${p.slug}`} target="_blank" rel="noopener">
            <Card className="group overflow-hidden hover:shadow-lg transition cursor-pointer">
              <div className="aspect-square bg-muted overflow-hidden">
                {p.images?.[0]
                  ? <img src={p.images[0]} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition" />
                  : <div className="w-full h-full flex items-center justify-center"><ShoppingBag className="w-12 h-12 text-muted-foreground" /></div>}
              </div>
              <CardContent className="p-3 space-y-2">
                <h3 className="font-semibold line-clamp-2 text-sm">{p.name}</h3>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-primary">{p.price} {ctx?.currencySymbol || ""}</span>
                  {p.original_price && p.original_price > p.price && (
                    <span className="text-xs text-muted-foreground line-through">{p.original_price}</span>
                  )}
                </div>
              </CardContent>
            </Card>
          </a>
        ))}
      </div>
    </section>
  );
};

const FaqItem = ({ q, a }: { q: string; a: string }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <button type="button" onClick={() => setOpen(!open)} className="w-full flex items-center justify-between p-4 text-right hover:bg-muted/50 transition">
        <span className="font-semibold">{q}</span>
        <ChevronDown className={`w-5 h-5 transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <div className="p-4 pt-0 text-muted-foreground text-sm">{a}</div>}
    </div>
  );
};

export type PuckProps = {
  Hero: StyleProps & { image: string; title: string; subtitle: string; button_text: string; button_link: string; text_color: string; overlay: number };
  Banner: StyleProps & { image: string; link: string; alt: string };
  ProductsGrid: StyleProps & { title: string; limit: number; columns: number };
  CategoriesGrid: StyleProps & { title: string; items: { label: string; image: string; link: string }[] };
  RichText: StyleProps & { html: string; align: "right" | "center" | "left" };
  Video: StyleProps & { title: string; url: string };
  Faq: StyleProps & { title: string; items: { q: string; a: string }[] };
  Features: StyleProps & { title: string; items: { icon: string; title: string; desc: string }[] };
  PromoBar: StyleProps & { text: string; bg: string; color: string };
  Reviews: StyleProps & { title: string; items: { name: string; text: string; rating: number }[] };
  Spacer: { height: number };
  HtmlBlock: StyleProps & { html: string; css: string };
  Heading: StyleProps & { text: string; tag: "h1"|"h2"|"h3"|"h4"; size: number; weight: number; color: string; letter_spacing: number; line_height: number };
  ButtonBlock: StyleProps & { text: string; link: string; variant: "solid"|"outline"|"ghost"|"gradient"; size: "sm"|"md"|"lg"|"xl"; bg: string; color: string; rounded: number; full_width: boolean; new_tab: boolean };
  ImageBlock: StyleProps & { src: string; alt: string; link: string; width: number; height: number; fit: "cover"|"contain"; rounded: number };
  Columns: StyleProps & { count: 2|3|4; gap: number; col1: string; col2: string; col3: string; col4: string };
  Divider: StyleProps & { thickness: number; color: string; style: "solid"|"dashed"|"dotted"; width_pct: number };
  IconBox: StyleProps & { icon: string; title: string; desc: string; color: string; size: number };
  Countdown: StyleProps & { title: string; target: string; color: string };
  SocialIcons: StyleProps & { facebook: string; instagram: string; whatsapp: string; tiktok: string; youtube: string; email: string; size: number; color: string };
  GoogleMap: StyleProps & { embed_url: string; height: number };
};

export const buildPuckConfig = (ctx: PuckContext): Config<PuckProps> => ({
  components: {
    Hero: {
      label: "بانر رئيسي (Hero)",
      fields: {
        image: { type: "text", label: "رابط الصورة" },
        title: { type: "text", label: "العنوان" },
        subtitle: { type: "text", label: "العنوان الفرعي" },
        button_text: { type: "text", label: "نص الزر" },
        button_link: { type: "text", label: "رابط الزر" },
        text_color: { type: "text", label: "لون النص (hex)" },
        overlay: { type: "number", label: "شفافية التظليل 0-1", min: 0, max: 1 },
        ...STYLE_FIELDS,
      },
      defaultProps: { image: "", title: "أهلاً بك في متجرنا", subtitle: "أفضل المنتجات بأفضل الأسعار", button_text: "تسوّق الآن", button_link: "#products", text_color: "#ffffff", overlay: 0.4, ...STYLE_DEFAULTS, min_height: 420, max_width: "full", padding_top: 0, padding_bottom: 0 },
      render: (p) => {
        const { image, title, subtitle, button_text, button_link, text_color, overlay } = p as any;
        return (
        <StyleWrap s={pickStyle(p)}>
        <section className="relative w-full rounded-xl overflow-hidden flex items-center justify-center"
          style={{ backgroundImage: image ? `url(${image})` : undefined, backgroundSize: "cover", backgroundPosition: "center", backgroundColor: image ? undefined : "hsl(var(--muted))" }}>
          {image && <div className="absolute inset-0" style={{ backgroundColor: `rgba(0,0,0,${overlay ?? 0.4})` }} />}
          <div className="relative z-10 text-center px-6 py-12 max-w-3xl" style={{ color: text_color || "#fff" }}>
            {title && <h2 className="text-3xl sm:text-5xl font-extrabold mb-3 drop-shadow">{title}</h2>}
            {subtitle && <p className="text-lg sm:text-xl mb-6 opacity-95 drop-shadow">{subtitle}</p>}
            {button_text && <a href={button_link || "#"}><Button size="lg" className="font-bold">{button_text}</Button></a>}
          </div>
        </section>
        </StyleWrap>
        );
      },
    },
    Banner: {
      label: "بانر صورة",
      fields: {
        image: { type: "text", label: "رابط الصورة" },
        link: { type: "text", label: "الرابط عند الضغط" },
        alt: { type: "text", label: "النص البديل" },
        ...STYLE_FIELDS,
      },
      defaultProps: { image: "", link: "", alt: "بانر", ...STYLE_DEFAULTS },
      render: (p) => {
        const { image, link, alt } = p as any;
        return (
          <StyleWrap s={pickStyle(p)}>
            {image
              ? <a href={link || "#"} className="block"><img src={image} alt={alt || ""} className="w-full h-auto rounded-xl" /></a>
              : <div className="p-8 text-center border-2 border-dashed rounded-xl text-muted-foreground">أضف صورة البانر</div>}
          </StyleWrap>
        );
      },
    },
    ProductsGrid: {
      label: "شبكة المنتجات",
      fields: {
        title: { type: "text", label: "العنوان" },
        limit: { type: "number", label: "عدد المنتجات", min: 1, max: 50 },
        columns: { type: "select", label: "الأعمدة", options: [{ label: "2", value: 2 }, { label: "3", value: 3 }, { label: "4", value: 4 }] },
        ...STYLE_FIELDS,
      },
      defaultProps: { title: "منتجاتنا", limit: 8, columns: 4, ...STYLE_DEFAULTS },
      render: (props) => <StyleWrap s={pickStyle(props)}><ProductsGrid {...(props as any)} ctx={ctx} /></StyleWrap>,
    },
    CategoriesGrid: {
      label: "شبكة الفئات",
      fields: {
        title: { type: "text", label: "العنوان" },
        items: {
          type: "array", label: "الفئات",
          arrayFields: {
            label: { type: "text", label: "الاسم" },
            image: { type: "text", label: "رابط الصورة" },
            link: { type: "text", label: "الرابط" },
          },
          defaultItemProps: { label: "فئة", image: "", link: "" },
        },
        ...STYLE_FIELDS,
      },
      defaultProps: { title: "الفئات", items: [{ label: "فئة 1", image: "", link: "" }, { label: "فئة 2", image: "", link: "" }], ...STYLE_DEFAULTS },
      render: (p) => {
        const { title, items } = p as any;
        return (
        <StyleWrap s={pickStyle(p)}>
        <section>
          {title && <h2 className="text-2xl font-bold text-center mb-5">{title}</h2>}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {(items || []).map((it, i) => (
              <a key={i} href={it.link || "#"} className="group">
                <div className="aspect-square rounded-full overflow-hidden bg-muted border-2 border-border group-hover:border-primary transition">
                  {it.image && <img src={it.image} alt={it.label} className="w-full h-full object-cover group-hover:scale-105 transition" />}
                </div>
                <p className="text-center mt-2 font-medium text-sm">{it.label}</p>
              </a>
            ))}
          </div>
        </section>
        </StyleWrap>
        );
      },
    },
    RichText: {
      label: "نص حر (HTML)",
      fields: {
        html: { type: "textarea", label: "محتوى HTML" },
        align: { type: "select", label: "المحاذاة", options: [{ label: "يمين", value: "right" }, { label: "وسط", value: "center" }, { label: "يسار", value: "left" }] },
        ...STYLE_FIELDS,
      },
      defaultProps: { html: "<h2>عنوان</h2><p>اكتب هنا...</p>", align: "center", ...STYLE_DEFAULTS },
      render: (p) => {
        const { html, align } = p as any;
        return (
        <StyleWrap s={pickStyle(p)}>
        <section className="prose prose-sm md:prose-base max-w-none dark:prose-invert" style={{ textAlign: align }}>
          <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(html || "") }} />
        </section>
        </StyleWrap>
        );
      },
    },
    Video: {
      label: "فيديو YouTube",
      fields: {
        title: { type: "text", label: "العنوان" },
        url: { type: "text", label: "رابط YouTube" },
        ...STYLE_FIELDS,
      },
      defaultProps: { title: "", url: "", ...STYLE_DEFAULTS, max_width: "narrow" },
      render: (p) => {
        const { title, url } = p as any;
        const yt = (url || "").match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w-]+)/);
        const embed = yt ? `https://www.youtube.com/embed/${yt[1]}` : url;
        return (
          <StyleWrap s={pickStyle(p)}>
          <section>
            {title && <h2 className="text-2xl font-bold text-center mb-4">{title}</h2>}
            {url ? <div className="relative aspect-video rounded-xl overflow-hidden bg-muted">
              <iframe src={embed} className="absolute inset-0 w-full h-full" allowFullScreen title={title || "video"} />
            </div> : <div className="p-6 text-center border-2 border-dashed rounded-xl text-muted-foreground">أضف رابط فيديو</div>}
          </section>
          </StyleWrap>
        );
      },
    },
    Faq: {
      label: "الأسئلة الشائعة",
      fields: {
        title: { type: "text", label: "العنوان" },
        items: {
          type: "array", label: "الأسئلة",
          arrayFields: { q: { type: "text", label: "السؤال" }, a: { type: "textarea", label: "الإجابة" } },
          defaultItemProps: { q: "سؤال؟", a: "إجابة." },
        },
        ...STYLE_FIELDS,
      },
      defaultProps: { title: "الأسئلة الشائعة", items: [{ q: "سؤال؟", a: "إجابة." }], ...STYLE_DEFAULTS, max_width: "narrow" },
      render: (p) => {
        const { title, items } = p as any;
        return (
        <StyleWrap s={pickStyle(p)}>
        <section>
          {title && <h2 className="text-2xl font-bold text-center mb-5">{title}</h2>}
          <div className="space-y-2">{(items || []).map((it, i) => <FaqItem key={i} q={it.q} a={it.a} />)}</div>
        </section>
        </StyleWrap>
        );
      },
    },
    Features: {
      label: "مميزات المتجر",
      fields: {
        title: { type: "text", label: "العنوان" },
        items: {
          type: "array", label: "المميزات",
          arrayFields: { icon: { type: "text", label: "إيموجي" }, title: { type: "text", label: "العنوان" }, desc: { type: "text", label: "الوصف" } },
          defaultItemProps: { icon: "✨", title: "ميزة", desc: "وصف" },
        },
        ...STYLE_FIELDS,
      },
      defaultProps: { title: "لماذا نحن؟", items: [
        { icon: "🚚", title: "شحن سريع", desc: "توصيل لكل المدن" },
        { icon: "✅", title: "ضمان الجودة", desc: "منتجات أصلية 100%" },
        { icon: "💬", title: "دعم 24/7", desc: "تواصل معنا في أي وقت" },
      ], ...STYLE_DEFAULTS },
      render: (p) => {
        const { title, items } = p as any;
        return (
        <StyleWrap s={pickStyle(p)}>
        <section>
          {title && <h2 className="text-2xl font-bold text-center mb-6">{title}</h2>}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {(items || []).map((it, i) => (
              <Card key={i} className="text-center"><CardContent className="p-5">
                <div className="text-4xl mb-3">{it.icon || "✨"}</div>
                <h3 className="font-bold mb-1">{it.title}</h3>
                <p className="text-sm text-muted-foreground">{it.desc}</p>
              </CardContent></Card>
            ))}
          </div>
        </section>
        </StyleWrap>
        );
      },
    },
    PromoBar: {
      label: "شريط ترويجي",
      fields: {
        text: { type: "text", label: "النص" },
        bg: { type: "text", label: "لون الخلفية (hex)" },
        color: { type: "text", label: "لون النص (hex)" },
        ...STYLE_FIELDS,
      },
      defaultProps: { text: "🎉 خصم 20% على كل المنتجات!", bg: "#7c3aed", color: "#ffffff", ...STYLE_DEFAULTS, padding_top: 0, padding_bottom: 0, max_width: "full" },
      render: (p) => {
        const { text, bg, color } = p as any;
        return (
          <StyleWrap s={pickStyle(p)}>
            <div className="w-full text-center py-3 px-4 rounded-lg font-semibold" style={{ background: bg, color }}>{text}</div>
          </StyleWrap>
        );
      },
    },
    Reviews: {
      label: "تقييمات العملاء",
      fields: {
        title: { type: "text", label: "العنوان" },
        items: {
          type: "array", label: "التقييمات",
          arrayFields: {
            name: { type: "text", label: "الاسم" },
            text: { type: "textarea", label: "التعليق" },
            rating: { type: "number", label: "النجوم (1-5)", min: 1, max: 5 },
          },
          defaultItemProps: { name: "", text: "", rating: 5 },
        },
        ...STYLE_FIELDS,
      },
      defaultProps: { title: "آراء عملائنا", items: [
        { name: "أحمد", text: "خدمة ممتازة", rating: 5 },
        { name: "سارة", text: "جودة عالية", rating: 5 },
      ], ...STYLE_DEFAULTS },
      render: (p) => {
        const { title, items } = p as any;
        return (
        <StyleWrap s={pickStyle(p)}>
        <section>
          {title && <h2 className="text-2xl font-bold text-center mb-5">{title}</h2>}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {(items || []).map((it, i) => (
              <Card key={i}><CardContent className="p-5">
                <div className="flex gap-0.5 mb-2">
                  {Array.from({ length: it.rating || 5 }).map((_, k) => (
                    <Star key={k} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                  ))}
                </div>
                <p className="text-sm mb-3 italic">"{it.text}"</p>
                <p className="font-bold text-sm">— {it.name}</p>
              </CardContent></Card>
            ))}
          </div>
        </section>
        </StyleWrap>
        );
      },
    },
    Spacer: {
      label: "مسافة فارغة",
      fields: { height: { type: "number", label: "الارتفاع (px)", min: 4, max: 200 } },
      defaultProps: { height: 32 },
      render: ({ height }) => <div style={{ height }} />,
    },
    HtmlBlock: {
      label: "كود HTML/CSS مخصص",
      fields: {
        html: { type: "textarea", label: "HTML" },
        css: { type: "textarea", label: "CSS" },
        ...STYLE_FIELDS,
      },
      defaultProps: { html: "<div>محتوى مخصص</div>", css: "", ...STYLE_DEFAULTS },
      render: (p) => {
        const { html, css } = p as any;
        const id = "htmlblk-" + Math.random().toString(36).slice(2, 8);
        const cleanHtml = DOMPurify.sanitize(html || "");
        const scopedCss = (css || "").replace(/(^|\})\s*([^{}]+)\s*\{/g, (_m, br, sel) =>
          `${br} ${sel.split(",").map((s: string) => `#${id} ${s.trim()}`).join(",")} {`);
        return (
          <StyleWrap s={pickStyle(p)}>
            <div id={id}>
              {css ? <style dangerouslySetInnerHTML={{ __html: scopedCss }} /> : null}
              <div dangerouslySetInnerHTML={{ __html: cleanHtml }} />
            </div>
          </StyleWrap>
        );
      },
    },
    Heading: {
      label: "عنوان",
      fields: {
        text: { type: "text", label: "النص" },
        tag: { type: "select", label: "نوع العنوان", options: [
          { label: "H1", value: "h1" }, { label: "H2", value: "h2" }, { label: "H3", value: "h3" }, { label: "H4", value: "h4" },
        ]},
        size: { type: "number", label: "حجم الخط (px)", min: 10, max: 120 },
        weight: { type: "number", label: "سماكة الخط (300-900)", min: 100, max: 900 },
        color: { type: "text", label: "لون النص (hex)" },
        letter_spacing: { type: "number", label: "تباعد الأحرف (px)", min: -5, max: 20 },
        line_height: { type: "number", label: "ارتفاع السطر (×10)", min: 8, max: 30 },
        ...STYLE_FIELDS,
      },
      defaultProps: { text: "عنوان رئيسي", tag: "h2", size: 36, weight: 800, color: "", letter_spacing: 0, line_height: 13, ...STYLE_DEFAULTS },
      render: (p) => {
        const { text, tag, size, weight, color, letter_spacing, line_height } = p as any;
        const Tag: any = tag || "h2";
        return (
          <StyleWrap s={pickStyle(p)}>
            <Tag style={{ fontSize: size, fontWeight: weight, color: color || undefined, letterSpacing: letter_spacing, lineHeight: (line_height || 13) / 10, margin: 0 }}>{text}</Tag>
          </StyleWrap>
        );
      },
    },
    ButtonBlock: {
      label: "زر",
      fields: {
        text: { type: "text", label: "النص" },
        link: { type: "text", label: "الرابط" },
        variant: { type: "select", label: "النمط", options: [
          { label: "ممتلئ", value: "solid" }, { label: "إطار فقط", value: "outline" },
          { label: "شفاف", value: "ghost" }, { label: "تدرّج", value: "gradient" },
        ]},
        size: { type: "select", label: "الحجم", options: [
          { label: "صغير", value: "sm" }, { label: "متوسط", value: "md" }, { label: "كبير", value: "lg" }, { label: "ضخم", value: "xl" },
        ]},
        bg: { type: "text", label: "لون الزر (hex)" },
        color: { type: "text", label: "لون النص (hex)" },
        rounded: { type: "number", label: "تدوير الزوايا (px)", min: 0, max: 999 },
        full_width: { type: "radio", label: "عرض كامل", options: [{ label: "لا", value: false }, { label: "نعم", value: true }] },
        new_tab: { type: "radio", label: "فتح في تبويب جديد", options: [{ label: "لا", value: false }, { label: "نعم", value: true }] },
        ...STYLE_FIELDS,
      },
      defaultProps: { text: "اضغط هنا", link: "#", variant: "solid", size: "md", bg: "#7c3aed", color: "#ffffff", rounded: 8, full_width: false, new_tab: false, ...STYLE_DEFAULTS },
      render: (p) => {
        const { text, link, variant, size, bg, color, rounded, full_width, new_tab } = p as any;
        const sizeMap: any = { sm: "8px 16px", md: "12px 24px", lg: "16px 32px", xl: "20px 44px" };
        const fontMap: any = { sm: 13, md: 15, lg: 17, xl: 20 };
        const style: React.CSSProperties = {
          display: full_width ? "block" : "inline-block",
          width: full_width ? "100%" : undefined,
          padding: sizeMap[size || "md"],
          fontSize: fontMap[size || "md"],
          fontWeight: 700, borderRadius: rounded,
          textDecoration: "none", textAlign: "center" as const, transition: "all .2s",
          background: variant === "gradient" ? `linear-gradient(135deg, ${bg || "#7c3aed"}, ${color || "#ec4899"})`
            : variant === "solid" ? bg : variant === "outline" ? "transparent" : "transparent",
          color: variant === "outline" ? bg : color,
          border: variant === "outline" ? `2px solid ${bg}` : "none",
          cursor: "pointer",
        };
        return (
          <StyleWrap s={pickStyle(p)}>
            <a href={link || "#"} target={new_tab ? "_blank" : undefined} rel={new_tab ? "noopener" : undefined} style={style}>{text}</a>
          </StyleWrap>
        );
      },
    },
    ImageBlock: {
      label: "صورة",
      fields: {
        src: { type: "text", label: "رابط الصورة" },
        alt: { type: "text", label: "النص البديل" },
        link: { type: "text", label: "رابط عند الضغط" },
        width: { type: "number", label: "العرض (px، 0 = تلقائي)", min: 0, max: 2000 },
        height: { type: "number", label: "الارتفاع (px، 0 = تلقائي)", min: 0, max: 2000 },
        fit: { type: "select", label: "الملاءمة", options: [{ label: "تغطية", value: "cover" }, { label: "احتواء", value: "contain" }] },
        rounded: { type: "number", label: "تدوير الزوايا (px)", min: 0, max: 999 },
        ...STYLE_FIELDS,
      },
      defaultProps: { src: "", alt: "", link: "", width: 0, height: 0, fit: "cover", rounded: 12, ...STYLE_DEFAULTS },
      render: (p) => {
        const { src, alt, link, width, height, fit, rounded } = p as any;
        const img = src ? (
          <img src={src} alt={alt || ""} style={{
            width: width || "100%", height: height || "auto",
            objectFit: fit, borderRadius: rounded, display: "inline-block", maxWidth: "100%",
          }} />
        ) : <div className="p-8 border-2 border-dashed rounded-xl text-muted-foreground">أضف رابط الصورة</div>;
        return (
          <StyleWrap s={pickStyle(p)}>
            {link ? <a href={link}>{img}</a> : img}
          </StyleWrap>
        );
      },
    },
    Columns: {
      label: "أعمدة (Row)",
      fields: {
        count: { type: "select", label: "عدد الأعمدة", options: [{ label: "2", value: 2 }, { label: "3", value: 3 }, { label: "4", value: 4 }] },
        gap: { type: "number", label: "المسافة بين الأعمدة (px)", min: 0, max: 80 },
        col1: { type: "textarea", label: "محتوى العمود 1 (HTML)" },
        col2: { type: "textarea", label: "محتوى العمود 2 (HTML)" },
        col3: { type: "textarea", label: "محتوى العمود 3 (HTML)" },
        col4: { type: "textarea", label: "محتوى العمود 4 (HTML)" },
        ...STYLE_FIELDS,
      },
      defaultProps: { count: 2, gap: 24, col1: "<h3>عمود 1</h3><p>نص</p>", col2: "<h3>عمود 2</h3><p>نص</p>", col3: "", col4: "", ...STYLE_DEFAULTS },
      render: (p) => {
        const { count, gap, col1, col2, col3, col4 } = p as any;
        const cols = [col1, col2, col3, col4].slice(0, count).filter((_: any, i: number) => i < count);
        const gridCls = count === 2 ? "md:grid-cols-2" : count === 3 ? "md:grid-cols-3" : "md:grid-cols-2 lg:grid-cols-4";
        return (
          <StyleWrap s={pickStyle(p)}>
            <div className={`grid grid-cols-1 ${gridCls}`} style={{ gap }}>
              {cols.map((c: string, i: number) => (
                <div key={i} dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(c || "") }} />
              ))}
            </div>
          </StyleWrap>
        );
      },
    },
    Divider: {
      label: "فاصل",
      fields: {
        thickness: { type: "number", label: "السماكة (px)", min: 1, max: 20 },
        color: { type: "text", label: "اللون (hex)" },
        style: { type: "select", label: "النمط", options: [
          { label: "متّصل", value: "solid" }, { label: "متقطّع", value: "dashed" }, { label: "نقاط", value: "dotted" },
        ]},
        width_pct: { type: "number", label: "العرض (%)", min: 10, max: 100 },
        ...STYLE_FIELDS,
      },
      defaultProps: { thickness: 1, color: "#e5e7eb", style: "solid", width_pct: 100, ...STYLE_DEFAULTS },
      render: (p) => {
        const { thickness, color, style, width_pct } = p as any;
        return (
          <StyleWrap s={pickStyle(p)}>
            <hr style={{ borderTop: `${thickness}px ${style} ${color}`, borderBottom: "none", borderLeft: "none", borderRight: "none", width: `${width_pct}%`, margin: "0 auto" }} />
          </StyleWrap>
        );
      },
    },
    IconBox: {
      label: "صندوق أيقونة",
      fields: {
        icon: { type: "text", label: "الإيموجي/أيقونة" },
        title: { type: "text", label: "العنوان" },
        desc: { type: "textarea", label: "الوصف" },
        color: { type: "text", label: "لون الأيقونة (hex)" },
        size: { type: "number", label: "حجم الأيقونة (px)", min: 20, max: 200 },
        ...STYLE_FIELDS,
      },
      defaultProps: { icon: "🎯", title: "ميزة مميزة", desc: "وصف الميزة هنا", color: "#7c3aed", size: 56, ...STYLE_DEFAULTS },
      render: (p) => {
        const { icon, title, desc, color, size } = p as any;
        return (
          <StyleWrap s={pickStyle(p)}>
            <div className="flex flex-col items-center gap-3">
              <div style={{ fontSize: size, color, lineHeight: 1 }}>{icon}</div>
              {title && <h3 className="font-bold text-xl">{title}</h3>}
              {desc && <p className="text-muted-foreground">{desc}</p>}
            </div>
          </StyleWrap>
        );
      },
    },
    Countdown: {
      label: "عدّاد تنازلي",
      fields: {
        title: { type: "text", label: "العنوان" },
        target: { type: "text", label: "التاريخ المستهدف (YYYY-MM-DD HH:MM)" },
        color: { type: "text", label: "لون الأرقام (hex)" },
        ...STYLE_FIELDS,
      },
      defaultProps: { title: "ينتهي العرض خلال:", target: "", color: "#7c3aed", ...STYLE_DEFAULTS },
      render: (p) => {
        const { title, target, color } = p as any;
        return (
          <StyleWrap s={pickStyle(p)}>
            <CountdownWidget title={title} target={target} color={color} />
          </StyleWrap>
        );
      },
    },
    SocialIcons: {
      label: "أيقونات التواصل",
      fields: {
        facebook: { type: "text", label: "رابط Facebook" },
        instagram: { type: "text", label: "رابط Instagram" },
        whatsapp: { type: "text", label: "رقم WhatsApp (218...)" },
        tiktok: { type: "text", label: "رابط TikTok" },
        youtube: { type: "text", label: "رابط YouTube" },
        email: { type: "text", label: "بريد إلكتروني" },
        size: { type: "number", label: "حجم الأيقونة (px)", min: 16, max: 80 },
        color: { type: "text", label: "لون الأيقونات (hex)" },
        ...STYLE_FIELDS,
      },
      defaultProps: { facebook: "", instagram: "", whatsapp: "", tiktok: "", youtube: "", email: "", size: 28, color: "#7c3aed", ...STYLE_DEFAULTS },
      render: (p) => {
        const { facebook, instagram, whatsapp, tiktok, youtube, email, size, color } = p as any;
        const items = [
          { url: facebook, Icon: Facebook },
          { url: instagram, Icon: Instagram },
          { url: whatsapp ? `https://wa.me/${whatsapp}` : "", Icon: Phone },
          { url: tiktok, Icon: Send },
          { url: youtube, Icon: Youtube },
          { url: email ? `mailto:${email}` : "", Icon: Mail },
        ].filter(x => x.url);
        return (
          <StyleWrap s={pickStyle(p)}>
            <div className="flex items-center justify-center gap-4 flex-wrap">
              {items.map(({ url, Icon }, i) => (
                <a key={i} href={url} target="_blank" rel="noopener" className="hover:scale-110 transition">
                  <Icon style={{ width: size, height: size, color }} />
                </a>
              ))}
            </div>
          </StyleWrap>
        );
      },
    },
    GoogleMap: {
      label: "خريطة Google",
      fields: {
        embed_url: { type: "textarea", label: "رابط Embed من Google Maps" },
        height: { type: "number", label: "الارتفاع (px)", min: 200, max: 800 },
        ...STYLE_FIELDS,
      },
      defaultProps: { embed_url: "", height: 400, ...STYLE_DEFAULTS },
      render: (p) => {
        const { embed_url, height } = p as any;
        return (
          <StyleWrap s={pickStyle(p)}>
            {embed_url
              ? <iframe src={embed_url} style={{ width: "100%", height, border: 0, borderRadius: 12 }} loading="lazy" />
              : <div className="p-8 text-center border-2 border-dashed rounded-xl text-muted-foreground">أدخل رابط Embed</div>}
          </StyleWrap>
        );
      },
    },
  },
  categories: {
    layout:   { title: "تخطيط",  components: ["Hero", "Banner", "PromoBar", "Columns", "Divider", "Spacer"] },
    basic:    { title: "أساسي",  components: ["Heading", "RichText", "ButtonBlock", "ImageBlock", "IconBox"] },
    content:  { title: "محتوى",  components: ["Video", "Faq", "Features", "Reviews", "Countdown", "SocialIcons", "GoogleMap"] },
    commerce: { title: "متجر",   components: ["ProductsGrid", "CategoriesGrid"] },
    custom:   { title: "مخصص",   components: ["HtmlBlock"] },
  },
});

export const EMPTY_PUCK_DATA = { content: [], root: { props: {} } };