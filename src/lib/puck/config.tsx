import type { Config } from "@measured/puck";
import DOMPurify from "dompurify";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Star, ShoppingBag, ChevronDown } from "lucide-react";

export type PuckContext = {
  ownerId?: string;
  storeId?: string;
  username?: string;
  currencySymbol?: string;
};

/* ---------- Shared style props (applied to every component) ---------- */
type StyleProps = {
  padding_y?: number;
  padding_x?: number;
  max_width?: "full" | "container" | "narrow";
  bg_color?: string;
  min_height?: number;
  text_align?: "right" | "center" | "left";
  hide_mobile?: boolean;
  hide_desktop?: boolean;
};

const STYLE_FIELDS = {
  padding_y: { type: "number" as const, label: "مسافة علوية/سفلية (px)", min: 0, max: 200 },
  padding_x: { type: "number" as const, label: "مسافة جانبية (px)", min: 0, max: 100 },
  max_width: { type: "select" as const, label: "العرض الأقصى", options: [
    { label: "كامل العرض", value: "full" },
    { label: "حاوية عادية (1200)", value: "container" },
    { label: "ضيق (768)", value: "narrow" },
  ]},
  bg_color: { type: "text" as const, label: "لون الخلفية (hex/empty)" },
  min_height: { type: "number" as const, label: "ارتفاع أدنى (px)", min: 0, max: 1000 },
  text_align: { type: "select" as const, label: "محاذاة النص", options: [
    { label: "وسط", value: "center" }, { label: "يمين", value: "right" }, { label: "يسار", value: "left" },
  ]},
  hide_mobile: { type: "radio" as const, label: "إخفاء على الجوال", options: [
    { label: "لا", value: false }, { label: "نعم", value: true },
  ]},
  hide_desktop: { type: "radio" as const, label: "إخفاء على الكمبيوتر", options: [
    { label: "لا", value: false }, { label: "نعم", value: true },
  ]},
};

const STYLE_DEFAULTS: StyleProps = {
  padding_y: 16, padding_x: 0, max_width: "container",
  bg_color: "", min_height: 0, text_align: "center",
  hide_mobile: false, hide_desktop: false,
};

const StyleWrap = ({ s, children }: { s: StyleProps; children: React.ReactNode }) => {
  const maxW = s.max_width === "full" ? "100%" : s.max_width === "narrow" ? "768px" : "1200px";
  const hideCls = `${s.hide_mobile ? "max-md:hidden " : ""}${s.hide_desktop ? "md:hidden " : ""}`;
  return (
    <div className={hideCls} style={{ backgroundColor: s.bg_color || undefined, width: "100%" }}>
      <div style={{
        maxWidth: maxW, marginInline: "auto",
        paddingTop: s.padding_y, paddingBottom: s.padding_y,
        paddingLeft: s.padding_x, paddingRight: s.padding_x,
        minHeight: s.min_height || undefined,
        textAlign: s.text_align as any,
      }}>
        {children}
      </div>
    </div>
  );
};

const pickStyle = (p: any): StyleProps => ({
  padding_y: p.padding_y, padding_x: p.padding_x, max_width: p.max_width,
  bg_color: p.bg_color, min_height: p.min_height, text_align: p.text_align,
  hide_mobile: p.hide_mobile, hide_desktop: p.hide_desktop,
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
  Hero: { image: string; title: string; subtitle: string; button_text: string; button_link: string; text_color: string; overlay: number };
  Banner: { image: string; link: string; alt: string };
  ProductsGrid: { title: string; limit: number; columns: number };
  CategoriesGrid: { title: string; items: { label: string; image: string; link: string }[] };
  RichText: { html: string; align: "right" | "center" | "left" };
  Video: { title: string; url: string };
  Faq: { title: string; items: { q: string; a: string }[] };
  Features: { title: string; items: { icon: string; title: string; desc: string }[] };
  PromoBar: { text: string; bg: string; color: string };
  Reviews: { title: string; items: { name: string; text: string; rating: number }[] };
  Spacer: { height: number };
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
      defaultProps: { image: "", title: "أهلاً بك في متجرنا", subtitle: "أفضل المنتجات بأفضل الأسعار", button_text: "تسوّق الآن", button_link: "#products", text_color: "#ffffff", overlay: 0.4, ...STYLE_DEFAULTS, min_height: 420, max_width: "full", padding_y: 0 },
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
      defaultProps: { text: "🎉 خصم 20% على كل المنتجات!", bg: "#7c3aed", color: "#ffffff", ...STYLE_DEFAULTS, padding_y: 0, max_width: "full" },
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
  },
  categories: {
    layout: { title: "تخطيط", components: ["Hero", "Banner", "PromoBar", "Spacer"] },
    content: { title: "محتوى", components: ["RichText", "Video", "Faq", "Features", "Reviews"] },
    commerce: { title: "متجر", components: ["ProductsGrid", "CategoriesGrid"] },
  },
});

export const EMPTY_PUCK_DATA = { content: [], root: { props: {} } };